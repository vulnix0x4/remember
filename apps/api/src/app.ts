import { askRequestSchema, captureRequestSchema, connectionTypeSchema, itemStatusSchema } from "@remember/domain";
import { Hono } from "hono";
import { z } from "zod";
import { authenticate, clearedSessionCookie, createPasswordSession, ensureUser, passwordSessionToken, revokePasswordSession, sessionCookie, timingSafeEqual, verifyPassword } from "./auth";
import { EvolutionService } from "./evolution";
import { ExportService, exportRequestSchema } from "./exports";
import { ApiError, jsonError, readJson, safeErrorMessage } from "./http";
import { runIngestion } from "./processing";
import { encodeItemCursor, publicItem, Repository } from "./repository";
import { parseSearch, SearchService } from "./search";
import type { AppVariables } from "./types";
import { UnsafeUrlError, canonicalizeSourceUrl } from "@remember/domain";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();
const uuidParamSchema = z.uuid();
const connectionRequestSchema = z.object({
  fromItemId: z.uuid(),
  toItemId: z.uuid(),
  type: connectionTypeSchema,
  explanation: z.string().trim().min(1).max(2_000),
});
const resurfacingResponseSchema = z.object({
  response: z.enum(["still_true", "changed_mind", "not_sure", "no_longer_relevant"]),
});
const retryRequestSchema = z.object({ sourceText: z.string().trim().min(1).max(160_000).optional() });
const principleStatusSchema = z.object({ status: z.enum(["candidate", "active", "dismissed"]) });
const loginRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(1_024),
});

async function markWorkflowStartFailure(repository: Repository, itemId: string, error: unknown): Promise<void> {
  console.error(JSON.stringify({ message: "ingestion workflow could not start", itemId, error: safeErrorMessage(error) }));
  await repository.markFailed(itemId, "Analysis could not start. Your source is saved safely and can be retried.");
}

app.use("*", async (context, next) => {
  const requestId = context.req.header("cf-ray") ?? crypto.randomUUID();
  context.set("requestId", requestId);
  const origin = context.req.header("origin");
  if (context.req.method === "OPTIONS") {
    if (origin === context.env.CORS_ORIGIN) {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,content-type,idempotency-key,x-dev-user-id,x-confirm-delete",
          "access-control-max-age": "86400",
          vary: "Origin",
        },
      });
    }
    return new Response(null, { status: 204 });
  }
  await next();
  context.header("x-request-id", requestId);
  context.header("x-content-type-options", "nosniff");
  context.header("x-frame-options", "DENY");
  context.header("referrer-policy", "no-referrer");
  context.header("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  context.header("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  context.header("cache-control", "private, no-store");
  if (origin === context.env.CORS_ORIGIN) {
    context.header("access-control-allow-origin", origin);
    context.header("vary", "Origin");
  }
});

app.get("/", (context) => context.json({ name: "Remember API", version: 1 }));
app.get("/health", (context) => context.json({ status: "ok", environment: context.env.ENVIRONMENT }));
app.get("/contract", (context) =>
  context.json({ apiVersion: 1, basePaths: ["/api", "/api/v1"], duplicateFields: ["deduplicated", "duplicate"] }),
);

app.post("/api/auth/login", async (context) => {
  if (String(context.env.AUTH_MODE) !== "password") throw new ApiError(404, "not_found", "Route not found.");
  const requestOrigin = context.req.header("origin");
  if (requestOrigin && requestOrigin !== context.env.CORS_ORIGIN) throw new ApiError(403, "origin_mismatch", "The sign-in origin is not allowed.");
  const body = await readJson(context.req.raw, loginRequestSchema, 8_192);
  const actor = `login:${context.req.header("cf-connecting-ip") ?? "unknown"}`;
  await new Repository(context.env.DB).rateLimit(actor, "login", 10, 15 * 60);
  const emailMatches = await timingSafeEqual(
    body.email.trim().toLocaleLowerCase("en-US"),
    context.env.LOGIN_EMAIL?.trim().toLocaleLowerCase("en-US") ?? "",
  );
  const passwordMatches = await verifyPassword(body.password, context.env.LOGIN_PASSWORD_HASH);
  if (!emailMatches || !passwordMatches || !context.env.LOGIN_EMAIL) throw new ApiError(401, "invalid_credentials", "The email or password is incorrect.");
  await ensureUser(context.env.DB, context.env.DEFAULT_USER_ID);
  const token = await createPasswordSession(context.env, context.env.LOGIN_EMAIL);
  context.header("set-cookie", sessionCookie(token, context.env.ENVIRONMENT === "production"));
  return context.json({ user: { id: context.env.DEFAULT_USER_ID, mode: "password", email: context.env.LOGIN_EMAIL } });
});

