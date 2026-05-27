import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  hashPassword,
  isEmailIdentifier,
  normalizeEmail,
  normalizeLogin,
  normalizePhone,
  type RegisterUserInput,
  type UpdateProfileInput,
  verifyPassword,
} from "@/lib/user-credentials";

export type AppUser = {
  id: string;
  login: string;
  phone: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  isAdmin: boolean;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

const USER_PUBLIC_FIELDS =
  "id,login,phone,email,email_verified_at,is_admin,name,created_at,updated_at";
const USER_RECORD_FIELDS = `${USER_PUBLIC_FIELDS},password_hash`;

const USERS_TIMEOUT_MS = Number(process.env.USERS_TIMEOUT_MS ?? "5000");

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("users_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mapUserRow(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    login: String(row.login ?? ""),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    emailVerifiedAt:
      row.email_verified_at == null ? null : String(row.email_verified_at),
    isAdmin: Boolean(row.is_admin),
    name: row.name == null ? null : String(row.name),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

type UserRecord = AppUser & { passwordHash: string };

function mapUserRecord(row: Record<string, unknown>): UserRecord {
  return {
    ...mapUserRow(row),
    passwordHash: String(row.password_hash ?? ""),
  };
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .select(USER_PUBLIC_FIELDS)
        .eq("id", id)
        .maybeSingle()
        .then((r) => r),
      USERS_TIMEOUT_MS
    );
    if (response.error || !response.data) return null;
    return mapUserRow(response.data as Record<string, unknown>);
  } catch (err) {
    console.error("[users-store] findUserById:", err);
    return null;
  }
}

export async function findUserByLogin(login: string): Promise<AppUser | null> {
  const record = await findUserRecordByLogin(normalizeLogin(login));
  if (!record) return null;
  const { passwordHash: _passwordHash, ...user } = record;
  return user;
}

async function findUserRecordByLogin(login: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const response = await withTimeout(
    supabase
      .from("app_users")
      .select(USER_RECORD_FIELDS)
      .eq("login", login)
      .maybeSingle()
      .then((r) => r),
    USERS_TIMEOUT_MS
  );
  if (response.error || !response.data) return null;
  return mapUserRecord(response.data as Record<string, unknown>);
}

async function findUserRecordByPhone(phone: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const response = await withTimeout(
    supabase
      .from("app_users")
      .select(USER_RECORD_FIELDS)
      .eq("phone", phone)
      .maybeSingle()
      .then((r) => r),
    USERS_TIMEOUT_MS
  );
  if (response.error || !response.data) return null;
  return mapUserRecord(response.data as Record<string, unknown>);
}

async function findUserRecordByEmail(email: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const response = await withTimeout(
    supabase
      .from("app_users")
      .select(USER_RECORD_FIELDS)
      .eq("email", email)
      .maybeSingle()
      .then((r) => r),
    USERS_TIMEOUT_MS
  );
  if (response.error || !response.data) return null;
  return mapUserRecord(response.data as Record<string, unknown>);
}

export type AuthenticateUserResult =
  | { ok: true; user: AppUser }
  | { ok: false; error: "invalid_credentials" | "email_not_verified" };

export async function authenticateUser(
  identifier: string,
  password: string
): Promise<AuthenticateUserResult> {
  try {
    let record: UserRecord | null;

    if (isEmailIdentifier(identifier)) {
      record = await findUserRecordByEmail(normalizeEmail(identifier));
      if (record && !record.emailVerifiedAt) {
        return { ok: false, error: "email_not_verified" };
      }
    } else {
      record = await findUserRecordByLogin(normalizeLogin(identifier));
    }

    if (!record) {
      return { ok: false, error: "invalid_credentials" };
    }

    const valid = await verifyPassword(password, record.passwordHash);
    if (!valid) {
      return { ok: false, error: "invalid_credentials" };
    }

    const { passwordHash: _passwordHash, ...user } = record;
    return { ok: true, user };
  } catch (err) {
    console.error("[users-store] authenticateUser:", err);
    return { ok: false, error: "invalid_credentials" };
  }
}

