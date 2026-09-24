import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainState } from "@remember/domain";
import type { Commitment } from "../life/types";
import { AboutMeSection, CommitmentSection, YourDaySection } from "./SetupSections";
import { LAUNDRY_STEPS } from "./templates";

const brain: BrainState = {
  settings: brainSettingsSchema.parse({ timeZone: "America/Denver" }), status: "ready",
  message: "Your next steps are in place.", model: "typesafe/jev-1.13", evaluatedAt: new Date(Date.now() - 2 * 60_000).toISOString(), nextCheckAt: null,
  plan: [], contextUsed: ["Tasks and deadlines"], unscheduledCount: 0,
};
function jev(overrides: Partial<{ brain: BrainState | null; brainWorking: boolean }> = {}) {
  return { brain, brainError: "", brainWorking: false, refreshBrain: vi.fn().mockResolvedValue(undefined), ...overrides };
}
const timestamp = "2026-09-20T12:00:00.000Z";
function commitment(overrides: Partial<Commitment>): Commitment {
  return { id: "c1", title: "Gym", kind: "commitment", days: 42, everyDays: null, fixedStart: null, durationMinutes: 60, importance: "high", steps: [], notes: "", active: true, createdAt: timestamp, updatedAt: timestamp, ...overrides };
}
function setupLife(commitments: Commitment[] = []) {
  return {
    ...jev(),
    snapshot: { commitments } as never,
    createCommitment: vi.fn(async (input: Partial<Commitment>) => commitment({ ...input, id: "new" })),
    updateCommitment: vi.fn().mockResolvedValue(null),
    deleteCommitment: vi.fn().mockResolvedValue(undefined),
  };
}
afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("Your day", () => {
  it("saves a preset day right away, including one that runs past midnight", () => {
    const life = jev();
    render(<YourDaySection life={life} />);
    expect(screen.getByText("Last planned 2 min ago")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Night owl/ }));
    expect(life.refreshBrain).toHaveBeenLastCalledWith({ ...brain.settings, startHour: 12, endHour: 3 });
    expect(screen.getByRole("button", { name: /Night owl/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Ends after midnight.")).toBeInTheDocument();
  });
  it("lets custom hours be picked with two time pickers", () => {
    const life = jev();
    render(<YourDaySection life={life} />);
    fireEvent.click(screen.getByRole("button", { name: /Custom/ }));
    fireEvent.change(screen.getByLabelText("I wake up"), { target: { value: "9" } });
    expect(life.refreshBrain).toHaveBeenLastCalledWith(expect.objectContaining({ startHour: 9 }));
  });
  it("does not save a day that starts and ends at the same hour", () => {
    const life = jev();
    render(<YourDaySection life={life} />);
    fireEvent.click(screen.getByRole("button", { name: /Custom/ }));
    fireEvent.change(screen.getByLabelText("I wind down"), { target: { value: String(brain.settings.startHour) } });
    expect(screen.getByRole("alert")).toHaveTextContent("different end hour");
    expect(life.refreshBrain).not.toHaveBeenCalled();
  });
  it("toggles planning immediately", () => {
    const life = jev();
    render(<YourDaySection life={life} />);
    fireEvent.click(screen.getByRole("switch", { name: "Let Jev plan my day" }));
    expect(life.refreshBrain).toHaveBeenCalledWith({ ...brain.settings, enabled: false });
  });
  it("explains what is missing without a server", () => {
    render(<YourDaySection life={jev({ brain: null })} />);
    expect(screen.getByText("Connect your Remember server to let Jev plan.")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

describe("About me for Jev", () => {
  it("saves preferences when leaving the field", () => {
    const life = jev();
    render(<AboutMeSection life={life} />);
    const field = screen.getByLabelText("What Jev should know");
    fireEvent.change(field, { target: { value: "Chores after work" } });
    fireEvent.blur(field);
    expect(life.refreshBrain).toHaveBeenCalledWith({ ...brain.settings, preferences: "Chores after work" });
  });
});

describe("Commitments and chores", () => {
  it("adds a template with one tap and offers Undo", async () => {
    const life = setupLife();
    render(<CommitmentSection life={life} kind="commitment" />);
    fireEvent.click(screen.getByRole("button", { name: "Add College study" }));
    await waitFor(() => expect(life.createCommitment).toHaveBeenCalledWith(expect.objectContaining({ title: "College study", kind: "commitment", days: 127, durationMinutes: 120, importance: "must" })));
  });
  it("shows each commitment's days and length and hides templates already added", () => {
    render(<CommitmentSection life={setupLife([commitment({})])} kind="commitment" />);
    expect(screen.getByRole("button", { name: /Gym Mon, Wed, Fri · 1 hr/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Gym" })).toBeNull();
  });
  it("adds a new commitment from the editor", async () => {
    const life = setupLife();
    render(<CommitmentSection life={life} kind="commitment" />);
    fireEvent.click(screen.getByRole("button", { name: "Add commitment" }));
    const sheet = screen.getByRole("dialog", { name: "New commitment" });
    fireEvent.change(within(sheet).getByLabelText("Name"), { target: { value: "Guitar" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Weekdays" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "At a set time" }));
    fireEvent.change(within(sheet).getByLabelText("Start time"), { target: { value: "18:30" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "30 min" }));
    fireEvent.click(within(sheet).getByRole("button", { name: /Must do/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Add commitment" }));
    await waitFor(() => expect(life.createCommitment).toHaveBeenCalledWith(expect.objectContaining({ title: "Guitar", kind: "commitment", days: 62, fixedStart: "18:30", durationMinutes: 30, importance: "must", everyDays: null })));
  });
  it("won't save a commitment with no days", () => {
    const life = setupLife();
    render(<CommitmentSection life={life} kind="commitment" />);
    fireEvent.click(screen.getByRole("button", { name: "Add commitment" }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Name"), { target: { value: "Read" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Weekdays" }));
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) fireEvent.click(within(sheet).getByRole("button", { name: day }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("Pick at least one day");
    expect(within(sheet).getByRole("button", { name: "Add commitment" })).toBeDisabled();
  });
  it("edits a chore's laundry steps and saves when the sheet closes", async () => {
    const laundry = commitment({ id: "laundry", title: "Laundry", kind: "chore", days: 127, everyDays: 7, durationMinutes: 30, importance: "normal", steps: LAUNDRY_STEPS });
    const life = setupLife([laundry]);
    render(<CommitmentSection life={life} kind="chore" />);
    fireEvent.click(screen.getByRole("button", { name: /Laundry Weekly · 30 min · 7 steps/ }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText("Wait minutes for step 3")).toHaveValue(45);
    fireEvent.change(within(sheet).getByLabelText("Wait minutes for step 3"), { target: { value: "60" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Move step 7 up" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Every 2 weeks" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Close and save" }));
    await waitFor(() => expect(life.updateCommitment).toHaveBeenCalled());
    const [id, patch] = life.updateCommitment.mock.calls[0];
    expect(id).toBe("laundry");
    expect(patch.everyDays).toBe(14);
    expect(patch.steps[2]).toEqual({ title: "Washer running", waitMinutes: 60 });
    expect(patch.steps.map((step: { title: string }) => step.title).slice(-2)).toEqual(["Put it all away", "Fold everything"]);
    expect(Object.keys(patch).sort()).toEqual(["everyDays", "steps"]);
  });
  it("deletes with Undo instead of asking", async () => {
    const life = setupLife([commitment({})]);
    render(<CommitmentSection life={life} kind="commitment" />);
    fireEvent.click(screen.getByRole("button", { name: /Gym/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(life.deleteCommitment).toHaveBeenCalledWith("c1"));
  });
});
