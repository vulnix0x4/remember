import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainSettings, type BrainState } from "@remember/domain";
import { ToastProvider } from "../ui/Toast";
import { savedNightId } from "./sleep";
import { SleepPage } from "./SleepPage";
import { emptyLifeSnapshot, type HealthMetric } from "./types";

/** A local moment in September 2026. Day 28 is a Monday. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);
const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

function brainWith(settings: Record<string, unknown> = {}): BrainState {
  return {
    settings: brainSettingsSchema.parse({ timeZone: "America/Denver", preferences: "Mornings are best", ...settings }), status: "ready", message: "", model: null,
    evaluatedAt: null, nextCheckAt: null, plan: [], contextUsed: [], unscheduledCount: 0,
  };
}
const sleepOn = (extra: Record<string, unknown> = {}) => brainWith({ sleep: { enabled: true, ...extra } });

let sequence = 0;
function healthNight(asleep: Date, woke: Date): HealthMetric {
  sequence += 1;
  return {
    id: `night-${sequence}`, externalId: `healthkit.sleep.${sequence}`, type: "sleep", value: hoursBetween(asleep, woke), unit: "hr",
    startAt: asleep.toISOString(), endAt: woke.toISOString(), source: "Apple Health", metadata: { aggregation: "healthkit_sleep_union" }, createdAt: woke.toISOString(),
  };
}
function savedNight(key: string, bed: Date, up: Date, latency = 15): HealthMetric {
  sequence += 1;
  const asleep = new Date(bed.getTime() + latency * 60_000);
  return {
    id: `saved-${sequence}`, externalId: savedNightId(key), type: "sleep", value: hoursBetween(asleep, up), unit: "hr",
    startAt: asleep.toISOString(), endAt: up.toISOString(), source: "Remember",
    metadata: { aggregation: "remember_night", bedAt: bed.toISOString(), rating: "okay", latency: String(latency) }, createdAt: up.toISOString(),
  };
}

/** Renders Life → Sleep with Jev's settings kept in state, the way the server hands them back. */
function renderSleep(brain: BrainState | null, health: HealthMetric[] = [], { fail = false } = {}) {
  const saved: BrainSettings[] = [];
  const onOpenSettings = vi.fn();
  function Harness() {
    const [current, setCurrent] = useState(brain);
    const life = {
      brain: current, brainError: "", brainWorking: false,
      refreshBrain: async (settings?: BrainSettings) => {
        if (!settings) return;
        if (fail) throw new Error("Your automatic plan could not sync.");
        saved.push(settings);
        setCurrent((value) => value ? { ...value, settings } : value);
      },
      snapshot: { ...emptyLifeSnapshot(), health },
    };
    return <SleepPage life={life} onOpenSettings={onOpenSettings} />;
  }
  render(<ToastProvider><Harness /></ToastProvider>);
  return { saved, onOpenSettings };
}

