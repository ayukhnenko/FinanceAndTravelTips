import { createHash, randomBytes } from "node:crypto";
import { isMissingColumnError } from "@/lib/supabase-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/user-credentials";
import { findUserById } from "@/lib/users-store";

const CASES_TIMEOUT_MS = Number(process.env.CASES_TIMEOUT_MS ?? "5000");
const MAX_TITLE_LENGTH = 200;
const MIN_TITLE_LENGTH = 3;
const MAX_BODY_LENGTH = 10000;
const MIN_BODY_LENGTH = 10;

export type CaseStatus = "draft" | "submitted" | "answered";

export type CaseMessage = {
  id: string;
  caseId: string;
  senderKind: "user" | "admin";
  senderUserId: string | null;
  senderLogin: string | null;
  senderName: string | null;
  body: string;
  createdAt: string;
};

export type UserCase = {
  id: string;
  userId: string | null;
  guestEmail: string | null;
  title: string;
  body: string;
  status: CaseStatus;
  adminResponse: string | null;
  adminRespondedAt: string | null;
  adminRespondedBy: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorLogin: string | null;
  authorName: string | null;
};

const CASE_SELECT =
  "id,user_id,guest_email,title,body,status,admin_response,admin_responded_at,admin_responded_by,submitted_at,created_at,updated_at";

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("cases_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function hashGuestToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function createGuestToken(): string {
  return randomBytes(32).toString("hex");
}

function mapCaseRow(row: Record<string, unknown>): UserCase {
  return {
    id: String(row.id),
    userId: row.user_id == null ? null : String(row.user_id),
    guestEmail: row.guest_email == null ? null : String(row.guest_email),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    status: String(row.status ?? "draft") as CaseStatus,
    adminResponse: row.admin_response == null ? null : String(row.admin_response),
    adminRespondedAt:
      row.admin_responded_at == null ? null : String(row.admin_responded_at),
    adminRespondedBy:
      row.admin_responded_by == null ? null : String(row.admin_responded_by),
    submittedAt: row.submitted_at == null ? null : String(row.submitted_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    authorLogin: null,
    authorName: null,
  };
}

export function validateCaseTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length < MIN_TITLE_LENGTH) {
    return `Заголовок должен быть не короче ${MIN_TITLE_LENGTH} символов`;
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return `Заголовок не должен быть длиннее ${MAX_TITLE_LENGTH} символов`;
  }
  return null;
}

export function validateCaseBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < MIN_BODY_LENGTH) {
    return `Описание должно быть не короче ${MIN_BODY_LENGTH} символов`;
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    return `Описание не должно быть длиннее ${MAX_BODY_LENGTH} символов`;
  }
  return null;
}

export function validateGuestEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Укажите корректный e-mail";
  }
  return null;
}

async function attachAuthorMeta(items: UserCase[]): Promise<UserCase[]> {
  const userIds = Array.from(
    new Set(items.map((item) => item.userId).filter((id): id is string => Boolean(id)))
  );
  const users = await Promise.all(userIds.map((id) => findUserById(id)));
  const byId = new Map(users.filter(Boolean).map((user) => [user!.id, user!]));

  return items.map((item) => {
    if (!item.userId) return item;
    const user = byId.get(item.userId);
    if (!user) return item;
    return {
      ...item,
      authorLogin: user.login,
      authorName: user.name,
    };
  });
}

export async function listCasesForUser(userId: string): Promise<UserCase[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .select(CASE_SELECT)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error) {
      if (isMissingColumnError(response.error)) return [];
      console.error("[cases-store] listCasesForUser:", response.error);
      return [];
    }

    return (response.data ?? []).map((row) => mapCaseRow(row as Record<string, unknown>));
  } catch (err) {
    console.error("[cases-store] listCasesForUser:", err);
    return [];
  }
}

export async function getCaseById(caseId: string): Promise<UserCase | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .select(CASE_SELECT)
        .eq("id", caseId)
        .maybeSingle()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error || !response.data) {
      if (response.error && !isMissingColumnError(response.error)) {
        console.error("[cases-store] getCaseById:", response.error);
      }
      return null;
    }

    const item = mapCaseRow(response.data as Record<string, unknown>);
    const [withAuthor] = await attachAuthorMeta([item]);
    return withAuthor;
  } catch (err) {
    console.error("[cases-store] getCaseById:", err);
    return null;
  }
}

