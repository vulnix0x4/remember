import { describe, expect, it } from "vitest";
import { isBigStart, isMorning, morningCandidates, morningPick, morningStage, shouldOfferMorning, skipMorning, startMorning } from "./morning";
import type { Commitment, LifeTask } from "./types";

const now = new Date(2026, 8, 28, 8, 30);
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const task = (id: string, extra: Partial<LifeTask> = {}): LifeTask => ({ id, goalId: null, title: id, firstStep: "", notes: "", area: "direction", status: "queued", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...extra });
const laundry = { id: "laundry", steps: [{ title: "Gather" }] } as Commitment;

describe("morning flow", () => {
  const tasks = [task("email", { durationMinutes: 10 }), task("dishes"), task("gym", { durationMinutes: 60 }), task("college", { durationMinutes: 120, priority: "must" }), task("trash", { durationMinutes: 5 }), task("wash", { durationMinutes: 5, commitmentId: "laundry" })];

  it("picks quick ones and the most important big one, leaving routines out", () => {
    const { small, big } = morningCandidates(tasks, [laundry]);
    expect(big?.id).toBe("college");
    expect(small.map((item) => item.id)).toEqual(["email", "dishes", "trash"]);
  });

  it("offers itself once a morning, and not when something is already going", () => {
    const candidates = morningCandidates(tasks, []);
    expect(shouldOfferMorning(null, candidates, now)).toBe(true);
    expect(shouldOfferMorning(null, candidates, now, 8, true)).toBe(false);
    expect(shouldOfferMorning(skipMorning(now), candidates, now)).toBe(false);
    expect(shouldOfferMorning(null, candidates, new Date(2026, 8, 28, 15))).toBe(false);
    expect(shouldOfferMorning(null, morningCandidates([task("one")], []), now)).toBe(false);
  });

  it("follows your day: a night owl's morning starts later", () => {
    expect(isMorning(new Date(2026, 8, 28, 13), 12)).toBe(true);
    expect(isMorning(new Date(2026, 8, 28, 7), 12)).toBe(false);
    expect(isMorning(new Date(2026, 8, 28, 1), 2)).toBe(true);
  });

  it("warms up with quick ones, then moves to the big one after three", () => {
    const candidates = morningCandidates(tasks, []);
    const session = startMorning(candidates, now);
    expect(morningPick(session, tasks, candidates.small, now)).toMatchObject({ task: { id: "email" }, label: "Warm-up · 1 of 3", stage: "warmup" });
    const later = tasks.map((item) => ["email", "dishes", "trash"].includes(item.id) ? { ...item, status: "done" as const, completedAt: at(5).toISOString() } : item);
    const left = morningCandidates(later, []).small;
    expect(morningPick(session, later, left, at(6))).toMatchObject({ task: { id: "college" }, label: "The big one" });
    expect(isBigStart(session, "college", at(6))).toBe(true);
  });

  it("stops the warm-up after twenty minutes even if quick ones are left", () => {
    const candidates = morningCandidates(tasks, []);
    const session = startMorning(candidates, now);
    expect(morningStage(session, tasks, candidates.small, at(19))).toBe("warmup");
    expect(morningStage(session, tasks, candidates.small, at(20))).toBe("big");
  });

  it("hands back to Jev once the big one is done or moved aside", () => {
    const candidates = morningCandidates(tasks, []);
    const session = { ...startMorning(candidates, now), stage: "big" as const };
    const done = tasks.map((item) => item.id === "college" ? { ...item, status: "done" as const } : item);
    expect(morningPick(session, done, candidates.small, now)).toBeNull();
    const aside = tasks.map((item) => item.id === "college" ? { ...item, notBefore: at(60).toISOString() } : item);
    expect(morningPick(session, aside, candidates.small, now)).toBeNull();
    expect(morningPick(session, tasks, candidates.small, new Date(2026, 8, 29, 8))).toBeNull();
  });
});
