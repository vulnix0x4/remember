import { beforeEach, describe, expect, it } from "vitest";
import { blockTask, completeTask, createFloorItem, createTask, readLocalLife, toggleFloorItem } from "./life";

describe("offline Personal Life OS", () => {
  beforeEach(() => localStorage.clear());

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
});
