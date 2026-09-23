import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyLifeSnapshot, type Goal, type LifeSnapshot } from "../life/types";
import { apiConfig } from "./api";
import { blockTask, completeTask, createFloorItem, createGoal, createTask, getLifeSyncState, loadLife, readLocalLife, reconcileLifeSnapshots, toggleFloorItem, updateGoal } from "./life";

const originalBaseUrl = apiConfig.baseUrl;

describe("offline Personal Life OS", () => {
  beforeEach(() => {
    localStorage.clear();
    apiConfig.baseUrl = null;
  });

  afterEach(() => {
    apiConfig.baseUrl = originalBaseUrl;
  });

  it("keeps exactly one move active and advances the path", async () => {
    const first = await createTask({ title: "Open the project", firstStep: "Open the editor", priority: "high" });
    const second = await createTask({ title: "Send the build", firstStep: "Open Messages" });
    expect(first.status).toBe("active");
    expect(second.status).toBe("queued");

    await completeTask(first.id, 4);

    const snapshot = readLocalLife();
    expect(snapshot.tasks.find((task) => task.id === first.id)).toMatchObject({ status: "done" });
    expect(snapshot.tasks.find((task) => task.id === second.id)).toMatchObject({ status: "active" });
  });

  it("keeps the result of a real-life experiment as Compass evidence", async () => {
    const practice = await createTask({ title: "Make before consuming", firstStep: "Create for fifteen minutes", source: "practice", sourceItemId: "00000000-0000-4000-8000-000000000123" });
    await completeTask(practice.id, 15, { outcome: "helped", reflection: "Starting first changed the whole session." });
    expect(readLocalLife().tasks.find((task) => task.id === practice.id)).toMatchObject({
      status: "done",
      sourceItemId: "00000000-0000-4000-8000-000000000123",
      practiceOutcome: "helped",
      practiceReflection: "Starting first changed the whole session.",
    });
  });

  it("shrinks a blocked move into a startable action", async () => {
    const task = await createTask({ title: "Build everything", firstStep: "Open the repo", durationMinutes: 45 });
    await blockTask(task.id, "big");
    expect(readLocalLife().tasks.find((item) => item.id === task.id)).toMatchObject({
      title: "Open the repo",
      durationMinutes: 5,
      status: "active",
    });
    expect(readLocalLife().blockers[0]).toMatchObject({ taskId: task.id, reason: "big", originalDuration: 45 });
  });

  it("persists and toggles a daily Life Floor baseline", async () => {
    const baseline = await createFloorItem({ title: "Take medication", area: "health", target: 1, unit: "time" });
    const date = "2026-08-31T12:00:00.000Z";
    await toggleFloorItem(baseline.id, date);
    expect(readLocalLife().floor[0].completionDates).toEqual([date]);
    await toggleFloorItem(baseline.id, date);
    expect(readLocalLife().floor[0].completionDates).toEqual([]);
  });

  it("retains an offline create through a remote refresh and reconciles it after sync", async () => {
    const offlineGoal = await createGoal({ title: "Ship the thoughtful version", area: "work", why: "It matters" });
    expect(getLifeSyncState()).toMatchObject({ pendingCount: 1 });

    const existingRemoteGoal: Goal = {
      id: "00000000-0000-4000-8000-000000000010", title: "Existing remote goal", area: "health", vision: "", why: "",
      status: "active", progress: 20, targetDate: null,
      createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
    };
    const syncedGoal: Goal = {
      ...offlineGoal,
      id: "00000000-0000-4000-8000-000000000011",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    let postAttempts = 0;
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/life/goals" && init?.method === "POST") {
        postAttempts += 1;
        if (postAttempts === 1) return new Response(null, { status: 503 });
        return new Response(JSON.stringify({ goal: syncedGoal }), { status: 201, headers: { "content-type": "application/json" } });
      }
      const snapshot: LifeSnapshot = {
        ...emptyLifeSnapshot(),
        goals: postAttempts > 1 ? [existingRemoteGoal, syncedGoal] : [existingRemoteGoal],
      };
      return new Response(JSON.stringify(snapshot), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    apiConfig.baseUrl = "https://remember.test";
    const retained = await loadLife(fetcher);
    expect(retained.remote).toBe(true);
    expect(retained.snapshot.goals.map((goal) => goal.id)).toEqual([existingRemoteGoal.id, offlineGoal.id]);
    expect(getLifeSyncState().pendingCount).toBe(1);
    expect(getLifeSyncState().error).toContain("still saved on this device");

    const reconciled = await loadLife(fetcher);
    expect(reconciled.snapshot.goals).toEqual([existingRemoteGoal, syncedGoal]);
    expect(getLifeSyncState()).toEqual({ pendingCount: 0, error: null });
    expect(postAttempts).toBe(2);
  });

  it("reconciles matching entities deterministically by the newest update", () => {
    const remoteGoal: Goal = {
      id: "00000000-0000-4000-8000-000000000020", title: "Server title", area: "direction", vision: "", why: "",
      status: "active", progress: 0, targetDate: null,
      createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z",
    };
    const localGoal = { ...remoteGoal, title: "Newer local title", updatedAt: "2026-08-21T00:00:00.000Z" };
    const localOnly = { ...remoteGoal, id: "00000000-0000-4000-8000-000000000021", title: "Local only" };
    const reconciled = reconcileLifeSnapshots(
      { ...emptyLifeSnapshot(), goals: [remoteGoal] },
      { ...emptyLifeSnapshot(), goals: [localGoal, localOnly] },
    );

    expect(reconciled.goals).toEqual([localGoal, localOnly]);
  });

  it("remaps queued updates after an offline-created entity receives its server ID", async () => {
    const localGoal = await createGoal({ title: "First title", area: "growth" });
    await updateGoal(localGoal.id, { title: "Edited while offline", progress: 35 });
    expect(getLifeSyncState().pendingCount).toBe(2);

    const serverId = "00000000-0000-4000-8000-000000000030";
    const createdOnServer: Goal = {
      ...localGoal, id: serverId,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const updatedOnServer: Goal = {
      ...createdOnServer, title: "Edited while offline", progress: 35,
      updatedAt: "2026-09-01T00:01:00.000Z",
    };
    const mutationPaths: string[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "POST") {
        mutationPaths.push(path);
        return new Response(JSON.stringify({ goal: createdOnServer }), { status: 201 });
      }
      if (init?.method === "PATCH") {
        mutationPaths.push(path);
        expect(JSON.parse(String(init.body))).toMatchObject({ title: "Edited while offline", progress: 35 });
        return new Response(JSON.stringify({ goal: updatedOnServer }), { status: 200 });
      }
      return new Response(JSON.stringify({ ...emptyLifeSnapshot(), goals: [updatedOnServer] }), { status: 200 });
    }) as typeof fetch;

    apiConfig.baseUrl = "https://remember.test";
    const loaded = await loadLife(fetcher);

    expect(mutationPaths).toEqual(["/api/life/goals", `/api/life/goals/${serverId}`]);
    expect(loaded.snapshot.goals).toEqual([updatedOnServer]);
    expect(getLifeSyncState().pendingCount).toBe(0);
  });
});
