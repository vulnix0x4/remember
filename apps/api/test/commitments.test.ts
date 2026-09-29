import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { brainSettingsSchema, type Commitment, type LifeSnapshot, type Task } from "@remember/domain";
import { scheduleTasks } from "../src/brain-planner";
import { app } from "../src/app";

const json = (userId: string, method: string, body?: unknown) => ({
  method, headers: { "x-dev-user-id": userId, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function snapshot(userId: string): Promise<LifeSnapshot> {
  return (await app.request("https://remember.test/api/life", { headers: { "x-dev-user-id": userId } }, env)).json();
}
async function create(userId: string, body: unknown): Promise<Commitment> {
  const response = await app.request("https://remember.test/api/life/commitments", json(userId, "POST", body), env);
  expect(response.status).toBe(201);
  return (await response.json<{ commitment: Commitment }>()).commitment;
}
const occurrences = (life: LifeSnapshot, id: string) => life.tasks.filter((task) => task.commitmentId === id && ["queued", "inbox", "active"].includes(task.status));

describe("commitments", () => {
  it("turns a daily commitment into one planned task per day for the next week", async () => {
    const userId = crypto.randomUUID();
    await snapshot(userId);
    const college = await create(userId, { title: "College study", kind: "commitment", days: 127, durationMinutes: 120, importance: "must" });
    const life = await snapshot(userId);
    const tasks = occurrences(life, college.id);
    expect(tasks).toHaveLength(7);
    expect(new Set(tasks.map((task) => task.occurrenceDate)).size).toBe(7);
    expect(tasks.every((task) => task.priority === "must" && task.durationMinutes === 120 && task.dueAt && task.notBefore)).toBe(true);
    expect(life.commitments?.map((item) => item.title)).toEqual(["College study"]);
    // Loading again doesn't duplicate anything.
    expect(occurrences(await snapshot(userId), college.id)).toHaveLength(7);
  });

  it("pins a fixed-time commitment and respects chosen weekdays", async () => {
    const userId = crypto.randomUUID();
    await snapshot(userId);
    const gym = await create(userId, { title: "Gym", kind: "commitment", days: 2 | 8 | 32, fixedStart: "18:30", durationMinutes: 60 });
    const tasks = occurrences(await snapshot(userId), gym.id);
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    for (const task of tasks) {
      expect([1, 3, 5]).toContain(new Date(`${task.occurrenceDate}T00:00:00Z`).getUTCDay());
      expect(task.scheduledStart).toBe(`${task.occurrenceDate}T18:30:00.000Z`);
      expect(task.scheduledEnd).toBe(`${task.occurrenceDate}T19:30:00.000Z`);
    }
  });

  it("keeps one open laundry occurrence and brings the next one back after it's done", async () => {
    const userId = crypto.randomUUID();
    await snapshot(userId);
    const laundry = await create(userId, {
      title: "Laundry", kind: "chore", everyDays: 7, durationMinutes: 30,
      steps: [{ title: "Gather clothes" }, { title: "Start the washer" }, { title: "Washer running", waitMinutes: 45 }, { title: "Move to the dryer" }],
    });
    const open = occurrences(await snapshot(userId), laundry.id);
    expect(open).toHaveLength(1);
    expect(open[0]!.firstStep).toBe("Gather clothes");
    expect(open[0]!.dueAt).toBeNull();
    const done = await app.request(`https://remember.test/api/life/tasks/${open[0]!.id}/complete`, json(userId, "POST", { minutesSpent: 25 }), env);
    expect(done.status).toBe(200);
    const after = await snapshot(userId);
    expect(after.tasks.find((task) => task.id === open[0]!.id)?.actualMinutes).toBe(25);
    const next = occurrences(after, laundry.id);
    expect(next).toHaveLength(1);
    expect(Date.parse(next[0]!.notBefore!)).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });

  it("applies edits and deletes to upcoming days right away", async () => {
    const userId = crypto.randomUUID();
    await snapshot(userId);
    const gym = await create(userId, { title: "Gym", kind: "commitment", days: 127, durationMinutes: 45 });
    const edited = await app.request(`https://remember.test/api/life/commitments/${gym.id}`, json(userId, "PATCH", { days: 2, title: "Gym day" }), env);
    expect(edited.status).toBe(200);
    const tasks = occurrences(await snapshot(userId), gym.id);
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.title).toBe("Gym day");
    const removed = await app.request(`https://remember.test/api/life/commitments/${gym.id}`, json(userId, "DELETE"), env);
    expect(removed.status).toBe(204);
    const life = await snapshot(userId);
    expect(life.commitments).toEqual([]);
    expect(life.tasks.filter((task) => task.title === "Gym day" && task.status === "queued")).toHaveLength(0);
  });

  it("rejects a commitment with no days and isolates people", async () => {
    const userId = crypto.randomUUID();
    await snapshot(userId);
    expect((await app.request("https://remember.test/api/life/commitments", json(userId, "POST", { title: "Nothing", kind: "chore", days: 0 }), env)).status).toBe(422);
    const mine = await create(userId, { title: "Gym", kind: "commitment" });
    const stranger = crypto.randomUUID();
    await snapshot(stranger);
    expect((await app.request(`https://remember.test/api/life/commitments/${mine.id}`, json(stranger, "DELETE"), env)).status).toBe(404);
  });
});

describe("planning must-do commitments", () => {
  it("always schedules a must-do commitment, even when Jev scores it low", () => {
    const settings = brainSettingsSchema.parse({ timeZone: "UTC", startHour: 8, endHour: 22 });
    const now = new Date("2026-09-19T09:00:00Z");
    const base = { firstStep: "", notes: "", goalId: null, area: "direction", status: "queued", energy: "any", dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", sourceItemId: null, practiceOutcome: null, practiceReflection: "", reflectedAt: null, completedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString() } as const;
    const study = { ...base, id: crypto.randomUUID(), title: "College study", priority: "must", durationMinutes: 120, commitmentId: crypto.randomUUID() } as Task;
    const plain = { ...base, id: crypto.randomUUID(), title: "Browse", priority: "normal", durationMinutes: 30 } as Task;
    const empty: LifeSnapshot = { tasks: [study, plain], goals: [], floor: [], events: [], blockers: [], health: [], accounts: [], transactions: [], files: [] };
    const plan = scheduleTasks(empty, settings, [
      { taskId: study.id, score: 0.5, confidence: 0.4, period: "any" },
      { taskId: plain.id, score: 0.5, confidence: 0.4, period: "any" },
    ], now);
    expect(plan.map((block) => block.taskId)).toEqual([study.id]);
  });
});
