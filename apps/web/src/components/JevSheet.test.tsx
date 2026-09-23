import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainState } from "@remember/domain";
import { EverydayAutopilot } from "./EverydayAutopilot";
import { emptyLifeSnapshot, type LifeTask } from "../life/types";

const brain: BrainState = {
  settings: brainSettingsSchema.parse({ timeZone: "America/Denver" }), status: "ready",
  message: "Your next steps are in place.", model: "typesafe/jev-1.13", evaluatedAt: "2026-09-19T16:00:00Z", nextCheckAt: null,
  plan: [{ taskId: "task-1", title: "Laundry", firstStep: "Collect the clothes", startAt: "2026-09-19T18:00:00Z", endAt: "2026-09-19T18:30:00Z", confidence: .95, reason: "An open slot" }], contextUsed: ["Tasks and deadlines", "Your preferences"], unscheduledCount: 0,
};
function controller() {
  const snapshot = emptyLifeSnapshot();
  snapshot.tasks = [{ id: "task-1", status: "queued" } as LifeTask];
  return { snapshot, brain, brainError: "", brainWorking: false, refreshBrain: vi.fn().mockResolvedValue(undefined) };
}
afterEach(cleanup);

describe("automatic Jev plan", () => {
  it("shows the saved plan without asking the person to choose a task", () => {
    const life = controller(); const open = vi.fn();
    render(<EverydayAutopilot life={life} onOpenPlan={open} />);
    expect(screen.getByText("Laundry")).toBeInTheDocument();
    expect(screen.getByText("Collect the clothes")).toBeInTheDocument();
    expect(life.refreshBrain).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open Plan" }));
    expect(open).toHaveBeenCalledOnce();
  });
  it("persists pausing and day preferences", () => {
    const life = controller(); render(<EverydayAutopilot life={life} onOpenPlan={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(life.refreshBrain).toHaveBeenCalledWith({ ...brain.settings, enabled: false });
    fireEvent.click(screen.getByText("What Jev knows about my day"));
    fireEvent.change(screen.getByLabelText("What makes a day work for you?"), { target: { value: "Chores after work" } });
    fireEvent.change(screen.getByLabelText("Day starts"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(life.refreshBrain).toHaveBeenLastCalledWith({ ...brain.settings, preferences: "Chores after work", startHour: 9 });
  });
  it("rejects an invalid day and reports a failed save", async () => {
    const life = controller(); render(<EverydayAutopilot life={life} onOpenPlan={vi.fn()} />);
    fireEvent.click(screen.getByText("What Jev knows about my day"));
    fireEvent.change(screen.getByLabelText("Day ends"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(screen.getByRole("alert")).toHaveTextContent("after your start");
    expect(life.refreshBrain).not.toHaveBeenCalled();
    life.refreshBrain.mockRejectedValueOnce(new Error("offline"));
    fireEvent.change(screen.getByLabelText("Day ends"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(await screen.findByText("Your preferences could not be saved. Try again.")).toBeInTheDocument();
  });
  it("hides completed tasks and disables changes during an update", () => {
    const life = controller(); life.snapshot.tasks[0]!.status = "done";
    render(<EverydayAutopilot life={{ ...life, brainWorking: true }} onOpenPlan={vi.fn()} />);
    expect(screen.queryByText("Laundry")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("updating");
  });
});
