import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as lifeService from "../services/life";
import { ToastProvider } from "../ui/Toast";
import { LockInHost } from "./LockIn";
import { LockInProvider, useLockIn } from "./lockInContext";
import { advanceRoutine, enterStep, routineStorageKey, waitDoneMessage, waitLeftLabel } from "./routine";
import { focusTimerStorageKey } from "./TaskViews";
import { emptyLifeSnapshot, type Commitment, type LifeTask, type RoutineStep } from "./types";
import { useLifeOS } from "./useLifeOS";

const timestamp = "2026-09-23T09:00:00.000Z";
const steps: RoutineStep[] = [{ title: "Gather dirty clothes" }, { title: "Washer running", waitMinutes: 45 }, { title: "Move clothes to the dryer" }];
const laundry: Commitment = { id: "laundry", title: "Laundry", kind: "chore", days: 127, everyDays: 7, fixedStart: null, durationMinutes: 30, importance: "normal", steps, notes: "", active: true, createdAt: timestamp, updatedAt: timestamp };
function task(overrides: Partial<LifeTask>): LifeTask {
  return { id: "t1", goalId: null, title: "Write the essay", firstStep: "Open the doc", notes: "", area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 30, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp, ...overrides };
}

function Harness({ onFinished }: { onFinished: () => void }) {
  const life = useLifeOS(true);
  const lockIn = useLockIn();
  return <>
    <p>Open: {lockIn.taskId ?? "none"}</p>
    <div className="app-shell"><main /></div>
    <LockInHost life={life} onFinished={onFinished} />
  </>;
}
function renderLockIn(onFinished = vi.fn()) {
  return render(<ToastProvider><LockInProvider><Harness onFinished={onFinished} /></LockInProvider></ToastProvider>);
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 23, 10, 0) });
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("routine steps", () => {
  it("starts a wait when arriving on its step and finishes after the last step", () => {
    const now = 1_000_000;
    const first = enterStep(steps, 0, now);
    expect(first).toEqual({ step: 0, waitEndsAt: null, notified: false });
    const second = advanceRoutine(first, steps, now);
    expect(second).toEqual({ finished: false, progress: { step: 1, waitEndsAt: now + 45 * 60_000, notified: false } });
    const third = advanceRoutine(second.progress, steps, now + 5_000);
    expect(third.progress).toEqual({ step: 2, waitEndsAt: null, notified: false });
    expect(advanceRoutine(third.progress, steps).finished).toBe(true);
  });
  it("says what finished and what's next", () => {
    expect(waitDoneMessage(steps, 1)).toBe("Washer’s done. Move clothes to the dryer.");
    expect(waitDoneMessage([{ title: "Soak beans", waitMinutes: 60 }], 0)).toBe("Time’s up.");
    expect(waitLeftLabel(38 * 60_000 - 1)).toBe("38 min left");
    expect(waitLeftLabel(12_000)).toBe("12 sec left");
  });
});

