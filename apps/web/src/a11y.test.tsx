import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brainSettingsSchema, type BrainState } from "@remember/domain";
import { App } from "./App";
import { emptyLifeSnapshot, type HealthMetric } from "./life/types";
import * as autopilot from "./services/autopilot";
import * as lifeService from "./services/life";
import { SETUP_STORAGE_KEY } from "./setup/setupState";

function seriousAccessibilityViolations(container: HTMLElement): string[] {
  const violations: string[] = [];
  const ids = Array.from(container.querySelectorAll<HTMLElement>("[id]")).map((element) => element.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) violations.push(`Duplicate IDs: ${[...new Set(duplicates)].join(", ")}`);

  container.querySelectorAll<HTMLElement>("button, a[href]").forEach((element) => {
    const name = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim();
    if (!name) violations.push(`Unnamed interactive element: ${element.tagName.toLowerCase()}`);
  });
  container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea, select").forEach((element) => {
    const named = element.labels?.length || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby");
    if (!named) violations.push(`Unlabeled form control: ${element.id || element.tagName.toLowerCase()}`);
  });
  container.querySelectorAll<HTMLElement>('[aria-hidden="true"]:not([inert])').forEach((element) => {
    if (element.querySelector("button, a[href], input, textarea, select, [tabindex]")) violations.push("Focusable content is exposed inside aria-hidden content");
  });
  container.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]').forEach((dialog) => {
    if (dialog.getAttribute("aria-modal") !== "true") violations.push("Dialog is missing aria-modal");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    if (!labelledBy || !container.querySelector(`#${labelledBy}`)) violations.push("Dialog is missing a valid accessible label");
  });
  if (container.querySelectorAll("main").length !== 1) violations.push("Page must expose exactly one main landmark");
  if (!container.querySelector("h1")) violations.push("Page is missing a level-one heading");
  return violations;
}

