import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainSettings, type BrainState } from "@remember/domain";
import type { Commitment } from "../life/types";
import { ToastProvider } from "../ui/Toast";
import { AboutMeSection, CommitmentSection, SleepSection, YourDaySection } from "./SetupSections";
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

/** Your day and Sleep together, with Jev's settings kept in state the way the server hands them back. */
function renderSleepSettings(settings: Record<string, unknown> = {}, { fail = false, connected = true } = {}) {
  const saved: BrainSettings[] = [];
  const initial: BrainState | null = connected ? { ...brain, settings: brainSettingsSchema.parse({ timeZone: "America/Denver", preferences: "Chores after work", ...settings }) } : null;
  function Harness() {
    const [current, setCurrent] = useState(initial);
    const life = {
      brain: current, brainError: "", brainWorking: false,
      refreshBrain: async (next?: BrainSettings) => {
        if (!next) return;
        if (fail) throw new Error("Your automatic plan could not sync.");
        saved.push(next);
        setCurrent((value) => value ? { ...value, settings: next } : value);
      },
    };
    return <><YourDaySection life={life} /><SleepSection life={life} /></>;
  }
  render(<ToastProvider><Harness /></ToastProvider>);
  return saved;
}
const sleepOn = (extra: Record<string, unknown> = {}) => ({ sleep: { enabled: true, ...extra } });
/** A labeled row of chips (a fieldset whose legend names it). */
const chips = (name: string) => screen.getAllByRole("group", { name })[0];

describe("Sleep settings", () => {
  it("turns phone-free nights on and off, keeping the rest of Jev's settings", async () => {
    const saved = renderSleepSettings({ startHour: 6, endHour: 21 });
    const toggle = screen.getByRole("switch", { name: "Phone-free nights" });
    expect(toggle).toHaveAccessibleDescription("Tap Going to bed; get your phone back after you’re up");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("switch", { name: "Caffeine reminder" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ ...brainSettingsSchema.parse({ timeZone: "America/Denver", preferences: "Chores after work", startHour: 6, endHour: 21 }), sleep: { enabled: true, morningMinutes: 60, caffeineReminder: true } });
    expect(screen.getByRole("switch", { name: "Caffeine reminder" })).toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(saved.at(-1)?.sleep.enabled).toBe(false));
    expect(screen.queryByRole("switch", { name: "Caffeine reminder" })).toBeNull();
  });

  it("leaves Your day alone: Jev keeps planning with its presets", () => {
    renderSleepSettings({ startHour: 6, endHour: 21, ...sleepOn() });
    expect(screen.getByRole("button", { name: /Early bird/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Follows your sleep")).toBeNull();
  });

  it("sets the phone-free morning and the caffeine reminder in one tap each", async () => {
    const saved = renderSleepSettings(sleepOn());
    const morning = chips("Phone-free after waking");
    expect(within(morning).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Off", "30 min", "1 hr", "1.5 hr"]);
    expect(within(morning).getByRole("button", { name: "1 hr" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(morning).getByRole("button", { name: "Off" }));
    expect(within(morning).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(saved.at(-1)?.sleep.morningMinutes).toBe(0));

    const caffeine = screen.getByRole("switch", { name: "Caffeine reminder" });
    expect(caffeine).toHaveAccessibleDescription("8 hours before your usual bedtime");
    fireEvent.click(caffeine);
    await waitFor(() => expect(saved.at(-1)?.sleep).toEqual({ enabled: true, morningMinutes: 0, caffeineReminder: false }));
    expect(saved.at(-1)?.preferences).toBe("Chores after work");
  });

  it("keeps a phone-free morning set on another device", () => {
    renderSleepSettings(sleepOn({ morningMinutes: 45 }));
    const morning = chips("Phone-free after waking");
    expect(within(morning).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Off", "30 min", "45 min", "1 hr", "1.5 hr"]);
    expect(within(morning).getByRole("button", { name: "45 min" })).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back when a change doesn't save", async () => {
    renderSleepSettings({}, { fail: true });
    const toggle = screen.getByRole("switch", { name: "Phone-free nights" });
    fireEvent.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sleep settings didn’t save. Try again.");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("switch", { name: "Caffeine reminder" })).toBeNull();
  });

  it("explains what's missing without a server", () => {
    renderSleepSettings({}, { connected: false });
    expect(screen.getByRole("switch", { name: "Phone-free nights" })).toBeDisabled();
    expect(screen.getByText("Connect your Remember server to use sleep.")).toBeInTheDocument();
  });
});
