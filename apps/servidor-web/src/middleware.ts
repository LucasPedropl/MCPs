import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getSessionSecret,
  isAuthConfigured,
  verifySessionToken,
} from "@/lib/dashboard-auth";

const AUTH_PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (AUTH_PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  const configured = isAuthConfigured();
  const secret = getSessionSecret();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session =
    configured && secret
      ? await verifySessionToken(token, secret)
      : null;

  if (pathname === "/login") {
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = "/agent-os";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!configured || !secret) {
    const message =
      "Dashboard auth não configurada. Configure Supabase (URL + keys). Credenciais de login ficam no Supabase Auth.";
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: message, configured: false },
        { status: 503 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "not_configured");
    return NextResponse.redirect(url);
  }

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
