import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { buildLocalDecisionBrief } from "./decisionBrief";

describe("decision brief", () => {
  it("turns relevant saved material into a reversible next step", () => {
    const brief = buildLocalDecisionBrief("Should I protect more time for creative work?", "I keep consuming instead of making.", imprints);
    expect(brief.grounded).toBe(true);
    expect(brief.citations.length).toBeGreaterThan(0);
    expect(brief.smallTest.length).toBeGreaterThan(10);
    expect(brief.nextQuestion).toContain("learn");
  });
});
