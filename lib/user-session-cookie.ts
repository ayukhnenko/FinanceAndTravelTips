import { NextResponse } from "next/server";
import {
  USER_SESSION_COOKIE,
  createUserSessionToken,
  getUserSessionMaxAgeSec,
} from "@/lib/auth";

export async function attachUserSessionCookie(
  response: NextResponse,
  userId: string
): Promise<NextResponse> {
  const token = await createUserSessionToken(userId);
  const isProd = process.env.NODE_ENV === "production";

  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: getUserSessionMaxAgeSec(),
  });

  return response;
}

export function clearUserSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(USER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
