import {
  askRequestSchema,
  autopilotRequestSchema,
  brainSettingsSchema,
  blockerReasonSchema,
  captureRequestSchema,
  connectionTypeSchema,
  decisionRequestSchema,
  createGoalSchema,
  createLifeFloorItemSchema,
  createCommitmentSchema,
  createTaskSchema,
  itemStatusSchema,
  practiceOutcomeSchema,
  returnCueUpdateSchema,
  updateGoalSchema,
  updateCommitmentSchema,
  updateTaskSchema,
  upsertCalendarEventSchema,
  upsertFinanceAccountSchema,
  upsertFinanceTransactionSchema,
  upsertHealthMetricSchema,
} from "@remember/domain";
import { Hono } from "hono";
import { z } from "zod";
import { authenticate, clearedSessionCookie, createPasswordSession, ensureUser, passwordSessionToken, revokePasswordSession, sessionCookie, timingSafeEqual, verifyPassword } from "./auth";
import { DeletionService } from "./deletion";
import { EvolutionService } from "./evolution";
import { ExportService, exportRequestSchema } from "./exports";
import { ApiError, jsonError, readJson, safeErrorMessage } from "./http";
import { LifeRepository } from "./life-repository";
import { buildAutopilotOptions, decideNextMove } from "./autopilot";
import { BrainService } from "./brain";
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
const contextualReturnResponseSchema = z.object({ response: z.enum(["useful", "not_today"]) });
const retryRequestSchema = z.object({ sourceText: z.string().trim().min(1).max(160_000).optional() });
const principleStatusSchema = z.object({ status: z.enum(["candidate", "active", "dismissed"]) });
const loginRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(1_024),
});
const practiceResultSchema = z.object({
  outcome: practiceOutcomeSchema,
  reflection: z.string().trim().max(2_000).default(""),
});
const completeTaskSchema = z.object({
  minutesSpent: z.number().int().min(0).max(1_440).default(0),
  result: practiceResultSchema.optional(),
});
const blockTaskSchema = z.object({ reason: blockerReasonSchema });
const floorToggleSchema = z.object({ date: z.iso.datetime({ offset: true }) });
const calendarSyncSchema = z.object({ events: z.array(upsertCalendarEventSchema).max(2_000) });
const healthSyncSchema = z.object({ metrics: z.array(upsertHealthMetricSchema).max(5_000) });
const accountSyncSchema = z.object({ accounts: z.array(upsertFinanceAccountSchema).max(500) });
const transactionSyncSchema = z.object({ transactions: z.array(upsertFinanceTransactionSchema).max(5_000) });

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

api.use("*", async (context, next) => {
  await next();
  if (!["POST", "PATCH", "DELETE"].includes(context.req.method) || context.res.status >= 400
    || /\/life\/(brain|autopilot)/.test(context.req.path)) return;
  if (!/\/api\/(life|items|principles)/.test(context.req.path)) return;
  const work = new BrainService(context.env).run(context.get("user").id).catch(() => undefined);
  try { context.executionCtx.waitUntil(work); } catch { await work; }
});