export function canAccessCase(
  item: UserCase,
  userId: string | null,
  guestToken: string | null
): boolean {
  if (userId && item.userId === userId) return true;
  if (!item.userId && guestToken && item.guestEmail) {
    return true;
  }
  return false;
}

export async function verifyGuestCaseAccess(
  caseId: string,
  guestToken: string
): Promise<UserCase | null> {
  const item = await getCaseById(caseId);
  if (!item || item.userId) return null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .select("guest_token_hash")
        .eq("id", caseId)
        .maybeSingle()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error || !response.data) return null;
    const storedHash = String(response.data.guest_token_hash ?? "");
    if (!storedHash || storedHash !== hashGuestToken(guestToken)) return null;
    return item;
  } catch {
    return null;
  }
}

export async function listGuestCasesByAccess(
  accessList: Array<{ id: string; token: string }>
): Promise<UserCase[]> {
  const items: UserCase[] = [];
  for (const entry of accessList) {
    const item = await verifyGuestCaseAccess(entry.id, entry.token);
    if (item) items.push(item);
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createCaseForUser(input: {
  userId: string;
  title: string;
  body: string;
  email?: string | null;
}): Promise<
  | { ok: true; case: UserCase }
  | { ok: false; error: string }
> {
  const titleError = validateCaseTitle(input.title);
  if (titleError) return { ok: false, error: titleError };
  const bodyError = validateCaseBody(input.body);
  if (bodyError) return { ok: false, error: bodyError };

  const user = await findUserById(input.userId);
  if (!user) return { ok: false, error: "Пользователь не найден" };

  const guestEmail = user.email ? normalizeEmail(user.email) : null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "База данных не настроена" };

  const now = new Date().toISOString();
  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .insert({
          user_id: input.userId,
          guest_email: guestEmail,
          title: input.title.trim(),
          body: input.body.trim(),
          status: "draft",
          created_at: now,
          updated_at: now,
        })
        .select(CASE_SELECT)
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error || !response.data) {
      if (isMissingColumnError(response.error)) {
        return {
          ok: false,
          error: "В базе нет таблицы app_user_cases — выполните SQL-миграцию в Supabase",
        };
      }
      console.error("[cases-store] createCaseForUser:", response.error);
      return { ok: false, error: "Не удалось создать кейс" };
    }

    const item = mapCaseRow(response.data as Record<string, unknown>);
    return { ok: true, case: { ...item, authorLogin: user.login, authorName: user.name } };
  } catch (err) {
    console.error("[cases-store] createCaseForUser:", err);
    return { ok: false, error: "Не удалось создать кейс" };
  }
}

export async function createCaseForGuest(input: {
  email: string;
  title: string;
  body: string;
}): Promise<
  | { ok: true; case: UserCase; accessToken: string }
  | { ok: false; error: string }
> {
  const emailError = validateGuestEmail(input.email);
  if (emailError) return { ok: false, error: emailError };
  const titleError = validateCaseTitle(input.title);
  if (titleError) return { ok: false, error: titleError };
  const bodyError = validateCaseBody(input.body);
  if (bodyError) return { ok: false, error: bodyError };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "База данных не настроена" };

  const accessToken = createGuestToken();
  const now = new Date().toISOString();

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .insert({
          guest_email: normalizeEmail(input.email),
          guest_token_hash: hashGuestToken(accessToken),
          title: input.title.trim(),
          body: input.body.trim(),
          status: "draft",
          created_at: now,
          updated_at: now,
        })
        .select(CASE_SELECT)
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error || !response.data) {
      if (isMissingColumnError(response.error)) {
        return {
          ok: false,
          error: "В базе нет таблицы app_user_cases — выполните SQL-миграцию в Supabase",
        };
      }
      console.error("[cases-store] createCaseForGuest:", response.error);
      return { ok: false, error: "Не удалось создать кейс" };
    }

    return {
      ok: true,
      case: mapCaseRow(response.data as Record<string, unknown>),
      accessToken,
    };
  } catch (err) {
    console.error("[cases-store] createCaseForGuest:", err);
    return { ok: false, error: "Не удалось создать кейс" };
  }
}

