import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import type { AskMessage } from "../types";
import { buildAskOutcome } from "./askOutcome";

describe("Ask outcomes", () => {
  it("uses the strongest cited save with something the person can keep or try", () => {
    const message: AskMessage = {
      id: "answer",
      role: "assistant",
      text: "A grounded answer.",
      grounded: true,
      citations: [
        { imprintId: "discipline", label: "Discipline" },
        { imprintId: "creative-life", label: "Creative life" },
        { imprintId: "worst-years", label: "Worst years" },
      ],
    };

    const outcome = buildAskOutcome(message, imprints);

    expect(outcome?.imprint.id).toBe("creative-life");
    expect(outcome?.experiment?.text).toBe("Make something for fifteen minutes before consuming anything tomorrow.");
    expect(outcome?.principle).toBe("Protect a small daily window for making before consuming.");
  });

  it("does not invent an action for an ungrounded answer", () => {
    expect(buildAskOutcome({ id: "answer", role: "assistant", text: "No evidence", grounded: false }, imprints)).toBeNull();
  });
});
