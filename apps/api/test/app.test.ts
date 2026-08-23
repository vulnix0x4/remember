import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { publicProcessingError } from "../src/http";

const userId = "30000000-0000-4000-8000-000000000003";

function request(path: string, init?: RequestInit) {
  return app.request(`https://remember.test${path}`, init, env);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function passwordHash(password: string): Promise<string> {
  const salt = new TextEncoder().encode("remember-test-salt");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return `pbkdf2_sha256$100000$${base64Url(salt)}$${base64Url(new Uint8Array(hash))}`;
}

describe("HTTP API", () => {
  it("turns infrastructure timeouts into a safe retry message", () => {
    expect(publicProcessingError(new DOMException("The operation was aborted due to timeout", "TimeoutError")))
      .toBe("Analysis took longer than expected. Your source is saved safely and can be retried.");
  });

  it("explains when a TikTok post has no public caption", () => {
    expect(publicProcessingError(new Error("This TikTok post has no readable public caption.")))
      .toBe("This TikTok post has no readable public caption, so Remember cannot analyze it faithfully yet.");
  });

  it("rejects unauthenticated API requests", async () => {
    const response = await request("/api/items");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("validates unsafe capture URLs", async () => {
    const response = await request("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": userId },
      body: JSON.stringify({ url: "http://localhost:3000/private" }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "unsafe_url" } });
  });

  it("returns an empty grounded-search result without inventing sources", async () => {
    const response = await request("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": userId },
      body: JSON.stringify({ question: "What do I believe about uncertainty?" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ grounded: false, citations: [] });
  });

  it("keeps the capture duplicate aliases compatible", async () => {
    const headers = { "content-type": "application/json", "x-dev-user-id": userId };
    const body = JSON.stringify({ url: "https://example.com/contract-test" });
    const first = await request("/api/items", { method: "POST", headers, body });
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ deduplicated: false, duplicate: false });

    const second = await request("/api/items", { method: "POST", headers, body });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ deduplicated: true, duplicate: true });
  });

  it("never accepts the dev-session header on a live host", async () => {
    const response = await app.request("https://api.example.com/api/items", { headers: { "x-dev-user-id": userId } }, env);
    expect(response.status).toBe(401);
  });

  it("creates a secure password session without exposing credentials", async () => {
    const password = "test-password-only";
    const passwordEnv = {
      ...env,
      ENVIRONMENT: "production",
      AUTH_MODE: "password",
      CORS_ORIGIN: "https://remember.example.com",
      LOGIN_EMAIL: "owner@remember.test",
      LOGIN_PASSWORD_HASH: await passwordHash(password),
      SESSION_SECRET: "test-session-secret-that-is-at-least-thirty-two-characters",
    } as Env;
    const login = await app.request("https://remember.example.com/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://remember.example.com", "cf-connecting-ip": "192.0.2.44" },
      body: JSON.stringify({ email: "OWNER@remember.test", password }),
    }, passwordEnv);
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("remember_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain(password);

    const session = await app.request("https://remember.example.com/api/session", { headers: { cookie: cookie.split(";")[0] ?? "" } }, passwordEnv);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ user: { mode: "password", email: "owner@remember.test" } });
  });

  it("rejects invalid credentials with a generic response", async () => {
    const passwordEnv = {
      ...env,
      ENVIRONMENT: "production",
      AUTH_MODE: "password",
      CORS_ORIGIN: "https://remember.example.com",
      LOGIN_EMAIL: "owner@remember.test",
      LOGIN_PASSWORD_HASH: await passwordHash("correct-password"),
      SESSION_SECRET: "test-session-secret-that-is-at-least-thirty-two-characters",
    } as Env;
    const response = await app.request("https://remember.example.com/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://remember.example.com", "cf-connecting-ip": "192.0.2.45" },
      body: JSON.stringify({ email: "someone@example.com", password: "wrong-password" }),
    }, passwordEnv);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_credentials", message: "The email or password is incorrect." } });
  });
});
