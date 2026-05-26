import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  USER_SESSION_COOKIE,
  verifyAdminSessionToken,
  verifyUserSessionToken,
} from "@/lib/auth";

function safeNextPath(from: string | null, fallback: string): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return fallback;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isAdminLoginPage = pathname === "/admin/login";
    const isAdminLoginApi = pathname === "/api/admin/login";
    if (isAdminLoginPage || isAdminLoginApi) {
      return NextResponse.next();
    }

    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const isAdmin = adminToken ? await verifyAdminSessionToken(adminToken) : false;
    if (isAdmin) return NextResponse.next();

    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAccountPublicPage =
    pathname === "/account/login" ||
    pathname === "/account/register" ||
    pathname === "/account/verify-email" ||
    pathname === "/account/forgot-password" ||
    pathname === "/account/reset-password";
  const isAccountPublicApi =
    pathname === "/api/auth/register" ||
    pathname === "/api/auth/user-login" ||
    pathname === "/api/auth/user-logout" ||
    pathname === "/api/auth/request-password-reset" ||
    pathname === "/api/auth/reset-password";

  if (isAccountPublicPage || isAccountPublicApi) {
    const userToken = request.cookies.get(USER_SESSION_COOKIE)?.value;
    const userId = userToken ? await verifyUserSessionToken(userToken) : null;

    const redirectLoggedInUserFromPublicPage =
      isAccountPublicPage &&
      pathname !== "/account/verify-email" &&
      pathname !== "/account/reset-password";

    if (userId && redirectLoggedInUserFromPublicPage) {
      return NextResponse.redirect(new URL("/account", request.url));
    }

    return NextResponse.next();
  }

  const isAccountProtected =
    (pathname.startsWith("/account") && !isAccountPublicPage) ||
    pathname === "/api/auth/me" ||
    pathname === "/api/auth/send-email-verification";

  if (!isAccountProtected) {
    return NextResponse.next();
  }

  const userToken = request.cookies.get(USER_SESSION_COOKIE)?.value;
  const userId = userToken ? await verifyUserSessionToken(userToken) : null;
  if (userId) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/account/login", request.url);
  loginUrl.searchParams.set("from", safeNextPath(`${pathname}${search}`, "/account"));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/account/:path*",
    "/api/auth/me",
    "/api/auth/register",
    "/api/auth/user-login",
    "/api/auth/user-logout",
    "/api/auth/send-email-verification",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
  ],
};
