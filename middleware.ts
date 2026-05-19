import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminLoginApi = pathname === "/api/admin/login";

  // Login endpoints must stay public, otherwise auth flow is blocked.
  if (isAdminLoginPage || isAdminLoginApi) {
    return NextResponse.next();
  }

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isAdmin = token ? await verifyAdminSessionToken(token) : false;
  if (isAdmin) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  const from = `${pathname}${search}`;
  loginUrl.searchParams.set("from", from);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