export type CreateUserResult =
  | { ok: true; user: AppUser }
  | { ok: false; error: string };

export async function createUser(input: RegisterUserInput): Promise<CreateUserResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const login = normalizeLogin(input.login);
  const phoneRaw = input.phone?.trim() ?? "";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const emailRaw = input.email?.trim() ?? "";
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const name = input.name.trim();
  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .insert({
          login,
          phone,
          email,
          name,
          password_hash: passwordHash,
          updated_at: now,
        })
        .select(USER_PUBLIC_FIELDS)
        .single()
        .then((r) => r),
      USERS_TIMEOUT_MS
    );

    if (response.error) {
      if (response.error.code === "23505") {
        return { ok: false, error: "Пользователь с таким логином или телефоном уже существует" };
      }
      console.error("[users-store] createUser:", response.error);
      return { ok: false, error: "Не удалось создать пользователя" };
    }

    return { ok: true, user: mapUserRow(response.data as Record<string, unknown>) };
  } catch (err) {
    console.error("[users-store] createUser:", err);
    return { ok: false, error: "Не удалось создать пользователя" };
  }
}

export async function findUserByVerifiedEmail(email: string): Promise<AppUser | null> {
  try {
    const record = await findUserRecordByEmail(normalizeEmail(email));
    if (!record?.emailVerifiedAt) return null;
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  } catch (err) {
    console.error("[users-store] findUserByVerifiedEmail:", err);
    return null;
  }
}

export type UpdateUserProfileResult =
  | { ok: true; user: AppUser; emailChanged: boolean }
  | { ok: false; error: string };

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UpdateUserProfileResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const current = await findUserById(userId);
  if (!current) {
    return { ok: false, error: "Пользователь не найден" };
  }

  const name = input.name.trim();
  const phoneRaw = input.phone?.trim() ?? "";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const emailRaw = input.email?.trim() ?? "";
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const emailChanged = (current.email ?? null) !== email;

  if (phone && phone !== current.phone) {
    const existingPhone = await findUserRecordByPhone(phone);
    if (existingPhone && existingPhone.id !== userId) {
      return { ok: false, error: "Этот номер телефона уже используется" };
    }
  }

  if (email && email !== current.email) {
    const existingEmail = await findUserRecordByEmail(email);
    if (existingEmail && existingEmail.id !== userId) {
      return { ok: false, error: "Этот e-mail уже используется" };
    }
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    name,
    phone,
    email,
    updated_at: now,
  };

  if (emailChanged) {
    updatePayload.email_verified_at = null;
  }

  try {
    if (emailChanged) {
      await withTimeout(
        supabase.from("app_email_verification_tokens").delete().eq("user_id", userId).then((r) => r),
        USERS_TIMEOUT_MS
      );
    }

    const response = await withTimeout(
      supabase
        .from("app_users")
        .update(updatePayload)
        .eq("id", userId)
        .select(USER_PUBLIC_FIELDS)
        .single()
        .then((r) => r),
      USERS_TIMEOUT_MS
    );

    if (response.error) {
      if (response.error.code === "23505") {
        return { ok: false, error: "Телефон или e-mail уже используется другим пользователем" };
      }
      console.error("[users-store] updateUserProfile:", response.error);
      return { ok: false, error: "Не удалось обновить профиль" };
    }

    return {
      ok: true,
      user: mapUserRow(response.data as Record<string, unknown>),
      emailChanged,
    };
  } catch (err) {
    console.error("[users-store] updateUserProfile:", err);
    return { ok: false, error: "Не удалось обновить профиль" };
  }
}

export async function updateUserPassword(
  userId: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .update({ password_hash: passwordHash, updated_at: now })
        .eq("id", userId)
        .then((r) => r),
      USERS_TIMEOUT_MS
    );

    if (response.error) {
      console.error("[users-store] updateUserPassword:", response.error);
      return { ok: false, error: "Не удалось обновить пароль" };
    }

    return { ok: true };
  } catch (err) {
    console.error("[users-store] updateUserPassword:", err);
    return { ok: false, error: "Не удалось обновить пароль" };
  }
}
