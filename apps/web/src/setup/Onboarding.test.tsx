import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import * as lifeService from "../services/life";
import { emptyLifeSnapshot, type Commitment } from "../life/types";
import { Onboarding } from "./Onboarding";
import { SETUP_STORAGE_KEY, isSetupDone, shouldShowSetup } from "./setupState";

const timestamp = "2026-09-20T12:00:00.000Z";
function fakeLife(commitments: Commitment[] = []) {
  return {
    brain: null, brainError: "", brainWorking: false, refreshBrain: vi.fn().mockResolvedValue(undefined),
    snapshot: { ...emptyLifeSnapshot(), commitments },
    createCommitment: vi.fn(async (input: Partial<Commitment>) => ({ id: "new", title: "", kind: "commitment", days: 127, everyDays: null, fixedStart: null, durationMinutes: 60, importance: "high", steps: [], notes: "", active: true, createdAt: timestamp, updatedAt: timestamp, ...input }) as Commitment),
    updateCommitment: vi.fn(), deleteCommitment: vi.fn(),
  };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.location.hash = ""; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("setup flow", () => {
  it("runs Welcome → Your day → Commitments → Chores → Nudges → Done with one Next and a quiet Skip", async () => {
    const life = fakeLife();
    const finish = vi.fn();
    render(<Onboarding life={life} onFinish={finish} />);
    const dialog = () => screen.getByRole("dialog");
    expect(within(dialog()).getByRole("heading", { name: "Let’s set up your day" })).toBeInTheDocument();
    expect(within(dialog()).getAllByRole("button", { name: /^(Start|Next)$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(within(dialog()).getByRole("heading", { name: "When is your day?" })).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /Early bird/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(within(dialog()).getByRole("heading", { name: "What do you do most days?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Gym" }));
    await waitFor(() => expect(life.createCommitment).toHaveBeenCalledWith(expect.objectContaining({ title: "Gym", days: 42, importance: "high" })));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(within(dialog()).getByRole("heading", { name: "What keeps life running?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Laundry" }));
    await waitFor(() => expect(life.createCommitment).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Laundry", kind: "chore", everyDays: 7, steps: expect.arrayContaining([{ title: "Washer running", waitMinutes: 45 }]) })));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(within(dialog()).getByRole("switch", { name: "Gentle reminders" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(within(dialog()).getByRole("heading", { name: "Jev is planning your day" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(isSetupDone()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Go to Today" }));
    expect(finish).toHaveBeenCalledOnce();
    expect(isSetupDone()).toBe(true);
  });

  it("can be put off from the first screen, which also counts as done", () => {
    const finish = vi.fn();
    render(<Onboarding life={fakeLife()} onFinish={finish} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(finish).toHaveBeenCalledOnce();
    expect(localStorage.getItem(SETUP_STORAGE_KEY)).toBe("done");
  });

  it("only shows for a real, empty account that hasn't done setup", () => {
    expect(shouldShowSetup({ remote: true, loading: false, commitments: 0 })).toBe(true);
    expect(shouldShowSetup({ remote: false, loading: false, commitments: 0 })).toBe(false);
    expect(shouldShowSetup({ remote: true, loading: true, commitments: 0 })).toBe(false);
    expect(shouldShowSetup({ remote: true, loading: false, commitments: 2 })).toBe(false);
    localStorage.setItem(SETUP_STORAGE_KEY, "done");
    expect(shouldShowSetup({ remote: true, loading: false, commitments: 0 })).toBe(false);
  });

  it("opens on first load after the server answers, and never again once finished", async () => {
    vi.spyOn(lifeService, "loadLife").mockResolvedValue({ snapshot: emptyLifeSnapshot(), remote: true });
    const first = render(<App />);
    expect(await screen.findByRole("dialog", { name: "Let’s set up your day" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();
    render(<App />);
    await waitFor(() => expect(lifeService.loadLife).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Let’s set up your day" })).toBeNull();
  });

  it("can be run again from Settings", async () => {
    window.location.hash = "/settings";
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Run setup again" }));
    expect(screen.getByRole("dialog", { name: "Let’s set up your day" })).toBeInTheDocument();
  });
});
