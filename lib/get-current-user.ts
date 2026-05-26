import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/auth";
import { findUserById, type AppUser } from "@/lib/users-store";

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = cookies().get(USER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifyUserSessionToken(token);
  if (!userId) return null;

  return findUserById(userId);
}
