import { describe, expect, it } from "vitest";
import { brainSettingsSchema, type BrainState } from "@remember/domain";
import { agoLabel, dueLabel, startLabel, doneToday, laterTasks, pickNow, planByTask, taskMeta, timeLabel, todayTasks } from "./planning";
import { parseTransactionText } from "./LifeOS";
import type { LifeTask } from "./types";

const now = new Date(2026, 8, 23, 10, 0);
const iso = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute).toISOString();
const task = (id: string, extra: Partial<LifeTask> = {}): LifeTask => ({ id, goalId: null, title: id, firstStep: "", notes: "", area: "direction", status: "queued", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: iso(9, 20, 8), updatedAt: iso(9, 20, 8), ...extra });
const brain = (plan: BrainState["plan"], enabled = true): BrainState => ({ settings: { ...brainSettingsSchema.parse({ timeZone: "UTC" }), enabled }, status: "ready", message: "", model: null, evaluatedAt: null, nextCheckAt: null, plan, contextUsed: [], unscheduledCount: 0 });
const block = (taskId: string, startAt: string) => ({ taskId, title: taskId, firstStep: "", startAt, endAt: startAt, confidence: 1, reason: `Because ${taskId}` });

describe("planning", () => {
  it("picks the active task first, then Jev's pick, then the most important", () => {
    const tasks = [task("low", { priority: "low" }), task("high", { priority: "high" }), task("planned")];
    expect(pickNow(tasks, new Map(), now)?.task.id).toBe("high");
    const plan = planByTask(brain([block("planned", iso(9, 23, 9))]), tasks);
    expect(pickNow(tasks, plan, now)).toMatchObject({ task: { id: "planned" }, block: { reason: "Because planned" } });
    expect(pickNow([...tasks, task("doing", { status: "active" })], plan, now)?.task.id).toBe("doing");
  });
  it("ignores Jev's plan while Jev is paused", () => {
    expect(planByTask(brain([block("a", iso(9, 23, 9))], false), [task("a")]).size).toBe(0);
  });
  it("separates today from later and sorts later by start", () => {
    const tasks = [task("now"), task("tomorrow", { notBefore: iso(9, 24, 9) }), task("tonight", { notBefore: iso(9, 23, 18) }), task("done", { status: "done", completedAt: iso(9, 23, 8) }), task("gone", { status: "removed" })];
    expect(todayTasks(tasks, new Map(), now).map((item) => item.id)).toEqual(["now"]);
    expect(laterTasks(tasks, now).map((item) => item.id)).toEqual(["tonight", "tomorrow"]);
    expect(doneToday(tasks, now).map((item) => item.id)).toEqual(["done"]);
  });
  it("writes short meta lines", () => {
    expect(taskMeta(task("a", { notBefore: iso(9, 24, 15), repeatEveryDays: 7, priority: "high" }), now)).toBe("15 min · Tomorrow 3 PM · Weekly · Important");
    expect(taskMeta(task("b", { durationMinutes: 60, notBefore: iso(9, 25, 9, 30) }), now)).toBe("1 hr · Fri 9:30 AM");
    expect(timeLabel(iso(9, 23, 15), now)).toBe("3 PM");
    expect(agoLabel(new Date(now.getTime() - 2 * 60_000).toISOString(), now)).toBe("2 min ago");
  });
  it("uses one due and start label for the Now card and rows", () => {
    const due = task("rent", { dueAt: iso(9, 25, 17), notBefore: iso(9, 24, 9) });
    expect(dueLabel(due, now)).toBe("Due Fri 5 PM");
    expect(startLabel(due, now)).toBe("Tomorrow 9 AM");
    expect(taskMeta(due, now)).toBe("15 min · Tomorrow 9 AM · Due Fri 5 PM");
    expect(startLabel(task("planned"), now, block("planned", iso(9, 23, 15)))).toBe("3 PM");
  });
  it("reads a transaction from one line", () => {
    expect(parseTransactionText("12.50 lunch")).toEqual({ name: "Lunch", amount: 12.5, income: false });
    expect(parseTransactionText("+2000 salary")).toEqual({ name: "Salary", amount: 2000, income: true });
    expect(parseTransactionText("coffee")).toEqual({ name: "Coffee", amount: null, income: false });
  });
});
