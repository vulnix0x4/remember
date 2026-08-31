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

    const logout = await app.request("https://remember.example.com/api/auth/logout", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] ?? "", origin: "https://remember.example.com" },
    }, passwordEnv);
    expect(logout.status).toBe(204);
    const revoked = await app.request("https://remember.example.com/api/session", { headers: { cookie: cookie.split(";")[0] ?? "" } }, passwordEnv);
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toEqual({ user: null });
  });

  it("sets browser security headers on API responses", async () => {
    const response = await request("/api/items", { headers: { "x-dev-user-id": userId } });
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
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

  it("runs the Reset task loop with one active move and blocker recovery", async () => {
    const lifeUser = "50000000-0000-4000-8000-000000000005";
    const headers = { "content-type": "application/json", "x-dev-user-id": lifeUser };
    const firstResponse = await request("/api/life/tasks", {
      method: "POST", headers,
      body: JSON.stringify({ title: "Build the first screen", firstStep: "Open the project", area: "work", status: "queued", priority: "high", durationMinutes: 30 }),
    });
    expect(firstResponse.status).toBe(201);
    const first = await firstResponse.json() as { task: { id: string; status: string } };
    expect(first.task.status).toBe("active");

    const secondResponse = await request("/api/life/tasks", {
      method: "POST", headers,
      body: JSON.stringify({ title: "Send it to one person", firstStep: "Open Messages", area: "work", status: "queued", priority: "normal", durationMinutes: 10 }),
    });
    const second = await secondResponse.json() as { task: { id: string; status: string } };
    expect(second.task.status).toBe("queued");

    const blockedResponse = await request(`/api/life/tasks/${first.task.id}/block`, {
      method: "POST", headers, body: JSON.stringify({ reason: "big" }),
    });
    expect(blockedResponse.status).toBe(200);
    expect(await blockedResponse.json()).toMatchObject({ task: { durationMinutes: 5, status: "active" } });

    const completedResponse = await request(`/api/life/tasks/${first.task.id}/complete`, {
      method: "POST", headers, body: JSON.stringify({ minutesSpent: 4 }),
    });
    expect(completedResponse.status).toBe(200);
    expect(await completedResponse.json()).toMatchObject({ task: { status: "done" }, next: { id: second.task.id, status: "active" } });

    const floorResponse = await request("/api/life/floor", {
      method: "POST", headers, body: JSON.stringify({ title: "Take medication", area: "health", target: 1, unit: "time" }),
    });
    expect(floorResponse.status).toBe(201);
    const floor = await floorResponse.json() as { item: { id: string } };
    const floorDate = "2026-08-31T12:00:00.000Z";
    expect((await request(`/api/life/floor/${floor.item.id}/toggle`, { method: "POST", headers, body: JSON.stringify({ date: floorDate }) })).status).toBe(200);

    const snapshot = await request("/api/life", { headers: { "x-dev-user-id": lifeUser } });
    expect(snapshot.status).toBe(200);
    const body = await snapshot.json() as { tasks: Array<{ id: string; status: string }>; blockers: Array<{ reason: string }> };
    expect(body.tasks.find((task) => task.status === "active")).toMatchObject({ id: second.task.id });
    expect(body.blockers).toContainEqual(expect.objectContaining({ reason: "big" }));
    const floorItem = (body as typeof body & { floor: Array<{ completionDates: string[] }> }).floor[0];
    if (!floorItem) throw new Error("Life Floor item missing from snapshot.");
    expect(floorItem.completionDates).toEqual([floorDate]);
  });

  it("syncs calendar, health, and finance data into one private snapshot", async () => {
    const lifeUser = "60000000-0000-4000-8000-000000000006";
    const headers = { "content-type": "application/json", "x-dev-user-id": lifeUser };
    const startAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const endAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    expect((await request("/api/life/calendar/sync", { method: "POST", headers, body: JSON.stringify({ events: [{ externalId: "apple-event-1", source: "apple", calendarName: "Personal", title: "Flight", notes: "", location: "LAS", url: null, startAt, endAt, allDay: false, status: "confirmed" }] }) })).status).toBe(200);
    expect((await request("/api/life/health/sync", { method: "POST", headers, body: JSON.stringify({ metrics: [{ externalId: "steps-1", type: "steps", value: 7_500, unit: "count", startAt, endAt, source: "Apple Health", metadata: {} }] }) })).status).toBe(200);
    const accountResponse = await request("/api/life/finance/accounts/sync", { method: "POST", headers, body: JSON.stringify({ accounts: [{ externalId: "checking-1", name: "Checking", institution: "Bank", type: "checking", balance: 1250, currency: "USD", source: "provider", lastSyncedAt: startAt }] }) });
    expect(accountResponse.status).toBe(200);
    const accountBody = await accountResponse.json() as { accounts: Array<{ id: string }> };
    const syncedAccount = accountBody.accounts[0];
    if (!syncedAccount) throw new Error("Synced account missing from response.");
    expect((await request("/api/life/finance/transactions/sync", { method: "POST", headers, body: JSON.stringify({ transactions: [{ accountId: syncedAccount.id, externalId: "transaction-1", name: "Groceries", merchant: "Market", amount: -42.5, currency: "USD", category: "Food", occurredAt: startAt, status: "posted", notes: "" }] }) })).status).toBe(200);
    const snapshot = await request("/api/life", { headers: { "x-dev-user-id": lifeUser } });
    expect(await snapshot.json()).toMatchObject({ events: [{ title: "Flight" }], health: [{ type: "steps", value: 7_500 }], accounts: [{ name: "Checking", balance: 1250 }], transactions: [{ accountId: syncedAccount.id, amount: -42.5 }] });
  });

  it("uploads and downloads a private vault file", async () => {
    const lifeUser = "70000000-0000-4000-8000-000000000007";
    const form = new FormData();
    form.set("file", new File(["private plan"], "plan.txt", { type: "text/plain" }));
    form.set("tags", "plan,private");
    const upload = await request("/api/life/files", { method: "POST", headers: { "x-dev-user-id": lifeUser }, body: form });
    expect(upload.status).toBe(201);
    const payload = await upload.json() as { file: { id: string; name: string; tags: string[] } };
    expect(payload.file).toMatchObject({ name: "plan.txt", tags: ["plan", "private"] });
    const download = await request(`/api/life/files/${payload.file.id}/download`, { headers: { "x-dev-user-id": lifeUser } });
    expect(download.status).toBe(200);
    expect(await download.text()).toBe("private plan");
    const otherUser = "71000000-0000-4000-8000-000000000007";
    expect((await request(`/api/life/files/${payload.file.id}/download`, { headers: { "x-dev-user-id": otherUser } })).status).toBe(404);
    expect((await request(`/api/life/files/${payload.file.id}`, { method: "DELETE", headers: { "x-dev-user-id": lifeUser } })).status).toBe(204);
    expect((await request(`/api/life/files/${payload.file.id}/download`, { headers: { "x-dev-user-id": lifeUser } })).status).toBe(404);
  });
});