beforeEach(() => { vi.useFakeTimers({ now: at(28, 18), shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Life → Sleep", () => {
  it("invites you to turn on phone-free nights, then opens Settings", async () => {
    const brain = brainWith();
    const { saved, onOpenSettings } = renderSleep(brain);
    expect(screen.getByText("Phone-free nights")).toBeInTheDocument();
    expect(screen.getByText("Tap Going to bed when you’re done for the night. Your phone stays quiet until you’re up.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(onOpenSettings).toHaveBeenCalledOnce());
    expect(saved).toEqual([{ ...brain.settings, sleep: { enabled: true, morningMinutes: 60, caffeineReminder: true } }]);
  });

  it("stays off, with an error, when turning on doesn't save", async () => {
    const { onOpenSettings } = renderSleep(brainWith(), [], { fail: true });
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sleep settings didn’t save. Try again.");
    expect(screen.getByRole("button", { name: "Turn on" })).toBeInTheDocument();
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it("explains what's missing without Jev's settings", () => {
    renderSleep(null);
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Connect your Remember server to use sleep.");
  });

  it("asks about tonight and points to the iPhone, with no button to press here", () => {
    renderSleep(sleepOn());
    const tonight = screen.getByRole("region", { name: "Done for the night?" });
    expect(within(tonight).getByText("Tonight")).toBeInTheDocument();
    expect(within(tonight).getByText("Tap when you start winding down. Your phone stays quiet until you’re up.")).toBeInTheDocument();
    expect(within(tonight).getByText("Tap Going to bed on your iPhone.")).toBeInTheDocument();
    expect(within(tonight).queryByRole("button")).toBeNull();
    expect(within(tonight).queryByText(/^Last night/)).toBeNull();
  });

  it("adds last night once it was saved", () => {
    renderSleep(sleepOn(), [savedNight("2026-09-27", at(28, 0, 25), at(28, 7, 35))]);
    const tonight = screen.getByRole("region", { name: "Done for the night?" });
    expect(within(tonight).getByText("Last night 12:40 AM – 7:35 AM · 6 hr 55 min")).toBeInTheDocument();
  });

  it("charts the last seven nights with three numbers and one tip", () => {
    const health = [
      savedNight("2026-09-21", at(21, 23, 40), at(22, 7, 30)),
      savedNight("2026-09-22", at(23, 0, 20), at(23, 7, 20)),
      savedNight("2026-09-23", at(24, 1, 10), at(24, 9, 0)),
      healthNight(at(24, 23, 55), at(25, 7, 40)),
      savedNight("2026-09-25", at(25, 23, 30), at(26, 7, 30)),
    ];
    renderSleep(sleepOn(), health);
    const nights = screen.getByRole("region", { name: "Last 7 nights" });
    expect(within(nights).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "MonMonday, 11:55 PM to 7:30 AM, 7 hr 35 min",
      "TueTuesday, 12:35 AM to 7:20 AM, 6 hr 45 min",
      "WedWednesday, 1:25 AM to 9 AM, 7 hr 35 min",
      "ThuThursday, 11:55 PM to 7:40 AM, 7 hr 45 min",
      "FriFriday, 11:45 PM to 7:30 AM, 7 hr 45 min",
    ]);
    expect(nights.querySelectorAll(".sleep-bar")).toHaveLength(5);
    // Faint lines at the usual bedtime and wake-up, labeled on the axis.
    expect(nights.querySelectorAll(".sleep-guides i")).toHaveLength(2);
    expect([...nights.querySelectorAll(".sleep-axis span")].map((label) => label.textContent)).toEqual(["11:55 PM", "7:30 AM"]);
    const average = health.reduce((sum, night) => sum + night.value, 0) / health.length;
    expect(within(nights).getByText(`${average.toFixed(1)} hr`).nextSibling).toHaveTextContent("average");
    expect(within(nights).getByText("usual bedtime").previousSibling).toHaveTextContent("11:55 PM");
    expect(within(nights).getByText("wake-up range").previousSibling).toHaveTextContent("1 hr 40 min");
    const tip = screen.getByRole("region", { name: "Same wake-up time, every day" });
    expect(within(tip).getByText("Weekends too. It’s the single biggest fix.")).toBeInTheDocument();
    expect(within(tip).queryByRole("button")).toBeNull();
  });

  it("waits for three nights before showing a usual bedtime", () => {
    renderSleep(sleepOn(), [savedNight("2026-09-26", at(26, 23, 30), at(27, 7, 30)), savedNight("2026-09-27", at(27, 23, 50), at(28, 7, 40))]);
    const nights = screen.getByRole("region", { name: "Last 7 nights" });
    expect(within(nights).getByText("usual bedtime").previousSibling).toHaveTextContent("—");
    expect(nights.querySelector(".sleep-guides")).toBeNull();
    // The axis is labeled at its ends instead.
    expect([...nights.querySelectorAll(".sleep-axis span")].map((label) => label.textContent)).toEqual(["11 PM", "8 AM"]);
    expect(within(nights).getByText("wake-up range").previousSibling).toHaveTextContent("10 min");
    expect(screen.getByRole("region", { name: "Two taps a day" })).toHaveTextContent("Going to bed at night, I’m up in the morning. That’s how Remember learns your nights.");
  });

  it("says so when there are no nights yet", () => {
    renderSleep(sleepOn());
    expect(screen.getByText("No nights yet. Tap Going to bed tonight and I’m up tomorrow.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("heading", { name: "Two taps a day" })).toBeInTheDocument();
  });

  it("opens Settings, and keeps the doctor line at the bottom", () => {
    const { onOpenSettings } = renderSleep(sleepOn());
    fireEvent.click(screen.getByRole("button", { name: "Sleep settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.getByText("Trouble sleeping most nights for weeks? Bring it up with a doctor.")).toBeInTheDocument();
  });
});