export async function updateCaseDraft(input: {
  caseId: string;
  userId?: string | null;
  guestToken?: string | null;
  title: string;
  body: string;
  email?: string | null;
}): Promise<{ ok: true; case: UserCase } | { ok: false; error: string }> {
  const titleError = validateCaseTitle(input.title);
  if (titleError) return { ok: false, error: titleError };
  const bodyError = validateCaseBody(input.body);
  if (bodyError) return { ok: false, error: bodyError };

  let item: UserCase | null = null;
  if (input.userId) {
    item = await getCaseById(input.caseId);
    if (!item || item.userId !== input.userId) {
      return { ok: false, error: "Кейс не найден" };
    }
  } else if (input.guestToken) {
    item = await verifyGuestCaseAccess(input.caseId, input.guestToken);
    if (!item) return { ok: false, error: "Кейс не найден" };
  } else {
    return { ok: false, error: "Кейс не найден" };
  }

  if (item.status !== "draft") {
    return { ok: false, error: "Редактировать можно только черновик" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "База данных не настроена" };

  const update: Record<string, string> = {
    title: input.title.trim(),
    body: input.body.trim(),
    updated_at: new Date().toISOString(),
  };

  if (!item.userId && input.email?.trim()) {
    const emailError = validateGuestEmail(input.email);
    if (emailError) return { ok: false, error: emailError };
    update.guest_email = normalizeEmail(input.email);
  }

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .update(update)
        .eq("id", input.caseId)
        .select(CASE_SELECT)
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error || !response.data) {
      console.error("[cases-store] updateCaseDraft:", response.error);
      return { ok: false, error: "Не удалось сохранить кейс" };
    }

    return { ok: true, case: mapCaseRow(response.data as Record<string, unknown>) };
  } catch (err) {
    console.error("[cases-store] updateCaseDraft:", err);
    return { ok: false, error: "Не удалось сохранить кейс" };
  }
}

export async function submitCaseForAnalysis(input: {
  caseId: string;
  userId?: string | null;
  guestToken?: string | null;
  email?: string | null;
}): Promise<{ ok: true; case: UserCase } | { ok: false; error: string }> {
  let item: UserCase | null = null;
  if (input.userId) {
    item = await getCaseById(input.caseId);
    if (!item || item.userId !== input.userId) {
      return { ok: false, error: "Кейс не найден" };
    }
  } else if (input.guestToken) {
    item = await verifyGuestCaseAccess(input.caseId, input.guestToken);
    if (!item) return { ok: false, error: "Кейс не найден" };
  } else {
    return { ok: false, error: "Кейс не найден" };
  }

  if (item.status !== "draft") {
    return { ok: false, error: "Кейс уже отправлен на анализ" };
  }

  let notifyEmail = item.guestEmail;
  if (input.userId) {
    const user = await findUserById(input.userId);
    notifyEmail = user?.email ? normalizeEmail(user.email) : null;
    if (!notifyEmail) {
      return { ok: false, error: "Укажите e-mail в профиле, чтобы получить ответ" };
    }
  } else if (!input.userId && input.email?.trim()) {
    const emailError = validateGuestEmail(input.email);
    if (emailError) return { ok: false, error: emailError };
    notifyEmail = normalizeEmail(input.email);
  }

  if (!notifyEmail) {
    return { ok: false, error: "Укажите e-mail, чтобы получить ответ" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "База данных не настроена" };

  const now = new Date().toISOString();
  const update: Record<string, string> = {
    status: "submitted",
    submitted_at: now,
    updated_at: now,
    guest_email: notifyEmail,
  };

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_cases")
        .update(update)
        .eq("id", input.caseId)
        .select(CASE_SELECT)
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error || !response.data) {
      console.error("[cases-store] submitCaseForAnalysis:", response.error);
      return { ok: false, error: "Не удалось отправить кейс" };
    }

    return { ok: true, case: mapCaseRow(response.data as Record<string, unknown>) };
  } catch (err) {
    console.error("[cases-store] submitCaseForAnalysis:", err);
    return { ok: false, error: "Не удалось отправить кейс" };
  }
}

export async function listCasesForAdmin(status?: CaseStatus | "all"): Promise<UserCase[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("app_user_cases")
      .select(CASE_SELECT)
      .in("status", ["submitted", "answered"])
      .order("submitted_at", { ascending: false, nullsFirst: false });

    if (status && status !== "all") {
      query = supabase
        .from("app_user_cases")
        .select(CASE_SELECT)
        .eq("status", status)
        .order("submitted_at", { ascending: false, nullsFirst: false });
    }

    const response = await withTimeout(query.then((r) => r), CASES_TIMEOUT_MS);
    if (response.error) {
      if (isMissingColumnError(response.error)) return [];
      console.error("[cases-store] listCasesForAdmin:", response.error);
      return [];
    }

    return attachAuthorMeta(
      (response.data ?? []).map((row) => mapCaseRow(row as Record<string, unknown>))
    );
  } catch (err) {
    console.error("[cases-store] listCasesForAdmin:", err);
    return [];
  }
}

