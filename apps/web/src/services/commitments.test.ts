import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLifeSnapshot, type Commitment, type LifeTask } from "../life/types";
import { apiConfig } from "./api";
import { completeTask, createCommitment, deleteCommitment, getLifeSyncState, loadLife, readLocalLife, reconcileLifeSnapshots, saveLocalLife, updateCommitment } from "./life";

const originalBaseUrl = apiConfig.baseUrl;
const timestamp = "2026-09-20T12:00:00.000Z";
const serverId = "00000000-0000-4000-8000-0000000000c1";

function task(overrides: Partial<LifeTask>): LifeTask {
  return { id: "t", goalId: null, title: "Laundry", firstStep: "", notes: "", area: "environment", status: "queued", priority: "normal", energy: "any", durationMinutes: 30, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp, ...overrides };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("commitments offline", () => {
  beforeEach(() => { localStorage.clear(); apiConfig.baseUrl = null; });
  afterEach(() => { apiConfig.baseUrl = originalBaseUrl; vi.restoreAllMocks(); });

  it("saves a commitment on this device with the server's defaults and queues it", async () => {
    const created = await createCommitment({ title: "  College study ", kind: "commitment", durationMinutes: 120, importance: "must" });
    expect(created).toMatchObject({ title: "College study", kind: "commitment", days: 127, everyDays: null, fixedStart: null, durationMinutes: 120, importance: "must", steps: [], active: true });
    expect(readLocalLife().commitments).toEqual([created]);
    expect(getLifeSyncState().pendingCount).toBe(1);
  });

  it("updates and deletes locally, clearing only occurrences that haven't started", async () => {
    const chore = await createCommitment({ title: "Laundry", kind: "chore", everyDays: 7, durationMinutes: 30 });
    const snapshot = readLocalLife();
    snapshot.tasks = [task({ id: "open", commitmentId: chore.id }), task({ id: "doing", commitmentId: chore.id, status: "active" }), task({ id: "other" })];
    saveLocalLife(snapshot);

    await updateCommitment(chore.id, { title: "Wash clothes", durationMinutes: 40 });
    expect(readLocalLife().commitments[0]).toMatchObject({ title: "Wash clothes", durationMinutes: 40 });
    expect(readLocalLife().tasks.find((item) => item.id === "open")).toMatchObject({ title: "Wash clothes", durationMinutes: 40 });

    await deleteCommitment(chore.id);
    const after = readLocalLife();
    expect(after.commitments).toEqual([]);
    expect(after.tasks.map((item) => [item.id, item.status])).toEqual([["open", "removed"], ["doing", "active"], ["other", "queued"]]);
    expect(getLifeSyncState().pendingCount).toBe(3);
  });

  it("records the real minutes when a task is completed offline", async () => {
    saveLocalLife({ ...emptyLifeSnapshot(), tasks: [task({ id: "t1", status: "active" })] });
    await completeTask("t1", 37);
    expect(readLocalLife().tasks[0]).toMatchObject({ status: "done", actualMinutes: 37 });
  });

  it("keeps local commitments when an older server sends none", () => {
    const local: Commitment = { id: "c", title: "Gym", kind: "commitment", days: 42, everyDays: null, fixedStart: null, durationMinutes: 60, importance: "high", steps: [], notes: "", active: true, createdAt: timestamp, updatedAt: timestamp };
    const remote = { ...emptyLifeSnapshot(), commitments: undefined } as unknown as ReturnType<typeof emptyLifeSnapshot>;
    expect(reconcileLifeSnapshots(remote, { ...emptyLifeSnapshot(), commitments: [local] }).commitments).toEqual([local]);
  });
});

describe("commitments online", () => {
  beforeEach(() => { localStorage.clear(); apiConfig.baseUrl = "https://remember.test"; });
  afterEach(() => { apiConfig.baseUrl = originalBaseUrl; vi.restoreAllMocks(); });

  it("posts, patches, and deletes against the commitments API", async () => {
    const serverCommitment: Commitment = { id: serverId, title: "Laundry", kind: "chore", days: 127, everyDays: 7, fixedStart: null, durationMinutes: 30, importance: "normal", steps: [{ title: "Start the washer" }, { title: "Washer running", waitMinutes: 45 }], notes: "", active: true, createdAt: timestamp, updatedAt: timestamp };
    const calls: Array<[string, string, unknown]> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push([init?.method ?? "GET", path, init?.body ? JSON.parse(String(init.body)) : undefined]);
      if (init?.method === "POST") return json({ commitment: serverCommitment }, 201);
      if (init?.method === "PATCH") return json({ commitment: { ...serverCommitment, everyDays: 14 } });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return json({ ...emptyLifeSnapshot(), commitments: [] });
    });

    const created = await createCommitment({ title: "Laundry", kind: "chore", everyDays: 7, durationMinutes: 30, importance: "normal", steps: serverCommitment.steps });
    expect(created.id).toBe(serverId);
    expect(calls[0]).toEqual(["POST", "/api/life/commitments", { title: "Laundry", kind: "chore", days: 127, everyDays: 7, fixedStart: null, durationMinutes: 30, importance: "normal", steps: serverCommitment.steps, notes: "", active: true }]);

    expect(await updateCommitment(serverId, { everyDays: 14 })).toMatchObject({ everyDays: 14 });
    expect(calls[1]).toEqual(["PATCH", `/api/life/commitments/${serverId}`, { everyDays: 14 }]);

    await deleteCommitment(serverId);
    expect(calls[2]).toEqual(["DELETE", `/api/life/commitments/${serverId}`, undefined]);
    expect(readLocalLife().commitments).toEqual([]);

    const loaded = await loadLife();
    expect(loaded.snapshot.commitments).toEqual([]);
    expect(getLifeSyncState()).toEqual({ pendingCount: 0, error: null });
  });

  it("sends an offline commitment once the server is back and adopts the server's ID", async () => {
    apiConfig.baseUrl = null;
    const local = await createCommitment({ title: "Gym", kind: "commitment", days: 42 });
    await updateCommitment(local.id, { durationMinutes: 45 });
    apiConfig.baseUrl = "https://remember.test";
    const remote: Commitment = { ...local, id: serverId, durationMinutes: 45 };
    const paths: string[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (init?.method) paths.push(`${init.method} ${path}`);
      if (init?.method === "POST") return json({ commitment: { ...remote, durationMinutes: 60 } }, 201);
      if (init?.method === "PATCH") return json({ commitment: remote });
      return json({ ...emptyLifeSnapshot(), commitments: [remote] });
    }) as typeof fetch;
    const loaded = await loadLife(fetcher);
    expect(paths).toEqual(["POST /api/life/commitments", `PATCH /api/life/commitments/${serverId}`]);
    expect(loaded.snapshot.commitments).toEqual([remote]);
  });
});
