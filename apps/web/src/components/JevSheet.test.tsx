import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainState } from "@remember/domain";
import { JevSheet, JevStatusLine } from "./JevSheet";

const brain: BrainState = {
  settings: brainSettingsSchema.parse({ timeZone: "America/Denver" }), status: "ready",
  message: "Your next steps are in place.", model: "typesafe/jev-1.13", evaluatedAt: new Date(Date.now() - 2 * 60_000).toISOString(), nextCheckAt: null,
  plan: [], contextUsed: ["Tasks and deadlines"], unscheduledCount: 0,
};
function controller(overrides: Partial<{ brain: BrainState | null; brainWorking: boolean }> = {}) {
  return { brain, brainError: "", brainWorking: false, refreshBrain: vi.fn().mockResolvedValue(undefined), ...overrides };
}
afterEach(cleanup);

describe("Jev status line", () => {
  it("says whether Jev is planning and opens the Jev sheet", () => {
    render(<JevStatusLine life={controller()} />);
    fireEvent.click(screen.getByRole("button", { name: "Jev is planning your day" }));
    expect(screen.getByRole("dialog", { name: "Jev" })).toBeInTheDocument();
  });
  it("shows a paused Jev", () => {
    render(<JevStatusLine life={controller({ brain: { ...brain, settings: { ...brain.settings, enabled: false } } })} />);
    expect(screen.getByRole("button", { name: "Jev is paused" })).toBeInTheDocument();
  });
});

describe("Jev sheet", () => {
  it("toggles planning immediately", () => {
    const life = controller();
    render(<JevSheet life={life} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Let Jev plan my day" }));
    expect(life.refreshBrain).toHaveBeenCalledWith({ ...brain.settings, enabled: false });
  });
  it("saves hours and preferences when dismissed", () => {
    const life = controller(); const close = vi.fn();
    render(<JevSheet life={life} onClose={close} />);
    expect(screen.getByText("Last planned 2 min ago")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("What Jev should know"), { target: { value: "Chores after work" } });
    fireEvent.change(screen.getByLabelText("Day starts"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Close and save" }));
    expect(close).toHaveBeenCalledOnce();
    expect(life.refreshBrain).toHaveBeenLastCalledWith({ ...brain.settings, preferences: "Chores after work", startHour: 9 });
  });
  it("does not save an impossible day", () => {
    const life = controller();
    render(<JevSheet life={life} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Day ends"), { target: { value: "7" } });
    expect(screen.getByRole("alert")).toHaveTextContent("end after the start");
    fireEvent.click(screen.getByRole("button", { name: "Close and save" }));
    expect(life.refreshBrain).not.toHaveBeenCalled();
  });
  it("explains what is missing without a server and disables changes while updating", () => {
    const { unmount } = render(<JevSheet life={controller({ brain: null })} onClose={vi.fn()} />);
    expect(screen.getByText("Connect your Remember server to let Jev plan.")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();
    unmount();
    render(<JevSheet life={controller({ brainWorking: true })} onClose={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("updating");
  });
});
