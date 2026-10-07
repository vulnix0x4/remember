import { describe, expect, it } from "vitest";
import { fileTask, nextProjectChoice, splitDump } from "./projects";
import type { Goal, LifeTask } from "../life/types";

const goal = (id: string, title: string, extra: Partial<Goal> = {}): Goal => ({ id, title, area: "direction", vision: "", why: "", status: "active", progress: 0, targetDate: null, createdAt: `2026-09-0${id.length}T00:00:00.000Z`, updatedAt: "2026-09-01T00:00:00.000Z", ...extra });
const task = (title: string, goalId: string | null, extra: Partial<LifeTask> = {}): LifeTask => ({ id: `${title}-${goalId}`, goalId, title, firstStep: "", notes: "", area: "direction", status: "done", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...extra });

const college = goal("c", "College");
const app = goal("ap", "iOS app");
const projects = [college, app];

describe("fileTask", () => {
  it("files by the project's kit and leaves anything unclear loose", () => {
    expect(fileTask("Finish the WGU essay", projects, [])).toBe("c");
    expect(fileTask("Fix the sleep screen crash", projects, [])).toBe("ap");
    expect(fileTask("Email my mentor", projects, [])).toBe("c");
    expect(fileTask("Call mom", projects, [])).toBeNull();
    expect(fileTask("Read chapter 5", projects, [])).toBe("c");
    expect(fileTask("Gym", projects, [])).toBeNull();
    expect(fileTask("Submit C683 task 2", projects, [])).toBe("c");
  });

  it("matches a project's own name", () => {
    expect(fileTask("College application form", projects, [])).toBe("c");
    expect(fileTask("Pay for app icon", [goal("x", "Side app")], [])).toBe("x");
  });

  it("learns from earlier tasks, up to two per word", () => {
    const selfCare = goal("s", "Self care");
    expect(fileTask("Gym", [...projects, selfCare], [task("Gym", "s")])).toBeNull();
    expect(fileTask("Gym", [...projects, selfCare], [task("Gym", "s"), task("Gym legs", "s")])).toBe("s");
    expect(fileTask("Gym", [...projects, selfCare], [task("Gym", "s", { status: "removed" }), task("Gym legs", "s")])).toBeNull();
  });

  it("stays loose on a tie", () => {
    expect(fileTask("Write the essay", [college, goal("sc", "School stuff")], [])).toBeNull();
  });

  it("uses the project in focus, but never a paused one", () => {
    expect(fileTask("Call mom", projects, [], "ap")).toBe("ap");
    expect(fileTask("Finish the WGU essay", [college, goal("p", "Paused", { status: "paused" })], [], "p")).toBe("c");
    expect(fileTask("Finish the WGU essay", [goal("c", "College", { status: "paused" })], [])).toBeNull();
  });
});

describe("nextProjectChoice", () => {
  it("cycles through active projects, then none", () => {
    expect(nextProjectChoice(null, projects)).toBe("c");
    expect(nextProjectChoice("c", projects)).toBe("ap");
    expect(nextProjectChoice("ap", projects)).toBeNull();
    expect(nextProjectChoice(null, [])).toBeNull();
  });
});

describe("splitDump", () => {
  it("splits a messy paragraph into clean tasks", () => {
    expect(splitDump("ok i need to finish the WGU essay, fix the sleep screen crash, call mom, and email my mentor"))
      .toEqual(["finish the WGU essay", "fix the sleep screen crash", "call mom", "email my mentor"]);
  });

  it("keeps a list inside one task together", () => {
    expect(splitDump("Buy eggs, milk, bread")).toEqual([]);
    expect(splitDump("Call mom tomorrow 20m")).toEqual([]);
    expect(splitDump("Finish the essay and fix the crash")).toEqual([]);
  });

  it("splits lines and sentences, even one word long", () => {
    expect(splitDump("gym\nlaundry\nemail sam")).toEqual(["gym", "laundry", "email sam"]);
    expect(splitDump("Finish the essay. Fix the crash. Call mom and email my mentor.")).toEqual(["Finish the essay", "Fix the crash", "Call mom", "email my mentor"]);
  });

  it("keeps time and day words with their task", () => {
    expect(splitDump("gym tomorrow, 45 min; call mom tonight")).toEqual(["gym tomorrow 45 min", "call mom tonight"]);
  });
});
