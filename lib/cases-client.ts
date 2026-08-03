export const GUEST_CASES_STORAGE_KEY = "app_guest_cases_access_v1";

export type GuestCaseAccess = {
  id: string;
  token: string;
};

export function readGuestCaseAccessList(): GuestCaseAccess[] {
  try {
    const raw = localStorage.getItem(GUEST_CASES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestCaseAccess[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.id && item?.token);
  } catch {
    return [];
  }
}

export function writeGuestCaseAccessList(items: GuestCaseAccess[]): void {
  localStorage.setItem(GUEST_CASES_STORAGE_KEY, JSON.stringify(items));
}

export function rememberGuestCaseAccess(id: string, token: string): void {
  const current = readGuestCaseAccessList().filter((item) => item.id !== id);
  current.unshift({ id, token });
  writeGuestCaseAccessList(current.slice(0, 20));
}

export function getGuestCaseToken(caseId: string): string | null {
  const item = readGuestCaseAccessList().find((entry) => entry.id === caseId);
  return item?.token ?? null;
}

export function caseStatusLabel(status: string): string {
  if (status === "submitted") return "На анализе";
  if (status === "answered") return "Ответ получен";
  return "Черновик";
}

export type CaseMessageView = {
  id: string;
  senderKind: "user" | "admin";
  senderLogin: string | null;
  senderName: string | null;
  body: string;
  createdAt: string;
};
