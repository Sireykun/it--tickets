import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: sends visitors without a session cookie to /login.
// Real checks (valid session, active user, role) happen in src/server/authz.ts.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = new URL("/login", request.url);
  const path = request.nextUrl.pathname + request.nextUrl.search;
  if (path !== "/") url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|pwa-icon|apple-icon|icon).*)",
  ],
};
