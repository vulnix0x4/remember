import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { autopilotRequestSchema, createTaskSchema, type LifeSnapshot, type Task } from "@remember/domain";
import { buildAutopilotOptions, decideNextMove } from "../src/autopilot";
import { LifeRepository } from "../src/life-repository";
import { app } from "../src/app";

const now = new Date("2026-09-19T16:00:00Z");
const input = autopilotRequestSchema.parse({ timeZone: "America/Denver" });
const empty = (): LifeSnapshot => ({ tasks: [], goals: [], floor: [], events: [], blockers: [], health: [], accounts: [], transactions: [], files: [] });
function task(patch: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: "Write outline", firstStep: "Open notes", notes: "", goalId: null, area: "work", status: "queued", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", sourceItemId: null, practiceOutcome: null, practiceReflection: "", reflectedAt: null, completedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...patch };
}
function provider(choice: string, confidence = 0.92, probabilities: Record<string, number> = { [choice]: 0.95, pause: 0.05 }) {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json({ model: "typesafe/jev-1.13", answers: { next: { type: "choice", choice, confidence, probabilities } } }));
}

describe("Jev everyday decisions", () => {
  it("filters completed, waiting, future, too-long, high-energy, and rejected tasks", () => {
    const good = task();
    const excluded = task();
    const snapshot = { ...empty(), tasks: [good, excluded, task({ status: "done" }), task({ status: "waiting" }), task({ durationMinutes: 60 }), task({ energy: "high" }), task({ scheduledStart: "2026-09-20T10:00:00Z" })] };
    expect(buildAutopilotOptions(snapshot, { ...input, excludedIds: [excluded.id] }, now).options.map((option) => option.id)).toEqual([good.id, "pause"]);
  });

  it("protects a calendar buffer and an event already in progress", () => {
    const snapshot = empty(); snapshot.tasks = [task()];
    snapshot.events = [{ id: crypto.randomUUID(), externalId: null, source: "manual", calendarName: "Home", title: "Meeting", notes: "", location: "", url: null, startAt: "2026-09-19T16:18:00Z", endAt: "2026-09-19T17:00:00Z", allDay: false, status: "confirmed", createdAt: now.toISOString(), updatedAt: now.toISOString() }];
    expect(buildAutopilotOptions(snapshot, input, now)).toMatchObject({ availableMinutes: 13, options: [{ id: "pause" }] });
    expect(buildAutopilotOptions(snapshot, input, new Date("2026-09-19T16:30:00Z")).availableMinutes).toBe(0);
    snapshot.events[0]!.allDay = true;
    expect(buildAutopilotOptions(snapshot, input, now).availableMinutes).toBe(30);
  });

  it("uses the user's local day for routine completions", () => {
    const snapshot = empty();
    snapshot.floor = [{ id: crypto.randomUUID(), title: "Stretch", area: "health", target: 1, unit: "session", completionDates: ["2026-09-19T05:30:00Z"], createdAt: now.toISOString(), updatedAt: now.toISOString() }];
    expect(buildAutopilotOptions(snapshot, input, now).options.some((option) => option.kind === "routine")).toBe(true);
    snapshot.floor[0]!.completionDates = ["2026-09-19T07:00:00Z"];
    expect(buildAutopilotOptions(snapshot, input, now).options.some((option) => option.kind === "routine")).toBe(false);
  });

  it("uses documented Jev choices without transmitting private unrelated data", async () => {
    const chosen = task(); const fetcher = provider(chosen.id);
    const snapshot = { ...empty(), tasks: [{ ...chosen, notes: "private notes should stay private" }] };
    const result = await decideNextMove(snapshot, input, "test-key", fetcher, now);
    expect(result).toMatchObject({ disposition: "decided", focusStarted: false, selected: { id: chosen.id }, provider: "openrouter" });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(JSON.parse(init!.body as string)).toMatchObject({ model: "typesafe/jev-1.13", questions: { next: { type: "choice" } } });
    expect(init!.body).not.toContain("private notes");
    expect((await decideNextMove(snapshot, input, "test-key", provider(chosen.id, 0.6), now)).disposition).toBe("review");
  });

  it("fails closed on missing keys, forged choices, missing probabilities, and provider failure", async () => {
    const chosen = task(); const snapshot = { ...empty(), tasks: [chosen] };
    const fetcher = provider(chosen.id);
    await expect(decideNextMove(snapshot, input, undefined, fetcher, now)).rejects.toMatchObject({ code: "jev_not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(decideNextMove(snapshot, input, "key", provider("unknown"), now)).rejects.toMatchObject({ code: "jev_invalid_response" });
    await expect(decideNextMove(snapshot, input, "key", provider(chosen.id, 0.9, { [chosen.id]: 1 }), now)).rejects.toMatchObject({ code: "jev_invalid_response" });
    await expect(decideNextMove(snapshot, input, "key", vi.fn().mockResolvedValue(new Response("", { status: 429 })), now)).rejects.toMatchObject({ code: "jev_unavailable" });
  });

  it("requires authentication and validates context", async () => {
    const request = (body: unknown, authenticated: boolean) => app.request("https://remember.test/api/life/autopilot", { method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { "x-dev-user-id": "81000000-0000-4000-8000-000000000001" } : {}) }, body: JSON.stringify(body) }, env);
    expect((await request(input, false)).status).toBe(401);
    expect((await request({ ...input, timeZone: "fake/zone" }, true)).status).toBe(422);
    expect((await request(input, true)).status).toBe(503);
  });

  it("changes focus atomically, scopes ownership, and rejects a stale task", async () => {
    const userId = "81000000-0000-4000-8000-000000000002";
    await app.request("https://remember.test/api/life", { headers: { "x-dev-user-id": userId } }, env);
    const repository = new LifeRepository(env.DB);
    const first = await repository.createTask(userId, createTaskSchema.parse({ title: "Current", status: "active" }));
    const next = await repository.createTask(userId, createTaskSchema.parse({ title: "Next", status: "inbox" }));
    await repository.startAutopilotFocus(userId, next.id, next.updatedAt, first.id);
    const snapshot = await repository.snapshot(userId);
    expect(snapshot.tasks.filter((task) => task.status === "active").map((task) => task.id)).toEqual([next.id]);
    expect(snapshot.tasks.find((task) => task.id === first.id)?.status).toBe("queued");
    await expect(repository.startAutopilotFocus("81000000-0000-4000-8000-000000000001", next.id, next.updatedAt, null)).rejects.toMatchObject({ code: "plan_changed" });
    await repository.completeTask(userId, next.id);
    await expect(repository.startAutopilotFocus(userId, next.id, next.updatedAt, null)).rejects.toMatchObject({ code: "plan_changed" });
    expect((await repository.snapshot(userId)).tasks.find((task) => task.id === next.id)?.status).toBe("done");
  });

  it("only applies a real endpoint decision when both confidence and delegation allow it", async () => {
    const userId = "81000000-0000-4000-8000-000000000003";
    await app.request("https://remember.test/api/life", { headers: { "x-dev-user-id": userId } }, env);
    const repository = new LifeRepository(env.DB);
    const first = await repository.createTask(userId, createTaskSchema.parse({ title: "Current", status: "active" }));
    const next = await repository.createTask(userId, createTaskSchema.parse({ title: "Next", status: "inbox" }));
    const fetcher = vi.spyOn(globalThis, "fetch");
    const decide = async (startFocus: boolean, confidence: number) => {
      fetcher.mockResolvedValueOnce(Response.json({ model: "typesafe/jev-1.13", answers: { next: {
        type: "choice", choice: next.id, confidence, probabilities: { [first.id]: 0.03, [next.id]: 0.95, pause: 0.02 },
      } } }));
      return app.request("https://remember.test/api/life/autopilot", {
        method: "POST", headers: { "x-dev-user-id": userId, "content-type": "application/json" },
        body: JSON.stringify({ ...input, startFocus }),
      }, { ...env, OPENROUTER_API_KEY: "test-key" });
    };
    try {
      expect(await (await decide(true, 0.6)).json()).toMatchObject({ disposition: "review", focusStarted: false });
      expect(await (await decide(false, 0.95)).json()).toMatchObject({ disposition: "decided", focusStarted: false });
      expect((await repository.snapshot(userId)).tasks.find((task) => task.status === "active")?.id).toBe(first.id);
      const response = await decide(true, 0.95);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ focusStarted: true });
      expect((await repository.snapshot(userId)).tasks.find((task) => task.status === "active")?.id).toBe(next.id);
    } finally { fetcher.mockRestore(); }
  });
});