describe("lock-in mode", () => {
  it("shows the task, a countdown ring, and a get-ready list, and only leaves after a 3-second hold", () => {
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), tasks: [task({})] });
    sessionStorage.setItem("remember-lock-in-v1", "t1");
    renderLockIn();
    const dialog = screen.getByRole("dialog", { name: "Write the essay" });
    expect(within(dialog).getByText("Start with: Open the doc")).toBeInTheDocument();
    expect(within(dialog).getByRole("timer")).toHaveAccessibleName("Time left 30 minutes 0 seconds");
    fireEvent.click(within(dialog).getByRole("button", { name: "Phone face down" }));
    expect(within(dialog).getByRole("button", { name: "Phone face down" })).toHaveAttribute("aria-pressed", "true");

    advance(61_000);
    expect(within(dialog).queryByRole("group", { name: "Get ready" })).toBeNull();
    expect(within(dialog).getByRole("timer")).toHaveAccessibleName("Time left 28 minutes 59 seconds");

    const leave = within(dialog).getByRole("button", { name: "Leave focus (press and hold)" });
    fireEvent.pointerDown(leave);
    advance(1_500);
    fireEvent.pointerUp(leave);
    advance(3_000);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(leave, { key: "Enter" });
    advance(2_900);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    advance(200);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Open: none")).toBeInTheDocument();
    // Leaving pauses the clock but keeps the time spent for Done later.
    expect(JSON.parse(sessionStorage.getItem(focusTimerStorageKey("t1"))!)).toMatchObject({ startedAt: null });
    expect(JSON.parse(sessionStorage.getItem(focusTimerStorageKey("t1"))!).accumulatedMs).toBeGreaterThanOrEqual(64_000);
  });

  it("keeps counting in the accent color after time is up, and pauses when the ring is tapped", () => {
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), tasks: [task({ durationMinutes: 5 })] });
    sessionStorage.setItem("remember-lock-in-v1", "t1");
    renderLockIn();
    advance(6 * 60_000);
    expect(screen.getByRole("timer")).toHaveAccessibleName("Over time by 1 minute 0 seconds");
    expect(screen.getByRole("button", { name: "Pause timer" })).toHaveClass("over");
    fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
    advance(60_000);
    expect(screen.getByRole("timer")).toHaveAccessibleName("Over time by 1 minute 0 seconds");
    expect(screen.getByRole("button", { name: "Resume timer" })).toBeInTheDocument();
  });

  it("walks a routine one step at a time, times the wait, resumes after a reload, and celebrates when done", async () => {
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), commitments: [laundry], tasks: [task({ title: "Laundry", firstStep: "Gather dirty clothes", commitmentId: "laundry", occurrenceDate: "2026-09-23" })] });
    sessionStorage.setItem("remember-lock-in-v1", "t1");
    const complete = vi.spyOn(lifeService, "completeTask");
    const finished = vi.fn();
    const view = renderLockIn(finished);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Gather dirty clothes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Washer running · 45 min left")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(JSON.parse(localStorage.getItem(routineStorageKey("t1"))!)).toMatchObject({ step: 1, waitEndsAt: Date.now() + 45 * 60_000 });

    advance(7 * 60_000);
    expect(screen.getByText("Washer running · 38 min left")).toBeInTheDocument();
    // Reload: the same step and the same wait come back.
    view.unmount();
    renderLockIn(finished);
    expect(screen.getByText("Washer running · 38 min left")).toBeInTheDocument();

    advance(38 * 60_000);
    expect(screen.getByText("Washer’s done. Move clothes to the dryer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Done" })); });
    expect(complete).toHaveBeenCalledWith("t1", 45, undefined);
    expect(screen.getByRole("heading", { name: "Done." })).toBeInTheDocument();
    expect(screen.getByText("That’s 1 today.")).toBeInTheDocument();
    expect(localStorage.getItem(routineStorageKey("t1"))).toBeNull();
    advance(2_000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(finished).toHaveBeenCalledOnce();
  });

  it("ends a wait early with It's done already", () => {
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), commitments: [laundry], tasks: [task({ title: "Laundry", commitmentId: "laundry" })] });
    localStorage.setItem(routineStorageKey("t1"), JSON.stringify({ step: 1, waitEndsAt: Date.now() + 10 * 60_000 }));
    sessionStorage.setItem("remember-lock-in-v1", "t1");
    renderLockIn();
    fireEvent.click(screen.getByRole("button", { name: "It’s done already" }));
    expect(screen.getByText("Move clothes to the dryer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("closes by itself when the task is moved aside", async () => {
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), tasks: [task({})] });
    sessionStorage.setItem("remember-lock-in-v1", "t1");
    renderLockIn();
    fireEvent.click(screen.getByRole("button", { name: "I’m stuck" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Do something else" })); });
    expect(screen.queryByRole("dialog", { name: "Write the essay" })).toBeNull();
    expect(screen.getByText("Open: none")).toBeInTheDocument();
  });
});
