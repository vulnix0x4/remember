import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainState } from "@remember/domain";
import { JevStatusLine } from "./JevSheet";

const brain: BrainState = {
  settings: brainSettingsSchema.parse({ timeZone: "America/Denver" }), status: "ready",
  message: "Your next steps are in place.", model: "typesafe/jev-1.13", evaluatedAt: new Date(Date.now() - 2 * 60_000).toISOString(), nextCheckAt: null,
  plan: [], contextUsed: ["Tasks and deadlines"], unscheduledCount: 0,
};
afterEach(cleanup);

describe("Jev status line", () => {
  it("says whether Jev is planning and opens Settings", () => {
    const open = vi.fn();
    render(<JevStatusLine life={{ brain }} onOpen={open} />);
    fireEvent.click(screen.getByRole("button", { name: "Jev is planning your day" }));
    expect(open).toHaveBeenCalledOnce();
  });
  it("shows a paused Jev", () => {
    render(<JevStatusLine life={{ brain: { ...brain, settings: { ...brain.settings, enabled: false } } }} onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Jev is paused" })).toBeInTheDocument();
  });
});
