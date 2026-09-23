import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { emptyLifeSnapshot, type LifeSnapshot, type LifeTask, type PracticeOutcome } from "../life/types";
import { findContextualReturn } from "./contextualReturn";

function snapshotWithTask(title: string, firstStep: string, area: "work" | "growth" | "direction"): LifeSnapshot {
  return {
    ...emptyLifeSnapshot(),
    tasks: [{
      id: "task-1", goalId: null, title, firstStep, notes: "", area, status: "active", priority: "normal", energy: "any",
      durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    }],
  };
}

function livedResult(sourceItemId: string, outcome: PracticeOutcome): LifeTask {
  return {
    id: `result-${sourceItemId}`, goalId: null, title: "A real-life test", firstStep: "Try it", notes: "", area: "growth",
    status: "done", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null,
    scheduledEnd: null, source: "practice", sourceItemId, practiceOutcome: outcome, practiceReflection: "I noticed what actually happened.",
    reflectedAt: "2026-09-01T00:00:00.000Z", completedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("Contextual return", () => {
  it("finds a saved idea that can help with the current task", () => {
    const result = findContextualReturn(imprints, snapshotWithTask("Protect a focused block for creative work", "Make before consuming", "direction"));

    expect(result?.imprint.id).toBe("creative-life");
    expect(result?.reason).toContain("current task");
    expect(result?.reason).toContain("Protect a focused block for creative work");
    expect(result?.question).toContain("The shape of a creative life");
    expect(result?.contextArea).toBe("work");
  });

  it("stays quiet when there is no current direction", () => {
    expect(findContextualReturn(imprints, emptyLifeSnapshot())).toBeNull();
  });

  it("prioritizes a relevant idea that helped in real life", () => {
    const snapshot = snapshotWithTask("Rebuild deliberately after a difficult season", "Name what this season clarified", "growth");
    snapshot.tasks.push(livedResult("worst-years", "helped"));

    const result = findContextualReturn(imprints, snapshot);

    expect(result?.imprint.id).toBe("worst-years");
    expect(result?.livedResult).toBe("helped");
    expect(result?.reason).toContain("said it helped");
  });

  it("does not resurface an idea the person already rejected", () => {
    const snapshot = snapshotWithTask("Protect a focused block for creative work", "Make before consuming", "direction");
    snapshot.tasks.push(livedResult("creative-life", "not_for_me"));

    expect(findContextualReturn(imprints, snapshot)?.imprint.id).not.toBe("creative-life");
  });

  it("uses an upcoming event when it is the strongest part of the day", () => {
    const snapshot = emptyLifeSnapshot();
    snapshot.events = [{
      id: "event-1", externalId: null, source: "manual", calendarName: "Work", title: "Creative review",
      notes: "Choose what to build next and protect focused creative work.", location: "Studio", url: null,
      startAt: "2026-09-01T17:00:00.000Z", endAt: "2026-09-01T18:00:00.000Z", allDay: false,
      status: "confirmed", createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-08-31T00:00:00.000Z",
    }];

    const result = findContextualReturn(imprints, snapshot, { now: new Date("2026-09-01T12:00:00.000Z") });

    expect(result?.contextKind).toBe("event");
    expect(result?.contextTitle).toBe("Creative review");
    expect(result?.contextDetail).toContain("Today");
  });

  it("can continue a recent Ask question on Today", () => {
    const result = findContextualReturn(imprints, emptyLifeSnapshot(), {
      now: new Date("2026-09-01T12:00:00.000Z"),
      recentQuestion: { question: "How do I protect focused creative work?", askedAt: "2026-09-01T10:00:00.000Z" },
    });

    expect(result?.contextKind).toBe("question");
    expect(result?.contextTitle).toContain("focused creative work");
    expect(result?.question).toContain("change how I might answer");
  });

  it("uses check-ins and not-for-today feedback to improve the next return", () => {
    const snapshot = snapshotWithTask("Protect a focused block for creative work", "Make before consuming", "direction");
    const first = findContextualReturn(imprints, snapshot, {
      reflections: [{ itemId: "creative-life", response: "still_true", occurredAt: "2026-09-01T08:00:00.000Z" }],
      now: new Date("2026-09-01T12:00:00.000Z"),
    });
    expect(first?.reason).toContain("still feels true");

    const next = findContextualReturn(imprints, snapshot, {
      returnFeedback: [{ itemId: first!.imprint.id, response: "not_today", occurredAt: "2026-09-01T11:00:00.000Z" }],
      now: new Date("2026-09-01T12:00:00.000Z"),
    });
    expect(next?.imprint.id).not.toBe(first?.imprint.id);
  });

  it("proposes one real action when the returned save contains an experiment", () => {
    const result = findContextualReturn(imprints, snapshotWithTask("Protect a focused block for creative work", "Make before consuming", "direction"));

    expect(result?.suggestedAction?.firstStep).toBe(result?.imprint.experiments[0]?.text);
    expect(result?.suggestedAction?.durationMinutes).toBe(15);
  });
});
