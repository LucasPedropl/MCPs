import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getSessionSecret,
  isAuthConfigured,
  verifySessionToken,
} from "@/lib/dashboard-auth";

export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json({
      authenticated: false,
      configured: false,
      email: null,
      provider: "supabase_auth",
    });
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json({
      authenticated: false,
      configured: false,
      email: null,
      provider: "supabase_auth",
    });
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token, secret);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      configured: true,
      email: null,
      provider: "supabase_auth",
    });
  }

  return NextResponse.json({
    authenticated: true,
    configured: true,
    email: session.email,
    provider: "supabase_auth",
  });
}
