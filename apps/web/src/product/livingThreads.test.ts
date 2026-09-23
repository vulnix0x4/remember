import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { buildLivingThreads } from "./livingThreads";

describe("Living threads", () => {
  it("turns repeated topics into chronological lines of thought", () => {
    const threads = buildLivingThreads(imprints);
    const identity = threads.find((thread) => thread.name === "Identity");

    expect(identity?.saves).toHaveLength(3);
    expect(identity?.earliest.id).toBe("uncertainty");
    expect(identity?.latest.id).toBe("worst-years");
    expect(identity?.question).toContain("thinking about identity");
  });

  it("ignores one-off topics and unfinished analysis", () => {
    const threads = buildLivingThreads(imprints);

    expect(threads.some((thread) => thread.name === "Rebuilding")).toBe(false);
    expect(threads.every((thread) => thread.saves.every((save) => save.status === "ready" || save.status === "partial"))).toBe(true);
  });

  it("turns memory check-ins into visible turning points and a more personal next question", () => {
    const threads = buildLivingThreads(imprints, [
      { id: "reflection-1", itemId: "uncertainty", response: "not_sure", occurredAt: "2026-08-28T12:00:00Z" },
      { id: "reflection-2", itemId: "worst-years", response: "changed_mind", occurredAt: "2026-08-30T12:00:00Z" },
    ]);
    const identity = threads.find((thread) => thread.name === "Identity");

    expect(identity?.turningPoints.map((point) => point.label)).toEqual(["You left this open", "Your view shifted here"]);
    expect(identity?.pulse.kind).toBe("shifting");
    expect(identity?.pulse.label).toBe("Your thinking is changing");
    expect(identity?.question).toBe("What changed my mind about identity, and what do I seem to believe instead?");
  });
});
