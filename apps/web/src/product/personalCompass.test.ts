import { describe, expect, it } from "vitest";
import { emptyLifeSnapshot, type LifeSnapshot } from "../life/types";
import type { EvolutionOverview } from "../services/api";
import { imprints } from "../fixtures";
import { buildPersonalCompass } from "./personalCompass";

const overview: EvolutionOverview = {
  themes: [],
  principles: [
    { id: "kept", itemId: "creative-life", text: "Make before consuming.", status: "active" },
    { id: "candidate", itemId: "worst-years", text: "Let difficulty clarify what matters.", status: "candidate" },
    { id: "dismissed", itemId: "letting-go", text: "Dismissed", status: "dismissed" },
  ],
  tensions: [{ id: "tension", fromItemId: "creative-life", toItemId: "uncertainty", explanation: "Focus and openness both matter." }],
  timeline: [],
  reflections: [{ id: "reflection", itemId: "letting-go", response: "changed_mind", occurredAt: "2026-08-30T12:00:00Z" }],
  returnFeedback: [],
  recentQuestion: null,
};

describe("buildPersonalCompass", () => {
  it("separates chosen truths, proposed ideas, lived tests, and changes", () => {
    const life: LifeSnapshot = {
      ...emptyLifeSnapshot(),
      tasks: [
        {
          id: "active", goalId: null, title: "Make before consuming", firstStep: "Create for fifteen minutes", notes: `Carried forward from “The shape of a creative life”.\n${imprints[2].url}`,
          area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null,
          source: "practice", completedAt: null, createdAt: "2026-08-30T10:00:00Z", updatedAt: "2026-08-30T10:00:00Z",
        },
        {
          id: "done", goalId: null, title: "Name what changed", firstStep: "Write one line", notes: `Carried forward from “Your worst years can shape your best life”.\n${imprints[0].url}`,
          area: "growth", status: "done", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null,
          source: "practice", sourceItemId: "worst-years", practiceOutcome: "helped", practiceReflection: "Writing it down clarified the next step.", reflectedAt: "2026-08-29T10:00:00Z",
          completedAt: "2026-08-29T10:00:00Z", createdAt: "2026-08-28T10:00:00Z", updatedAt: "2026-08-29T10:00:00Z",
        },
      ],
    };

    const compass = buildPersonalCompass(overview, life, imprints);

    expect(compass.truths.map((principle) => principle.id)).toEqual(["kept"]);
    expect(compass.suggestions.map((principle) => principle.id)).toEqual(["candidate"]);
    expect(compass.activeExperiments[0].imprint?.id).toBe("creative-life");
    expect(compass.completedExperiments[0].imprint?.id).toBe("worst-years");
    expect(compass.guidance[0]).toMatchObject({ kind: "keep", principle: { id: "candidate" } });
    expect(compass.changes[0].statement).toContain("no longer feels the same");
    expect(compass.tension?.id).toBe("tension");
  });
});