export function validateCaseMessage(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 10) return "Сообщение должно быть не короче 10 символов";
  if (trimmed.length > MAX_BODY_LENGTH) {
    return `Сообщение не должно быть длиннее ${MAX_BODY_LENGTH} символов`;
  }
  return null;
}

export function validateAdminResponse(response: string): string | null {
  return validateCaseMessage(response);
}

export async function respondToCase(input: {
  caseId: string;
  adminUserId: string;
  response: string;
}): Promise<{ ok: true; case: UserCase } | { ok: false; error: string }> {
  const responseError = validateCaseMessage(input.response);
  if (responseError) return { ok: false, error: responseError };

  const item = await getCaseById(input.caseId);
  if (!item || item.status === "draft") {
    return { ok: false, error: "Кейс не найден или ещё не отправлен" };
  }
  if (item.status !== "submitted") {
    return { ok: false, error: "Сейчас ждём сообщение от пользователя" };
  }
  if (item.adminRespondedBy && item.adminRespondedBy !== input.adminUserId) {
    return { ok: false, error: "Этот кейс ведёт другой аналитик" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "База данных не настроена" };

  const now = new Date().toISOString();
  const trimmed = input.response.trim();
  try {
    const messageResponse = await withTimeout(
      supabase
        .from("app_user_case_messages")
        .insert({
          case_id: input.caseId,
          sender_kind: "admin",
          sender_user_id: input.adminUserId,
          body: trimmed,
          created_at: now,
        })
        .select("id")
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (messageResponse.error) {
      if (isMissingColumnError(messageResponse.error)) {
        return {
          ok: false,
          error:
            "В базе нет таблицы app_user_case_messages — выполните SQL-миграцию в Supabase",
        };
      }
      console.error("[cases-store] respondToCase insert message:", messageResponse.error);
      return { ok: false, error: "Не удалось сохранить ответ" };
    }

    const dbResponse = await withTimeout(
      supabase
        .from("app_user_cases")
        .update({
          status: "answered",
          admin_response: trimmed,
          admin_responded_at: now,
          admin_responded_by: input.adminUserId,
          updated_at: now,
        })
        .eq("id", input.caseId)
        .select(CASE_SELECT)
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (dbResponse.error || !dbResponse.data) {
      console.error("[cases-store] respondToCase:", dbResponse.error);
      return { ok: false, error: "Не удалось сохранить ответ" };
    }

    const [withAuthor] = await attachAuthorMeta([
      mapCaseRow(dbResponse.data as Record<string, unknown>),
    ]);
    return { ok: true, case: withAuthor };
  } catch (err) {
    console.error("[cases-store] respondToCase:", err);
    return { ok: false, error: "Не удалось сохранить ответ" };
  }
}

function mapCaseMessageRow(row: Record<string, unknown>): CaseMessage {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    senderKind: String(row.sender_kind) as "user" | "admin",
    senderUserId: row.sender_user_id == null ? null : String(row.sender_user_id),
    senderLogin: null,
    senderName: null,
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

async function attachMessageSenderMeta(messages: CaseMessage[]): Promise<CaseMessage[]> {
  const userIds = Array.from(
    new Set(messages.map((item) => item.senderUserId).filter((id): id is string => Boolean(id)))
  );
  const users = await Promise.all(userIds.map((id) => findUserById(id)));
  const byId = new Map(users.filter(Boolean).map((user) => [user!.id, user!]));

  return messages.map((message) => {
    if (!message.senderUserId) return message;
    const user = byId.get(message.senderUserId);
    if (!user) return message;
    return {
      ...message,
      senderLogin: user.login,
      senderName: user.name,
    };
  });
}

export async function listCaseMessages(item: UserCase): Promise<CaseMessage[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  try {
    const response = await withTimeout(
      supabase
        .from("app_user_case_messages")
        .select("id,case_id,sender_kind,sender_user_id,body,created_at")
        .eq("case_id", item.id)
        .order("created_at", { ascending: true })
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (response.error) {
      if (isMissingColumnError(response.error)) {
        if (item.adminResponse && item.adminRespondedAt) {
          return attachMessageSenderMeta([
            {
              id: "legacy-admin-response",
              caseId: item.id,
              senderKind: "admin",
              senderUserId: item.adminRespondedBy,
              senderLogin: null,
              senderName: null,
              body: item.adminResponse,
              createdAt: item.adminRespondedAt,
            },
          ]);
        }
        return [];
      }
      console.error("[cases-store] listCaseMessages:", response.error);
      return [];
    }

    let messages = (response.data ?? []).map((row) =>
      mapCaseMessageRow(row as Record<string, unknown>)
    );

    if (
      messages.length === 0 &&
      item.adminResponse &&
      item.adminRespondedAt &&
      item.status !== "draft"
    ) {
      messages = [
        {
          id: "legacy-admin-response",
          caseId: item.id,
          senderKind: "admin",
          senderUserId: item.adminRespondedBy,
          senderLogin: null,
          senderName: null,
          body: item.adminResponse,
          createdAt: item.adminRespondedAt,
        },
      ];
    }

    return attachMessageSenderMeta(messages);
  } catch (err) {
    console.error("[cases-store] listCaseMessages:", err);
    return [];
  }
}

export async function addUserCaseFollowUp(input: {
  caseId: string;
  userId?: string | null;
  guestToken?: string | null;
  body: string;
}): Promise<
  | { ok: true; case: UserCase; message: CaseMessage }
  | { ok: false; error: string }
> {
  const bodyError = validateCaseMessage(input.body);
  if (bodyError) return { ok: false, error: bodyError };

  let item: UserCase | null = null;
  if (input.userId) {
    item = await getCaseById(input.caseId);
    if (!item || item.userId !== input.userId) {
      return { ok: false, error: "Кейс не найден" };
    }
  } else if (input.guestToken) {
    item = await verifyGuestCaseAccess(input.caseId, input.guestToken);
    if (!item) return { ok: false, error: "Кейс не найден" };
  } else {
    return { ok: false, error: "Кейс не найден" };
  }

  if (item.status !== "answered") {
    return { ok: false, error: "Можно ответить только после ответа аналитика" };
  }
  if (!item.adminRespondedBy) {
    return { ok: false, error: "Кейс ещё не обработан аналитиком" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "База данных не настроена" };

  const now = new Date().toISOString();
  const trimmed = input.body.trim();

  try {
    const messageResponse = await withTimeout(
      supabase
        .from("app_user_case_messages")
        .insert({
          case_id: input.caseId,
          sender_kind: "user",
          sender_user_id: input.userId ?? null,
          body: trimmed,
          created_at: now,
        })
        .select("id,case_id,sender_kind,sender_user_id,body,created_at")
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (messageResponse.error || !messageResponse.data) {
      if (isMissingColumnError(messageResponse.error)) {
        return {
          ok: false,
          error:
            "В базе нет таблицы app_user_case_messages — выполните SQL-миграцию в Supabase",
        };
      }
      console.error("[cases-store] addUserCaseFollowUp:", messageResponse.error);
      return { ok: false, error: "Не удалось отправить сообщение" };
    }

    const caseResponse = await withTimeout(
      supabase
        .from("app_user_cases")
        .update({
          status: "submitted",
          updated_at: now,
        })
        .eq("id", input.caseId)
        .select(CASE_SELECT)
        .single()
        .then((r) => r),
      CASES_TIMEOUT_MS
    );

    if (caseResponse.error || !caseResponse.data) {
      console.error("[cases-store] addUserCaseFollowUp update case:", caseResponse.error);
      return { ok: false, error: "Не удалось отправить сообщение" };
    }

    const [message] = await attachMessageSenderMeta([
      mapCaseMessageRow(messageResponse.data as Record<string, unknown>),
    ]);
    const [withAuthor] = await attachAuthorMeta([
      mapCaseRow(caseResponse.data as Record<string, unknown>),
    ]);

    return { ok: true, case: withAuthor, message };
  } catch (err) {
    console.error("[cases-store] addUserCaseFollowUp:", err);
    return { ok: false, error: "Не удалось отправить сообщение" };
  }
}

export function resolveCaseRecipientEmail(item: UserCase): string | null {
  return item.guestEmail;
}

export function canAdminRespondToCase(item: UserCase, adminUserId: string): boolean {
  if (item.status !== "submitted") return false;
  if (!item.adminRespondedBy) return true;
  return item.adminRespondedBy === adminUserId;
}
