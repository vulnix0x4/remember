import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { carryForwardArea, carryForwardTask } from "./carryForward";

describe("Carry it forward", () => {
  it("turns a saved experiment into a source-linked Plan task", () => {
    const imprint = { ...imprints[0]!, experiments: [{ text: "Write down one useful change this difficult season revealed.", duration: "10 minutes" }] };
    const task = carryForwardTask(imprint, imprint.experiments[0]!);

    expect(task.title).toBe("Write down one useful change this difficult season revealed");
    expect(task.firstStep).toBe(imprint.experiments[0]!.text);
    expect(task.notes).toContain(imprint.title);
    expect(task.notes).toContain("Suggested timeframe: 10 minutes.");
    expect(task.notes).toContain(imprint.url);
    expect(task.source).toBe("practice");
    expect(task.status).toBe("queued");
  });

  it("places experiments in the life area suggested by the save", () => {
    expect(carryForwardArea({ themes: ["Creative work"], title: "Making things", essence: "Protect focus." })).toBe("work");
    expect(carryForwardArea({ themes: ["Identity"], title: "Changing", essence: "A new self." })).toBe("growth");
    expect(carryForwardArea(imprints[0]!)).toBe("growth");
    expect(carryForwardArea({ themes: [], title: "An open question", essence: "Choose deliberately." })).toBe("direction");
  });
});
