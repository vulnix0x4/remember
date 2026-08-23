import type { MiddlewareHandler } from "hono";
import { Jwt } from "hono/utils/jwt";
import { ApiError } from "./http";
import type { AppVariables } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SESSION_COOKIE = "remember_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface PasswordSession {
  v: 1;
  sub: string;
  email: string;
  exp: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createPasswordSession(env: Env, email: string): Promise<string> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const payload: PasswordSession = {
    v: 1,
    sub: env.DEFAULT_USER_ID,
    email,
    exp: Math.floor(Date.now() / 1_000) + SESSION_TTL_SECONDS,
  };
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), new TextEncoder().encode(encoded));
  return `${encoded}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function readPasswordSession(env: Env, token: string): Promise<PasswordSession | null> {
  if (!env.SESSION_SECRET) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(env.SESSION_SECRET),
      base64UrlToBytes(signature),
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as Partial<PasswordSession>;
    if (payload.v !== 1 || payload.sub !== env.DEFAULT_USER_ID || typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1_000)) return null;
    return payload as PasswordSession;
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, encodedHash: string | undefined): Promise<boolean> {
  if (!encodedHash) return false;
  const [scheme, iterationsValue, saltValue, hashValue, extra] = encodedHash.split("$");
  const iterations = Number(iterationsValue);
  if (scheme !== "pbkdf2_sha256" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 100_000 || !saltValue || !hashValue || extra) return false;
  try {
    const passwordKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(saltValue), iterations },
      passwordKey,
      256,
    );
    const expected = base64UrlToBytes(hashValue);
    const actual = new Uint8Array(derived);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
    return difference === 0;
  } catch {
    return false;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function accessTeamDomain(value: string): string {
  const normalized = value.replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(normalized)) {
    throw new Error("ACCESS_TEAM_DOMAIN must be a Cloudflare Access team URL.");
  }
  return normalized;
}

async function authenticateAccess(context: Parameters<MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }>>[0]): Promise<void> {
  const token = context.req.header("cf-access-jwt-assertion");
  if (!token) throw new ApiError(401, "unauthorized", "A valid Cloudflare Access session is required.");
  const teamDomain = accessTeamDomain(context.env.ACCESS_TEAM_DOMAIN);
  let payload;
  try {
    payload = await Jwt.verifyWithJwks(token, {
      jwks_uri: `${teamDomain}/cdn-cgi/access/certs`,
      allowedAlgorithms: ["RS256"],
      verification: { iss: teamDomain, aud: context.env.ACCESS_AUD },
    });
  } catch {
    throw new ApiError(401, "unauthorized", "The Cloudflare Access session could not be verified.");
  }
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : undefined;
  if (!subject) throw new ApiError(401, "unauthorized", "The Cloudflare Access session has no user identity.");
  context.set("user", { id: `access:${subject}`, mode: "access", ...(email ? { email } : {}) });
  await ensureUser(context.env.DB, `access:${subject}`);
}

export const authenticate: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (context, next) => {
  const devUser = context.req.header("x-dev-user-id");
  const host = new URL(context.req.url).hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".test");
  if (context.env.ENVIRONMENT === "development" && context.env.ALLOW_DEV_AUTH === "true" && isLocalHost && devUser) {
    if (!UUID.test(devUser)) throw new ApiError(401, "invalid_dev_user", "Development user ID must be a UUID.");
    context.set("user", { id: devUser, mode: "development" });
    await ensureUser(context.env.DB, devUser);
    return next();
  }

  if (String(context.env.AUTH_MODE) === "access") {
    await authenticateAccess(context);
    return next();
  }

  if (String(context.env.AUTH_MODE) === "password") {
    const token = cookieValue(context.req.header("cookie"), SESSION_COOKIE);
    const session = token ? await readPasswordSession(context.env, token) : null;
    if (!session) throw new ApiError(401, "unauthorized", "Sign in to continue.");
    context.set("user", { id: session.sub, mode: "password", email: session.email });
    await ensureUser(context.env.DB, session.sub);
    return next();
  }

  const authorization = context.req.header("authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expected = context.env.AUTH_TOKEN;
  if (!provided || !expected || !(await timingSafeEqual(provided, expected))) {
    throw new ApiError(401, "unauthorized", "A valid bearer token is required.");
  }

  context.set("user", { id: context.env.DEFAULT_USER_ID, mode: "token" });
  await ensureUser(context.env.DB, context.env.DEFAULT_USER_ID);
  return next();
};

export async function ensureUser(db: D1Database, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO users (id, created_at, updated_at)
       VALUES (?1, ?2, ?2)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
    )
    .bind(userId, now)
    .run();
}
