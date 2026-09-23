import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

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
  afterEach(cleanup);
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.location.hash = ""; });

  it("finds no serious semantic violations across core views and capture", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await expectAccessible(container, "Home");

    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    await expectAccessible(container, "Tasks");
    for (const page of ["Goals", "Calendar"]) {
      await user.click(screen.getByRole("button", { name: page }));
      await expectAccessible(container, page);
    }

    await user.click(screen.getAllByRole("button", { name: "Life" })[0]);
    await expectAccessible(container, "Health");
    for (const page of ["Money", "Files"]) {
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
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await expectAccessible(container, "Capture");
  });
});
