import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  hashPassword,
  isPhoneIdentifier,
  normalizeEmail,
  normalizeLogin,
  normalizePhone,
  type RegisterUserInput,
  verifyPassword,
} from "@/lib/user-credentials";

export type AppUser = {
  id: string;
  login: string;
  phone: string;
  email: string | null;
  emailVerifiedAt: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

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
    phone: String(row.phone ?? ""),
    email: row.email == null ? null : String(row.email),
    emailVerifiedAt:
      row.email_verified_at == null ? null : String(row.email_verified_at),
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
        .select("id,login,phone,email,email_verified_at,name,created_at,updated_at")
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

async function findUserRecordByLogin(login: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const response = await withTimeout(
    supabase
      .from("app_users")
      .select("id,login,phone,email,email_verified_at,name,created_at,updated_at,password_hash")
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
      .select("id,login,phone,email,email_verified_at,name,created_at,updated_at,password_hash")
      .eq("phone", phone)
      .maybeSingle()
      .then((r) => r),
    USERS_TIMEOUT_MS
  );
  if (response.error || !response.data) return null;
  return mapUserRecord(response.data as Record<string, unknown>);
}

export async function authenticateUser(
  identifier: string,
  password: string
): Promise<AppUser | null> {
  try {
    const record = isPhoneIdentifier(identifier)
      ? await findUserRecordByPhone(normalizePhone(identifier))
      : await findUserRecordByLogin(normalizeLogin(identifier));

    if (!record) return null;
    const valid = await verifyPassword(password, record.passwordHash);
    if (!valid) return null;

    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  } catch (err) {
    console.error("[users-store] authenticateUser:", err);
    return null;
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
  const phone = normalizePhone(input.phone);
  const emailRaw = input.email?.trim() ?? "";
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const name = input.name?.trim() || null;
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
        .select("id,login,phone,email,email_verified_at,name,created_at,updated_at")
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
