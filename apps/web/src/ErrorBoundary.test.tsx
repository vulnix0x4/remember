import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenView(): never {
  throw new Error("Render failed");
}

describe("ErrorBoundary", () => {
  it("renders an accessible branded recovery state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorBoundary><BrokenView /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /could not open this view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload app" })).toBeTruthy();
    vi.restoreAllMocks();
  });
});
