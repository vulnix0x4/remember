import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { emptyLifeSnapshot, type LifeTask } from "../life/types";
import { buildWeeklySynthesis } from "./weeklySynthesis";

const now = new Date("2026-09-01T12:00:00Z");

function completedPractice(outcome: LifeTask["practiceOutcome"] = "helped"): LifeTask {
  return {
    id: "weekly-result", goalId: null, title: "Make before consuming", firstStep: "Create for fifteen minutes", notes: "",
    area: "work", status: "done", priority: "normal", energy: "any", durationMinutes: 15,
    dueAt: null, scheduledStart: null, scheduledEnd: null, source: "practice", sourceItemId: "creative-life",
    practiceOutcome: outcome, practiceReflection: "Starting with my own work changed the whole day.",
    reflectedAt: "2026-08-31T12:00:00Z", completedAt: "2026-08-31T12:00:00Z",
    createdAt: "2026-08-30T12:00:00Z", updatedAt: "2026-08-31T12:00:00Z",
  };
}

describe("buildWeeklySynthesis", () => {
  it("turns recent attention and a lived result into one useful weekly story", () => {
    const life = emptyLifeSnapshot();
    life.tasks = [completedPractice()];
    const recent = [{ ...imprints[2], savedAt: "August 30, 2026" }];

    const review = buildWeeklySynthesis(recent, life, now);

    expect(review).toMatchObject({ headline: "Something worked.", theme: "Building", outcome: "helped", canCarryForward: true });
    expect(review?.story).toContain("attention kept returning to building");
    expect(review?.reflection).toContain("changed the whole day");
  });

  it("does not offer a duplicate carry-forward when the experiment already continued", () => {
    const life = emptyLifeSnapshot();
    life.tasks = [completedPractice(), { ...completedPractice(), id: "next-version", status: "queued", practiceOutcome: null, reflectedAt: null, completedAt: null }];

    expect(buildWeeklySynthesis([], life, now)?.canCarryForward).toBe(false);
  });

  it("keeps an older experiment distinct from an unrelated recent theme", () => {
    const life = emptyLifeSnapshot();
    life.tasks = [{ ...completedPractice(), sourceItemId: "worst-years", title: "Name one useful change" }];
    const recent = [{ ...imprints[2], savedAt: "August 30, 2026" }];

    const review = buildWeeklySynthesis([imprints[0], ...recent], life, now);

    expect(review?.story).toContain("An older idea about rebuilding moved into real life");
    expect(review?.story).toContain("Your newer saves kept circling building");
    expect(review?.story).not.toContain("attention kept returning to building. In real life");
  });

  it("stays out of the way when nothing happened this week", () => {
    expect(buildWeeklySynthesis([], emptyLifeSnapshot(), now)).toBeNull();
  });
});
