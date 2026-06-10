import { getCurrentUser } from "@/lib/get-current-user";

export function readGuestCaseToken(request: Request): string | null {
  const header = request.headers.get("x-case-access-token");
  return header?.trim() ? header.trim() : null;
}

export async function getOptionalCurrentUser() {
  return getCurrentUser();
}