async function automatedAccessibilityViolations(container: HTMLElement): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help}`);
}

async function expectAccessible(container: HTMLElement, view: string): Promise<void> {
  expect(seriousAccessibilityViolations(container), `${view} semantic accessibility`).toEqual([]);
  expect(await automatedAccessibilityViolations(container), `${view} axe accessibility`).toEqual([]);
}

describe("automated serious accessibility gate", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.location.hash = ""; });

  it("finds no serious semantic violations across core views and sheets", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "What’s on your mind?" });
    await expectAccessible(container, "Today");

    await user.type(screen.getByLabelText("Add a task"), "Call mom tomorrow 20m{Enter}");
    await user.type(screen.getByLabelText("Add a task"), "Laundry every week{Enter}");
    await screen.findByRole("heading", { name: "Laundry" });
    await expectAccessible(container, "Today with tasks");

    await user.click(screen.getByRole("button", { name: "Jev is paused" }));
    await screen.findByRole("heading", { name: "Your day" });
    await expectAccessible(container, "Settings from the Jev line");
    await user.click(screen.getByRole("button", { name: "Add chore" }));
    await user.click(screen.getByRole("button", { name: "Add step" }));
    await expectAccessible(document.body, "Chore editor");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Run setup again" }));
    await expectAccessible(document.body, "Setup");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await expectAccessible(document.body, "Setup: your day");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await expectAccessible(document.body, "Setup: sleep");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await expectAccessible(document.body, "Setup: commitments");
    for (let step = 0; step < 4; step += 1) await user.click(screen.getByRole("button", { name: /^(Next|Go to Today)$/ }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    await screen.findByRole("heading", { name: "Later" });
    await expectAccessible(container, "Tasks");
    await user.click(screen.getByRole("button", { name: /^Call mom/ }));
    await expectAccessible(document.body, "Task sheet");
    await user.keyboard("{Escape}");
    for (const page of ["Goals", "Calendar"]) {
      await user.click(screen.getByRole("button", { name: page }));
      await expectAccessible(container, page);
    }

    await user.click(screen.getAllByRole("button", { name: "Life" })[0]);
    await screen.findByRole("button", { name: "Log weight" });
    await expectAccessible(container, "Health");
    for (const page of ["Sleep", "Money", "Files"]) {
      await user.click(screen.getByRole("button", { name: page }));
      await expectAccessible(container, page);
    }
    await user.click(screen.getAllByRole("button", { name: "Open settings" })[0]);
    await expectAccessible(container, "Settings");
    await user.click(screen.getByRole("button", { name: "Back" }));

    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await expectAccessible(container, "Library");
    await user.click(screen.getByRole("button", { name: "Patterns" }));
    await expectAccessible(container, "Patterns");

    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await expectAccessible(container, "Ask");

    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.click(screen.getByRole("button", { name: /Your worst years can shape your best life/i }));
    await expectAccessible(container, "Imprint detail");

    await user.click(screen.getAllByRole("button", { name: "Today" })[0]);
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await expectAccessible(document.body, "Lock-in mode");
    await user.click(screen.getByRole("button", { name: "I’m stuck" }));
    expect(screen.getByRole("dialog", { name: "What’s getting in the way?" })).toBeTruthy();
    await expectAccessible(document.body, "Stuck sheet over lock-in mode");
  }, 30_000);

  it("keeps Sleep accessible while it's on, from Life → Sleep to Settings", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 8), shouldAdvanceTime: true });
    localStorage.setItem(SETUP_STORAGE_KEY, "done");
    const night = (day: number): HealthMetric => {
      const asleep = new Date(2026, 8, day, 23, 40); const woke = new Date(2026, 8, day + 1, 7, 20);
      return { id: `night-${day}`, externalId: `healthkit.sleep.${day}`, type: "sleep", value: 7.5, unit: "hr", startAt: asleep.toISOString(), endAt: woke.toISOString(), source: "Apple Health", metadata: { aggregation: "healthkit_sleep_union" }, createdAt: woke.toISOString() };
    };
    const saved: HealthMetric = {
      id: "saved", externalId: "remember.night.2026-09-28", type: "sleep", value: 7.25, unit: "hr",
      startAt: new Date(2026, 8, 28, 23, 50).toISOString(), endAt: new Date(2026, 8, 29, 7, 5).toISOString(), source: "Remember",
      metadata: { aggregation: "remember_night", bedAt: new Date(2026, 8, 28, 23, 20).toISOString(), rating: "okay", latency: 30 }, createdAt: new Date(2026, 8, 29, 7, 6).toISOString(),
    };
    const brain: BrainState = {
      settings: brainSettingsSchema.parse({ timeZone: "America/Denver", sleep: { enabled: true } }),
      status: "ready", message: "Your next steps are in place.", model: null, evaluatedAt: new Date(2026, 8, 29, 7, 58).toISOString(), nextCheckAt: null, plan: [], contextUsed: [], unscheduledCount: 0,
    };
    vi.spyOn(lifeService, "loadLife").mockResolvedValue({ snapshot: { ...emptyLifeSnapshot(), health: [night(25), night(26), night(27), saved] }, remote: true });
    vi.spyOn(autopilot, "syncBrain").mockResolvedValue(brain);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { container } = render(<App />);

    await screen.findByRole("heading", { name: "What’s on your mind?" });
    // The web has no check-in on Today.
    expect(screen.queryByRole("region", { name: "How did you sleep?" })).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Life" })[0]);
    await user.click(screen.getByRole("button", { name: "Sleep" }));
    const tonight = await screen.findByRole("region", { name: "Done for the night?" }, { timeout: 3_000 });
    expect(within(tonight).getByText("Last night 11:50 PM – 7:05 AM · 7 hr 15 min")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Last 7 nights" })).getAllByRole("listitem")).toHaveLength(4);
    await expectAccessible(container, "Sleep");

    await user.click(screen.getByRole("button", { name: "Sleep settings" }));
    expect(await screen.findByRole("switch", { name: "Phone-free nights" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Caffeine reminder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Early bird/ })).toBeInTheDocument();
    await expectAccessible(container, "Settings with sleep on");
  }, 30_000);
});
