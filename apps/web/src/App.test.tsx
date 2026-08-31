import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { apiConfig } from "./services/api";

describe("Remember app", () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
  });

  it("uses dark mode by default", async () => {
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(localStorage.getItem("remember-theme")).toBe("dark");
  });

  it("navigates between the core product areas", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: "Your memory." })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    expect(screen.getByRole("heading", { name: "Your library" })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Evolution" })[0]);
    expect(screen.getByRole("heading", { name: "Your evolution" })).toBeTruthy();
  });

  it("validates capture links and labels an offline-only save honestly", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Save something/i }));
    const input = screen.getByLabelText("Link");
    await user.type(input, "not a link");
    await user.click(screen.getByRole("button", { name: /Save now/i }));
    expect(screen.getByRole("alert").textContent).toContain("complete public link");
    await user.clear(input);
    await user.type(input, "https://youtube.com/watch?v=new-memory");
    await user.click(screen.getByRole("button", { name: /Save now/i }));
    expect(screen.getByRole("heading", { name: "Saved on this device" })).toBeTruthy();
    expect(screen.getByText("Reconnect to upload it and begin analysis.")).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem(apiConfig.storageKey)).toContain("new-memory"));
    expect(screen.getByText("New YouTube Imprint")).toBeTruthy();
  });

  it("recognizes TikTok captures as playable TikTok sources", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Save something/i }));
    await user.type(screen.getByLabelText("Link"), "https://www.tiktok.com/@scout2015/video/6718335390845095173");
    await user.click(screen.getByRole("button", { name: /Save now/i }));

    expect(screen.getByRole("heading", { name: "Saved on this device" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("New TikTok Imprint")).toBeTruthy());
    expect(screen.getByText("TikTok")).toBeTruthy();
  });

  it("traps dialog focus, closes on Escape, and restores the invoking control", async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getByRole("button", { name: /Save something/i });
    trigger.focus();
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Link")).toBe(document.activeElement));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toBe(document.activeElement));
  });

  it("shows grounded citations after asking a suggested question", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await user.click(screen.getByRole("button", { name: /Where do my saved ideas disagree/i }));
    expect(screen.getByText(/Where do my saved ideas disagree/i)).toBeTruthy();
    expect(await screen.findByText(/Two instincts sit in tension/i, {}, { timeout: 1800 })).toBeTruthy();
    expect(screen.getByText("Sources")).toBeTruthy();
  });

  it("does not expose notification controls that are not implemented", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    expect(screen.queryByRole("switch", { name: "Weekly memory" })).toBeNull();
    expect(screen.queryByText("One relevant idea each Sunday")).toBeNull();
  });

  it("turns a new move into the single active Reset task", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Tasks" })[0]);
    expect(screen.getByRole("heading", { name: "Do the next right thing." })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add move" }));
    await user.type(screen.getByLabelText("Outcome"), "Finish the Personal Life OS shell");
    await user.type(screen.getByLabelText("First physical action"), "Open the app and wire the first route");
    await user.click(screen.getByRole("button", { name: /Add to the path/i }));
    expect(await screen.findByRole("heading", { name: "Finish the Personal Life OS shell" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "I can’t do this" }));
    await user.click(screen.getByRole("button", { name: /It’s too big/i }));
    expect(await screen.findByText(/begin for two minutes/i)).toBeTruthy();
  });

  it("traps focus in Life OS composers and restores it on Escape", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Tasks" })[0]);
    const trigger = screen.getByRole("button", { name: "Add move" });
    trigger.focus();
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Outcome")).toBe(document.activeElement));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toBe(document.activeElement));
  });
});