app.post("/api/auth/logout", async (context) => {
  const requestOrigin = context.req.header("origin");
  if (requestOrigin && requestOrigin !== context.env.CORS_ORIGIN) throw new ApiError(403, "origin_mismatch", "The sign-out origin is not allowed.");
  await revokePasswordSession(context.env, passwordSessionToken(context.req.header("cookie")));
  context.header("set-cookie", clearedSessionCookie(context.env.ENVIRONMENT === "production"));
  return context.body(null, 204);
});

api.use("*", authenticate);

api.get("/session", (context) => {
  const user = context.get("user");
  if (!user) return context.json({ user: null });
  return context.json({ user: { id: user.id, mode: user.mode, email: user.email ?? null } });
});

api.post("/items", async (context) => {
  const userId = context.get("user").id;
  const repository = new Repository(context.env.DB);
  await repository.rateLimit(userId, "capture", 120, 3_600);
  const body = await readJson(context.req.raw, captureRequestSchema, 196_608);
  let source;
  try {
    source = canonicalizeSourceUrl(body.url);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new ApiError(422, error.code, error.message);
    throw error;
  }
  if (context.env.ENVIRONMENT === "production" && source.canonicalUrl.startsWith("http:")) {
    throw new ApiError(422, "https_required", "Remember only saves secure HTTPS links in production.");
  }
  const idempotencyKey = context.req.header("idempotency-key") ?? null;
  if (idempotencyKey && (!/^[A-Za-z0-9._:-]{1,200}$/.test(idempotencyKey) || idempotencyKey.length > 200)) {
    throw new ApiError(422, "invalid_idempotency_key", "Idempotency-Key contains unsupported characters or is too long.");
  }
  const savedAt = body.savedAt ?? new Date().toISOString();
  const result = await repository.capture(userId, source, body.personalReaction ?? null, savedAt, idempotencyKey);
  if (result.created) {
    if (String(context.env.PROCESSING_MODE) === "direct") {
      await runIngestion(context.env, { itemId: result.row.id, userId, ...(body.sourceText ? { sourceText: body.sourceText } : {}) });
    } else {
      try {
        const workflow = await context.env.INGESTION_WORKFLOW.create({
          id: `ingest-${result.row.id}`,
          params: { itemId: result.row.id, userId, ...(body.sourceText ? { sourceText: body.sourceText } : {}) },
        });
        await repository.recordWorkflow(result.row.id, workflow.id);
      } catch (error) {
        if (context.env.ENVIRONMENT === "development") {
          console.error(JSON.stringify({ message: "workflow unavailable; using local request context fallback", error: safeErrorMessage(error) }));
          context.executionCtx.waitUntil(runIngestion(context.env, { itemId: result.row.id, userId, ...(body.sourceText ? { sourceText: body.sourceText } : {}) }));
        } else {
          await markWorkflowStartFailure(repository, result.row.id, error);
        }
      }
    }
  }
  const currentRow = result.created ? await repository.requireItem(userId, result.row.id) : result.row;
  return context.json(
    { item: publicItem(currentRow), deduplicated: !result.created, duplicate: !result.created },
    result.created ? 202 : 200,
  );
});

api.get("/items", async (context) => {
  const limit = z.coerce.number().int().min(1).max(100).catch(30).parse(context.req.query("limit"));
  const cursor = context.req.query("cursor") ?? null;
  const statusValue = context.req.query("status");
  const status = statusValue ? itemStatusSchema.parse(statusValue) : null;
  const rows = await new Repository(context.env.DB).listItems(context.get("user").id, limit + 1, cursor, status);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return context.json({ items: page.map(publicItem), nextCursor: hasMore && page.length ? encodeItemCursor(page[page.length - 1]!) : null });
});

api.get("/items/:id", async (context) => {
  const itemId = uuidParamSchema.parse(context.req.param("id"));
  const repository = new Repository(context.env.DB);
  const userId = context.get("user").id;
  const [item, connections, principles] = await Promise.all([
    repository.requireItem(userId, itemId),
    repository.listConnections(userId, itemId),
    repository.listPrinciplesForItem(userId, itemId),
  ]);
  return context.json({ item: publicItem(item), connections, principles });
});

api.patch("/principles/:id", async (context) => {
  const principleId = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, principleStatusSchema);
  await new Repository(context.env.DB).updatePrincipleStatus(context.get("user").id, principleId, body.status);
  return context.json({ updated: true, status: body.status });
});