api.get("/life/brain", async (context) => context.json({ brain: await new BrainService(context.env).read(context.get("user").id) }));
api.post("/life/brain/sync", async (context) => {
  const body = await readJson(context.req.raw, z.object({ timeZone: brainSettingsSchema.shape.timeZone }));
  const userId = context.get("user").id;
  await new Repository(context.env.DB).rateLimit(userId, "brain_sync", 120, 60);
  const brain = new BrainService(context.env);
  await brain.initialize(userId, body.timeZone);
  return context.json({ brain: await brain.run(userId) });
});
api.patch("/life/brain", async (context) => {
  const settings = await readJson(context.req.raw, brainSettingsSchema);
  const brain = new BrainService(context.env);
  await brain.updateSettings(context.get("user").id, settings);
  return context.json({ brain: await brain.run(context.get("user").id) });
});

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
  const idempotencyKey = context.req.header("idempotency-key") ?? null;
  if (idempotencyKey && (!/^[A-Za-z0-9._:-]{1,200}$/.test(idempotencyKey) || idempotencyKey.length > 200)) {
    throw new ApiError(422, "invalid_idempotency_key", "Idempotency-Key contains unsupported characters or is too long.");
  }
  const savedAt = body.savedAt ?? new Date().toISOString();
  let result;
  let sourceText: string | undefined;
  if (body.thought) {
    result = await repository.captureThought(
      userId,
      body.thought,
      savedAt,
      idempotencyKey,
      body.returnCue ?? null,
      body.returnAt ?? null,
    );
    sourceText = body.thought;
  } else {
    let source;
    try {
      source = canonicalizeSourceUrl(body.url!);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new ApiError(422, error.code, error.message);
      throw error;
    }
    if (context.env.ENVIRONMENT === "production" && source.canonicalUrl.startsWith("http:")) {
      throw new ApiError(422, "https_required", "Remember only saves secure HTTPS links in production.");
    }
    result = await repository.capture(
      userId,
      source,
      body.personalReaction ?? null,
      savedAt,
      idempotencyKey,
      body.returnCue ?? null,
      body.returnAt ?? null,
    );
    sourceText = body.sourceText;
  }
  if (result.created) {
    if (String(context.env.PROCESSING_MODE) === "direct") {
      await runIngestion(context.env, { itemId: result.row.id, userId, ...(sourceText ? { sourceText } : {}) });
    } else {
      try {
        const workflow = await context.env.INGESTION_WORKFLOW.create({
          id: `ingest-${result.row.id}`,
          params: { itemId: result.row.id, userId, ...(sourceText ? { sourceText } : {}) },
        });
        await repository.recordWorkflow(result.row.id, workflow.id);
      } catch (error) {
        if (context.env.ENVIRONMENT === "development") {
          console.error(JSON.stringify({ message: "workflow unavailable; using local request context fallback", error: safeErrorMessage(error) }));
          context.executionCtx.waitUntil(runIngestion(context.env, { itemId: result.row.id, userId, ...(sourceText ? { sourceText } : {}) }));
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

api.patch("/items/:id/return-cue", async (context) => {
  const itemId = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, returnCueUpdateSchema);
  const item = await new Repository(context.env.DB).updateReturnCue(
    context.get("user").id,
    itemId,
    body.returnCue,
    body.returnAt,
  );
  return context.json({ item: publicItem(item) });
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

api.post("/decisions", async (context) => {
  const userId = context.get("user").id;
  const repository = new Repository(context.env.DB);
  await repository.rateLimit(userId, "decision", 30, 60);
  const request = await readJson(context.req.raw, decisionRequestSchema, 32_768);
  return context.json(await new SearchService(context.env).decide(userId, request.decision, request.context));
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
api.post("/items/:id/reflect", async (context) => {
  const itemId = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, resurfacingResponseSchema);
  const reflection = await new EvolutionService(context.env.DB).reflect(context.get("user").id, itemId, body.response);
  return context.json({ recorded: true, reflection });
});
api.post("/items/:id/contextual-return-feedback", async (context) => {
  const itemId = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, contextualReturnResponseSchema);
  const feedback = await new EvolutionService(context.env.DB).rateContextualReturn(context.get("user").id, itemId, body.response);
  return context.json({ recorded: true, feedback });
});

api.get("/life", async (context) => {
  const userId = context.get("user").id;
  const repository = new LifeRepository(context.env.DB);
  await repository.materializeCommitments(userId, await repository.timeZone(userId));
  return context.json(await repository.snapshot(userId));
});

api.post("/life/commitments", async (context) => {
  const userId = context.get("user").id;
  const body = await readJson(context.req.raw, createCommitmentSchema);
  const repository = new LifeRepository(context.env.DB);
  return context.json({ commitment: await repository.createCommitment(userId, body, await repository.timeZone(userId)) }, 201);
});

api.patch("/life/commitments/:id", async (context) => {
  const userId = context.get("user").id;
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, updateCommitmentSchema);
  const repository = new LifeRepository(context.env.DB);
  return context.json({ commitment: await repository.updateCommitment(userId, id, body, await repository.timeZone(userId)) });
});

api.delete("/life/commitments/:id", async (context) => {
  const userId = context.get("user").id;
  const id = uuidParamSchema.parse(context.req.param("id"));
  const repository = new LifeRepository(context.env.DB);
  await repository.deleteCommitment(userId, id, await repository.timeZone(userId));
  return context.body(null, 204);
});

api.post("/life/autopilot", async (context) => {
  const userId = context.get("user").id;
  await new Repository(context.env.DB).rateLimit(userId, "autopilot", 30, 60);
  const input = await readJson(context.req.raw, autopilotRequestSchema);
  const repository = new LifeRepository(context.env.DB);
  const snapshot = await repository.snapshot(userId);
  const decision = await decideNextMove(snapshot, input, context.env.OPENROUTER_API_KEY);
  if (input.startFocus && decision.disposition === "decided" && decision.selected.kind === "task") {
    const task = snapshot.tasks.find((task) => task.id === decision.selected.id)!;
    const fresh = await repository.snapshot(userId);
    if (!buildAutopilotOptions(fresh, input).options.some((option) => option.id === task.id)) {
      throw new ApiError(409, "plan_changed", "Your available time or plan changed. Ask Jev to choose again.");
    }
    await repository.startAutopilotFocus(userId, task.id, task.updatedAt, snapshot.tasks.find((task) => task.status === "active")?.id ?? null);
    decision.focusStarted = true;
  }
  return context.json(decision);
});

api.post("/life/goals", async (context) => {
  const body = await readJson(context.req.raw, createGoalSchema);
  return context.json({ goal: await new LifeRepository(context.env.DB).createGoal(context.get("user").id, body) }, 201);
});

api.patch("/life/goals/:id", async (context) => {
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, updateGoalSchema);
  return context.json({ goal: await new LifeRepository(context.env.DB).updateGoal(context.get("user").id, id, body) });
});

api.post("/life/tasks", async (context) => {
  const body = await readJson(context.req.raw, createTaskSchema);
  return context.json({ task: await new LifeRepository(context.env.DB).createTask(context.get("user").id, body) }, 201);
});

api.patch("/life/tasks/:id", async (context) => {
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, updateTaskSchema);
  return context.json({ task: await new LifeRepository(context.env.DB).updateTask(context.get("user").id, id, body) });
});

api.post("/life/tasks/:id/complete", async (context) => {
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, completeTaskSchema);
  return context.json(await new LifeRepository(context.env.DB).completeTask(context.get("user").id, id, body.minutesSpent, body.result));
});

api.post("/life/tasks/:id/reflect", async (context) => {
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, practiceResultSchema);
  return context.json({ task: await new LifeRepository(context.env.DB).reflectOnPractice(context.get("user").id, id, body) });
});

