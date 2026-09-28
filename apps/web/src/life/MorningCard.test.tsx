import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as lifeService from "../services/life";
import { ToastProvider } from "../ui/Toast";
import { LockInProvider } from "./lockInContext";
import { NowCard } from "./TaskViews";
import { emptyLifeSnapshot, type LifeTask } from "./types";
import { useLifeOS } from "./useLifeOS";

const timestamp = "2026-09-28T06:00:00.000Z";
function task(id: string, extra: Partial<LifeTask> = {}): LifeTask {
  return { id, goalId: null, title: id, firstStep: "", notes: "", area: "direction", status: "queued", priority: "normal", energy: "any", durationMinutes: 10, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp, ...extra };
}

function Harness() {
  const life = useLifeOS(true);
  return <NowCard life={life} />;
}
const renderCard = () => render(<ToastProvider><LockInProvider><Harness /></LockInProvider></ToastProvider>);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("morning card", () => {
  const tasks = [task("Email Sam"), task("Take out trash", { durationMinutes: 5 }), task("College study", { durationMinutes: 120, priority: "must" })];

  it("offers a warm-up, then walks through quick ones before the big one", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 8, 30), shouldAdvanceTime: true });
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), tasks });
    renderCard();
    expect(screen.getByRole("heading", { name: "Warm up, then the big one" })).toBeInTheDocument();
    expect(screen.getByText("2 quick ones · 20 min max")).toBeInTheDocument();
    expect(screen.getByText("10 min on College study")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start my morning" }));
    expect(screen.getByText("Warm-up · 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Email Sam" })).toBeInTheDocument();

    // Twenty minutes later the warm-up is over, even with a quick one left.
    await act(async () => { vi.advanceTimersByTime(21 * 60_000); });
    expect(screen.getByText("The big one")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "College study" })).toBeInTheDocument();
    expect(screen.getByText("Just 10 minutes. You can stop after.")).toBeInTheDocument();
  });

  it("stays out of the way after Not today, and in the afternoon", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 8, 30), shouldAdvanceTime: true });
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), tasks });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Not today" }));
    expect(screen.getByText("Now")).toBeInTheDocument();
    cleanup(); localStorage.clear();

    vi.setSystemTime(new Date(2026, 8, 28, 15, 0));
    lifeService.saveLocalLife({ ...emptyLifeSnapshot(), tasks });
    renderCard();
    expect(screen.queryByRole("button", { name: "Start my morning" })).toBeNull();
  });
});
