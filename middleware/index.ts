import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const pathname = request.nextUrl.pathname;

  // Allow access to landing page and root without authentication
  if (pathname === "/" || pathname === "/landing") {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Reason: forgot/reset password and login 2FA must stay reachable without
    // a session cookie — same carve-out as sign-in / sign-up.
    "/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|forgot-password|reset-password|verify-2fa|assets|uploads).*)",
  ],
};
