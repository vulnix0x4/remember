import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, createTaskSchema, type LifeSnapshot, type Task } from "@remember/domain";
import { judgeTasks, scheduleTasks, type TaskJudgment } from "../src/brain-planner";
import { BrainService } from "../src/brain";
import { LifeRepository } from "../src/life-repository";
import { app } from "../src/app";

const now = new Date("2026-09-19T16:00:00Z");
const settings = brainSettingsSchema.parse({ timeZone: "America/Denver" });
const empty = (): LifeSnapshot => ({ tasks: [], goals: [], floor: [], events: [], blockers: [], health: [], accounts: [], transactions: [], files: [] });
function task(patch: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: "Laundry", firstStep: "Collect clothes", notes: "", goalId: null, area: "environment", status: "queued", priority: "normal", energy: "any", durationMinutes: 30, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", sourceItemId: null, practiceOutcome: null, practiceReflection: "", reflectedAt: null, completedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...patch };
}
const judgment = (task: Task, patch: Partial<TaskJudgment> = {}): TaskJudgment => ({ taskId: task.id, score: 3, confidence: .95, period: "any", ...patch });
const provider = () => vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
  const body = JSON.parse(init!.body as string);
  return Response.json({ model: "typesafe/jev-1.13", answers: Object.fromEntries(Object.keys(body.questions).map((key) => [key, key.startsWith("priority") ? { type: "score", score: 3, confidence: .95 } : { type: "choice", choice: "any", confidence: .9 }])) });
});
async function setup() {
  const userId = crypto.randomUUID();
  await app.request("https://remember.test/api/life", { headers: { "x-dev-user-id": userId } }, env);
  const fetcher = provider();
  const brain = new BrainService({ ...env, OPENROUTER_API_KEY: "test-key" }, fetcher);
  await brain.initialize(userId, settings.timeZone);
  return { userId, brain, fetcher, repository: new LifeRepository(env.DB) };
}