api.post("/life/tasks/:id/block", async (context) => {
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, blockTaskSchema);
  return context.json(await new LifeRepository(context.env.DB).blockTask(context.get("user").id, id, body.reason));
});

api.post("/life/floor", async (context) => {
  const body = await readJson(context.req.raw, createLifeFloorItemSchema);
  return context.json({ item: await new LifeRepository(context.env.DB).createFloorItem(context.get("user").id, body) }, 201);
});

api.post("/life/floor/:id/toggle", async (context) => {
  const id = uuidParamSchema.parse(context.req.param("id"));
  const body = await readJson(context.req.raw, floorToggleSchema);
  return context.json({ item: await new LifeRepository(context.env.DB).toggleFloor(context.get("user").id, id, body.date) });
});

api.post("/life/calendar/sync", async (context) => {
  const body = await readJson(context.req.raw, calendarSyncSchema, 2_000_000);
  return context.json(await new LifeRepository(context.env.DB).upsertCalendarEvents(context.get("user").id, body.events));
});

api.post("/life/health/sync", async (context) => {
  const body = await readJson(context.req.raw, healthSyncSchema, 4_000_000);
  return context.json(await new LifeRepository(context.env.DB).upsertHealthMetrics(context.get("user").id, body.metrics));
});

api.post("/life/finance/accounts/sync", async (context) => {
  const body = await readJson(context.req.raw, accountSyncSchema, 1_000_000);
  return context.json(await new LifeRepository(context.env.DB).upsertFinanceAccounts(context.get("user").id, body.accounts));
});

api.post("/life/finance/transactions/sync", async (context) => {
  const body = await readJson(context.req.raw, transactionSyncSchema, 4_000_000);
  return context.json(await new LifeRepository(context.env.DB).upsertFinanceTransactions(context.get("user").id, body.transactions));
});

api.post("/life/files", async (context) => {
  const userId = context.get("user").id;
  const declaredLength = Number(context.req.header("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 26 * 1_024 * 1_024) throw new ApiError(422, "file_too_large", "Files must be 25 MB or smaller.");
  const form = await context.req.raw.formData();
  const upload = form.get("file");
  if (!(upload instanceof File)) throw new ApiError(422, "file_required", "Choose a file to upload.");
  if (upload.size > 25 * 1_024 * 1_024) throw new ApiError(422, "file_too_large", "Files must be 25 MB or smaller.");
  const name = upload.name.trim().slice(0, 500) || "Untitled file";
  const mimeType = (upload.type || "application/octet-stream").slice(0, 200);
  const folder = String(form.get("folder") ?? "").trim().slice(0, 500);
  const summary = String(form.get("summary") ?? "").trim().slice(0, 5_000);
  const tags = [...new Set(String(form.get("tags") ?? "").split(",").map((tag) => tag.trim().slice(0, 80)).filter(Boolean))].slice(0, 50);
  const objectKey = `vault/${userId}/${crypto.randomUUID()}`;
  await context.env.MEDIA.put(objectKey, upload.stream(), {
    httpMetadata: { contentType: mimeType },
    customMetadata: { originalName: name },
  });
  try {
    const result = await new LifeRepository(context.env.DB).addFile(userId, {
      name,
      mimeType,
      sizeBytes: upload.size,
      objectKey,
      folder,
      tags,
      summary,
    });
    return context.json({ file: result.record }, 201);
  } catch (error) {
    await context.env.MEDIA.delete(objectKey);
    throw error;
  }
});

api.get("/life/files/:id/download", async (context) => {
  const file = await new LifeRepository(context.env.DB).requireFile(context.get("user").id, uuidParamSchema.parse(context.req.param("id")));
  const object = await context.env.MEDIA.get(file.objectKey);
  if (!object) throw new ApiError(404, "not_found", "File contents are unavailable.");
  return new Response(object.body, {
    headers: {
      "content-type": file.record.mimeType,
      "content-length": String(file.record.sizeBytes),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.record.name)}`,
      "cache-control": "private, no-store",
    },
  });
});

api.delete("/life/files/:id", async (context) => {
  const deletion = new DeletionService(context.env);
  const job = await deletion.stageVaultFile(context.get("user").id, uuidParamSchema.parse(context.req.param("id")));
  if (job) await deletion.tryProcess(job);
  return context.body(null, 204);
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
  const deletion = new DeletionService(context.env);
  const job = await deletion.stageAccount(userId);
  await deletion.tryProcess(job);
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
