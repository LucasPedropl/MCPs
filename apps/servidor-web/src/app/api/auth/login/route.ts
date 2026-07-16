import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_LONG_SEC,
  SESSION_MAX_AGE_SHORT_SEC,
  createSessionToken,
  getSessionSecret,
  isAuthConfigured,
  sessionCookieOptions,
} from "@/lib/dashboard-auth";
import { verifyDashboardCredentials } from "@/lib/dashboard-supabase-auth";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Auth não configurada. Configure Supabase (URL + anon + service role) e opcionalmente DASHBOARD_SESSION_SECRET.",
      },
      { status: 503 },
    );
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Session secret indisponível" },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown; remember?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember = Boolean(body.remember);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e senha são obrigatórios" },
      { status: 400 },
    );
  }

  const verified = await verifyDashboardCredentials(email, password);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const maxAge = remember ? SESSION_MAX_AGE_LONG_SEC : SESSION_MAX_AGE_SHORT_SEC;
  const token = await createSessionToken(verified.email, secret, maxAge);

  const response = NextResponse.json({
    ok: true,
    email: verified.email,
    remember,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(maxAge));
  return response;
}