describe("Jev scheduling", () => {
  it("uses OpenRouter decisions and rejects incomplete answers", async () => {
    const snapshot = { ...empty(), tasks: [task()] }; const fetcher = provider();
    const result = await judgeTasks(snapshot, settings, { principles: ["Protect my mornings"], thoughts: [] }, "key", now, fetcher);
    expect(result.judgments).toEqual([judgment(snapshot.tasks[0]!)]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(JSON.parse(init!.body as string)).toMatchObject({ model: "typesafe/jev-1.13", state: { principles: ["Protect my mornings"] } });
    fetcher.mockResolvedValueOnce(Response.json({ model: "typesafe/jev-1.13", answers: {} }));
    await expect(judgeTasks(snapshot, settings, { principles: [], thoughts: [] }, "key", now, fetcher)).rejects.toMatchObject({ code: "jev_invalid_response" });
  });
  it("fits priorities around timed commitments, repeat release dates, and uncertain tasks", () => {
    const a = task(); const b = task({ notBefore: "2026-09-20T16:00:00Z" }); const c = task();
    const snapshot = { ...empty(), tasks: [a, b, c] };
    snapshot.events = [{ id: crypto.randomUUID(), externalId: null, source: "manual", calendarName: "Home", title: "Meeting", notes: "", location: "", url: null, startAt: "2026-09-19T16:00:00Z", endAt: "2026-09-19T17:00:00Z", allDay: false, status: "confirmed", createdAt: now.toISOString(), updatedAt: now.toISOString() }];
    const plan = scheduleTasks(snapshot, settings, [judgment(a), judgment(b), judgment(c, { confidence: .4 })], now);
    expect(plan).toHaveLength(2);
    expect(plan.find((block) => block.taskId === a.id)?.startAt).toBe("2026-09-19T17:15:00.000Z");
    expect(Date.parse(plan.find((block) => block.taskId === b.id)!.startAt)).toBeGreaterThanOrEqual(Date.parse(b.notBefore!));
  });
  it("honors local hours across daylight saving and leaves active work alone", () => {
    const active = task({ status: "active", durationMinutes: 60 }); const next = task();
    const dstNow = new Date("2026-11-01T14:30:00Z"); // 7:30 after Denver changes clocks.
    const plan = scheduleTasks({ ...empty(), tasks: [active, next] }, settings, [judgment(next)], dstNow);
    expect(plan[0]!.startAt).toBe("2026-11-01T15:30:00.000Z");
    expect(plan.some((block) => block.taskId === active.id)).toBe(false);
  });
  it("plans a day that runs past midnight", () => {
    const nightOwl = brainSettingsSchema.parse({ timeZone: "America/Denver", startHour: 12, endHour: 3 });
    const next = task();
    // 1:00 AM local is still inside a noon-to-3 AM day.
    expect(scheduleTasks({ ...empty(), tasks: [next] }, nightOwl, [judgment(next)], new Date("2026-09-20T07:00:00Z"))[0]!.startAt).toBe("2026-09-20T07:00:00.000Z");
    // At 2:40 AM a 30-minute task no longer fits before 3 AM, so it waits for the first slot after noon.
    expect(scheduleTasks({ ...empty(), tasks: [next] }, nightOwl, [judgment(next)], new Date("2026-09-20T08:40:00Z"))[0]!.startAt).toBe("2026-09-20T18:10:00.000Z");
    // Morning hours outside the day are skipped.
    expect(scheduleTasks({ ...empty(), tasks: [next] }, nightOwl, [judgment(next)], now)[0]!.startAt).toBe("2026-09-19T18:00:00.000Z");
  });
  it("keeps manual time slots fixed and applies Jev's preferred part of day", () => {
    const manual = task({ scheduledStart: "2026-09-19T23:00:00Z", scheduledEnd: "2026-09-19T23:30:00Z" }); const next = task();
    const plan = scheduleTasks({ ...empty(), tasks: [manual, next] }, settings, [judgment(next, { period: "evening" })], now);
    expect(plan[0]!.taskId).toBe(manual.id);
    expect(plan[1]!.startAt).toBe("2026-09-19T23:30:00.000Z");
  });
});

describe("persistent automatic planning", () => {
  it("activates a confident next task, caches the plan, and creates exactly one next chore", async () => {
    const { userId, brain, fetcher, repository } = await setup();
    const laundry = await repository.createTask(userId, createTaskSchema.parse({ title: "Laundry", status: "queued", repeatEveryDays: 7 }));
    expect(laundry.status).toBe("queued");
    const plan = await brain.run(userId, now);
    expect(plan?.status).toBe("ready");
    expect(plan?.plan[0]?.taskId).toBe(laundry.id);
    expect((await repository.snapshot(userId)).tasks.find((task) => task.id === laundry.id)?.status).toBe("active");
    await brain.run(userId, now); expect(fetcher).toHaveBeenCalledOnce();
    await repository.completeTask(userId, laundry.id); await repository.completeTask(userId, laundry.id);
    const tasks = (await repository.snapshot(userId)).tasks;
    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.status === "queued")).toMatchObject({ repeatEveryDays: 7, title: "Laundry" });
    expect(Date.parse(tasks.find((task) => task.status === "queued")!.notBefore!)).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect((await brain.read(userId))?.status).toBe("waiting");
  });
  it("does not commit stale context or paused settings during inference", async () => {
    const { userId, brain, fetcher, repository } = await setup();
    const laundry = await repository.createTask(userId, createTaskSchema.parse({ title: "Laundry" }));
    const normal = provider();
    fetcher.mockImplementationOnce(async (...args) => {
      await repository.updateTask(userId, laundry.id, { status: "waiting" });
      return normal(...args);
    });
    expect((await brain.run(userId, now))?.plan).toEqual([]);
    expect((await repository.snapshot(userId)).tasks[0]!.status).toBe("waiting");
    await repository.updateTask(userId, laundry.id, { status: "queued" });
    fetcher.mockImplementationOnce(async (...args) => {
      await brain.updateSettings(userId, { ...settings, enabled: false });
      return normal(...args);
    });
    expect((await brain.run(userId, now))?.status).toBe("paused");
    expect((await repository.snapshot(userId)).tasks[0]!.status).toBe("queued");
  });
  it("retains the last plan on failure, backs off, and keeps other users isolated", async () => {
    const { userId, brain, fetcher, repository } = await setup();
    await repository.createTask(userId, createTaskSchema.parse({ title: "Laundry", notBefore: "2026-09-20T16:00:00Z" }));
    const first = await brain.run(userId, now);
    await repository.createTask(userId, createTaskSchema.parse({ title: "Dishes" }));
    fetcher.mockRejectedValueOnce(new Error("offline"));
    const failed = await brain.run(userId, now);
    expect(failed?.status).toBe("unavailable"); expect(failed?.plan).toEqual(first?.plan);
    await brain.run(userId, now); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await brain.read(crypto.randomUUID())).toBeNull();
  });
  it("leases concurrent inference and prevents a conflicting manual slot from becoming active", async () => {
    const { userId, brain, fetcher, repository } = await setup();
    const candidate = await repository.createTask(userId, createTaskSchema.parse({ title: "Laundry" }));
    const normal = provider();
    fetcher.mockImplementationOnce(async (...args) => {
      await brain.run(userId, now);
      return normal(...args);
    });
    await brain.run(userId, now);
    expect(fetcher).toHaveBeenCalledOnce();
    await repository.updateTask(userId, candidate.id, { status: "queued", scheduledStart: now.toISOString(), scheduledEnd: "2026-09-19T17:00:00Z" });
    await env.DB.prepare(`INSERT INTO calendar_events (id,user_id,source,title,start_at,end_at,created_at,updated_at) VALUES (?1,?2,'manual','Meeting',?3,?4,?3,?3)`)
      .bind(crypto.randomUUID(), userId, now.toISOString(), "2026-09-19T17:00:00Z").run();
    await brain.run(userId, now);
    expect((await repository.snapshot(userId)).tasks[0]!.status).toBe("queued");
  });
  it("does not activate a future recurrence when automatic planning is paused", async () => {
    const { userId, brain, repository } = await setup();
    await brain.updateSettings(userId, { ...settings, enabled: false });
    const future = await repository.createTask(userId, createTaskSchema.parse({ title: "Future laundry", status: "queued", notBefore: new Date(Date.now() + 86_400_000).toISOString() }));
    expect(future.status).toBe("queued");
    const current = await repository.createTask(userId, createTaskSchema.parse({ title: "Current", status: "active" }));
    await repository.completeTask(userId, current.id);
    expect((await repository.snapshot(userId)).tasks.some((task) => task.status === "active")).toBe(false);
  });
  it("preserves preferences and pause when a device time zone changes", async () => {
    const { userId, brain } = await setup();
    await brain.updateSettings(userId, { ...settings, preferences: "Chores after work", enabled: false });
    await brain.initialize(userId, "Europe/London");
    expect((await brain.read(userId))?.settings).toMatchObject({ enabled: false, preferences: "Chores after work", timeZone: "Europe/London" });
  });
  it("requires authentication and rejects invalid planning hours", async () => {
    expect((await app.request("https://remember.test/api/life/brain/sync", { method: "POST" }, env)).status).toBe(401);
    const { userId } = await setup();
    const response = await app.request("https://remember.test/api/life/brain", { method: "PATCH", headers: { "x-dev-user-id": userId, "content-type": "application/json" }, body: JSON.stringify({ ...settings, startHour: 9, endHour: 9 }) }, env);
    expect(response.status).toBe(422);
  });
});
