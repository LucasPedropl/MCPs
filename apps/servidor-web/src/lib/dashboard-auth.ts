/**
 * Dashboard auth — HMAC session cookie (Edge-compatible).
 * Login credentials live in Supabase Auth (not .env / localStorage).
 */

export const SESSION_COOKIE_NAME = "agent_os_session";

/** 12 hours */
export const SESSION_MAX_AGE_SHORT_SEC = 12 * 60 * 60;

/** ~400 days — teto prático dos browsers (Chrome); “indefinido” até logout. */
export const SESSION_MAX_AGE_LONG_SEC = 400 * 24 * 60 * 60;

export interface SessionPayload {
  email: string;
  exp: number;
}

// Static reads so Edge middleware / Turbopack include these env keys.
const ENV_SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;
const ENV_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENV_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ENV_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Secret used only to sign the session cookie (not the login password). */
export function getSessionSecret(): string | null {
  const explicit = ENV_SESSION_SECRET?.trim() ?? "";
  if (explicit.length >= 16) return explicit;

  const fallback = ENV_SERVICE_ROLE?.trim() ?? "";
  if (fallback.length >= 16) return fallback;

  return null;
}

export function isAuthConfigured(): boolean {
  const hasPublic =
    Boolean(ENV_SUPABASE_URL?.trim()) && Boolean(ENV_ANON_KEY?.trim());
  return hasPublic && getSessionSecret() !== null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function encodeJsonBase64Url(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJsonBase64Url<T>(value: string): T | null {
  try {
    const text = new TextDecoder().decode(fromBase64Url(value));
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Constant-time string compare (Edge-safe). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(
  email: string,
  secret: string,
  maxAgeSec: number,
): Promise<string> {
  const payload: SessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const body = encodeJsonBase64Url(payload);
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = await hmacSign(secret, body);
  if (!timingSafeEqualString(sig, expected)) return null;

  const payload = decodeJsonBase64Url<SessionPayload>(body);
  if (!payload || typeof payload.email !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function sessionCookieOptions(maxAgeSec: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  };
}
