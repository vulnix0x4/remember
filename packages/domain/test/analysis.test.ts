import { describe, expect, it } from "vitest";
import { analysisSchema, personalRelevanceHypothesisSchema } from "../src";

describe("analysis contract", () => {
  it("requires personal interpretations to be explicitly labeled", () => {
    const result = personalRelevanceHypothesisSchema.parse({ text: "This may connect to rebuilding.", confidence: 0.5 });
    expect(result.label).toBe("hypothesis");
  });

  it("rejects unbounded confidence", () => {
    const result = analysisSchema.safeParse({
      essence: "One idea",
      summary: "A summary",
      keyIdeas: [],
      keyMoments: [],
      themes: [],
      claims: [{ text: "Claim", confidence: 2 }],
      candidatePrinciples: [],
      actionableExperiments: [],
      personalRelevanceHypotheses: [],
      uncertainties: [],
    });
    expect(result.success).toBe(false);
  });
});