api.post("/items/:id/retry", async (context) => {
  const itemId = uuidParamSchema.parse(context.req.param("id"));
  const userId = context.get("user").id;
  const repository = new Repository(context.env.DB);
  const body = context.req.header("content-type")?.startsWith("application/json") ? await readJson(context.req.raw, retryRequestSchema, 180_000) : {};
  const item = await repository.queueRetry(userId, itemId);
  try {
    const workflow = await context.env.INGESTION_WORKFLOW.create({ id: `retry-${item.id}-${Date.now()}`, params: { itemId, userId, ...(body.sourceText ? { sourceText: body.sourceText } : {}) } });
    await repository.recordWorkflow(itemId, workflow.id);
    return context.json({ item: publicItem(item) }, 202);
  } catch (error) {
    await markWorkflowStartFailure(repository, itemId, error);
    const failed = await repository.requireItem(userId, itemId);
    return context.json({ item: publicItem(failed) }, 202);
  }
});

api.get("/search", async (context) => {
  const request = parseSearch(new URL(context.req.url));
  const items = await new SearchService(context.env).search(context.get("user").id, request.query, request.limit);
  return context.json({ items, query: request.query });
});

api.post("/ask", async (context) => {
  const userId = context.get("user").id;
  const repository = new Repository(context.env.DB);
  await repository.rateLimit(userId, "ask", 60, 60);
  const request = await readJson(context.req.raw, askRequestSchema, 32_768);
  return context.json(await new SearchService(context.env).ask(userId, request.question, request.threadId));
});

api.get("/connections", async (context) => {
  const itemId = context.req.query("itemId");
  if (itemId) uuidParamSchema.parse(itemId);
  return context.json({ connections: await new Repository(context.env.DB).listConnections(context.get("user").id, itemId) });
});

api.post("/connections", async (context) => {
  const request = await readJson(context.req.raw, connectionRequestSchema);
  await new Repository(context.env.DB).addConnection(
    context.get("user").id,
    request.fromItemId,
    request.toItemId,
    request.type,
    request.explanation,
  );
  return context.json({ created: true }, 201);
});

api.get("/evolution", async (context) => context.json(await new EvolutionService(context.env.DB).overview(context.get("user").id)));
api.get("/resurfacing/today", async (context) =>
  context.json({ memory: await new EvolutionService(context.env.DB).resurfaced(context.get("user").id) }),
);
api.post("/resurfacing/:id/respond", async (context) => {
  const eventId = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, resurfacingResponseSchema);
  await new EvolutionService(context.env.DB).respond(context.get("user").id, eventId, body.response);
  return context.json({ recorded: true });
});

api.post("/exports", async (context) => {
  const request = await readJson(context.req.raw, exportRequestSchema);
  return context.json(await new ExportService(context.env).create(context.get("user").id, request.format), 201);
});
api.get("/exports/:id", async (context) =>
  new ExportService(context.env).download(context.get("user").id, uuidParamSchema.parse(context.req.param("id"))),
);

api.delete("/account/data", async (context) => {
  if (context.req.header("x-confirm-delete") !== "DELETE MY DATA") {
    throw new ApiError(422, "confirmation_required", "Set X-Confirm-Delete to DELETE MY DATA to confirm.");
  }
  const userId = context.get("user").id;
  const vectorRows = await context.env.DB.prepare("SELECT id FROM items WHERE user_id = ?1").bind(userId).all<{ id: string }>();
  if (vectorRows.results.length && String(context.env.ANALYSIS_PROVIDER) !== "mock") {
    await context.env.VECTOR_INDEX.deleteByIds(vectorRows.results.map((row) => row.id));
  }
  let cursor: string | undefined;
  do {
    const listed = await context.env.MEDIA.list({ prefix: `exports/${userId}/`, ...(cursor ? { cursor } : {}) });
    if (listed.objects.length) await context.env.MEDIA.delete(listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(userId),
    context.env.DB.prepare("DELETE FROM sources WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.source_id = sources.id)"),
  ]);
  return context.body(null, 204);
});

app.route("/api", api);
app.route("/api/v1", api);

app.notFound((context) => context.json({ error: { code: "not_found", message: "Route not found." }, requestId: context.get("requestId") }, 404));
app.onError((error, context) => {
  console.error(
    JSON.stringify({ message: "request failed", requestId: context.get("requestId"), path: context.req.path, error: safeErrorMessage(error) }),
  );
  return jsonError(error, context.get("requestId"));
});

export { app };
