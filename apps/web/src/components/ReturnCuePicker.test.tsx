import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReturnCuePicker } from "./ReturnCuePicker";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each([0, 23])("allows local today at %s hours even across the UTC day boundary", (hour) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 7, hour, 30));
  render(<ReturnCuePicker cue="date" date="2026-09-07" onCue={() => {}} onDate={() => {}} />);
  expect(screen.getByLabelText("Choose a day")).toHaveAttribute("min", "2026-09-07");
});
