import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { focusTimerStorageKey } from "./life/LifeOS";
import { emptyLifeSnapshot } from "./life/types";
import { AskAPIError, apiConfig } from "./services/api";
import * as apiService from "./services/api";
import * as lifeService from "./services/life";
import { imprints as fixtureImprints } from "./fixtures";

const originalApiBase = apiConfig.baseUrl;

describe("Remember app", () => {
  afterEach(() => { cleanup(); apiConfig.baseUrl = originalApiBase; vi.restoreAllMocks(); });
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = "";
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
  });

  it("uses the system appearance by default while preserving the resolved theme", async () => {
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(localStorage.getItem("remember-theme")).toBe("system");
  });

  it("follows OS appearance changes while System is selected", async () => {
    let notify: ((event: MediaQueryListEvent) => void) | undefined;
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === "(prefers-color-scheme: light)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { if (query === "(prefers-color-scheme: light)") notify = listener as (event: MediaQueryListEvent) => void; },
      removeEventListener: vi.fn(),
    }) as MediaQueryList);
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    act(() => notify?.({ matches: false } as MediaQueryListEvent));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(localStorage.getItem("remember-theme")).toBe("system");
  });

  it("navigates between the core product areas", async () => {
    const user = userEvent.setup();
    render(<App />);
    const primary = screen.getByRole("navigation", { name: "Primary navigation" });
    const primaryButtons = within(primary).getAllByRole("button");
    expect(primaryButtons.map((button) => button.textContent)).toEqual(["Today", "Plan", "Library", "Ask", "Life"]);
    expect(primaryButtons.map((button) => button.getAttribute("aria-label"))).toEqual(["Today", "Plan", "Library", "Ask", "Life"]);
    expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
    await user.click(within(primary).getByRole("button", { name: "Plan" }));
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Plan sections" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Tasks", "Calendar", "Goals"]);
    expect(screen.getAllByRole("button", { name: "Add task" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Add daily basic" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Goals" }));
    expect(screen.getByRole("heading", { name: "Goals" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "New goal" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getAllByRole("button", { name: "Add event" })).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    expect(screen.getByRole("heading", { name: "Your library" })).toBeTruthy();
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Save" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Patterns" }));
    expect(screen.getByRole("heading", { name: "Patterns" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Pattern views" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Compass", "Threads", "Takeaways", "Contrasts", "History"]);
  });

  it("turns a returned idea into a one-tap personal learning loop", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    const checkIn = screen.getByRole("group", { name: "Where does this memory land now?" });
    expect(within(checkIn).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Still true", "I see it differently", "Not sure yet", "Let it go",
    ]);

    await user.click(within(checkIn).getByRole("button", { name: "I see it differently" }));
    expect(await screen.findByText("Your change of mind is part of the story.")).toBeTruthy();
    expect(screen.getByText("Remember will use this as evidence of how your thinking has evolved.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "See how I’m changing" }));
    expect(screen.getByRole("heading", { name: "Patterns" })).toBeTruthy();
  });

  it("keeps a released cue in the library without offering it on the next visit", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    await user.click(screen.getByRole("button", { name: "Let it go" }));
    expect(await screen.findByText("Released from your current guidance.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done with this return" }));
    expect(screen.getByText("No idea is waiting for this moment yet")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    expect(screen.getAllByText(fixtureImprints[0].title).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Today" })[0]);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    expect(screen.getByText("No idea is waiting for this moment yet")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Where does this memory land now?" })).toBeNull();
  });

  it("fulfills a dated return and gives the next memory a fresh check-in", async () => {
    const user = userEvent.setup();
    const items = fixtureImprints.slice(0, 2).map((item, index) => ({
      ...item, returnCue: "date" as const, returnAt: `2026-08-0${index + 1}T09:00:00Z`,
    }));
    vi.spyOn(apiService, "loadImprints").mockResolvedValue({ items, source: "local" });
    render(<App />);
    await screen.findByRole("group", { name: "Where does this memory land now?" });
    await user.click(screen.getByRole("button", { name: "Still true" }));
    expect(await screen.findByText("Kept as part of your compass.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done with this return" }));
    expect(screen.getByText(items[1].essence)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Still true" })).toBeTruthy();
    expect(screen.queryByText("Kept as part of your compass.")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Today" })[0]);
    expect(screen.getByText(items[1].essence)).toBeTruthy();
  });

  it("keeps a contextual card visible when Not for today fails", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("remember-ask-recent-question-v1", JSON.stringify({ question: "How can I protect focused creative work?", askedAt: new Date().toISOString() }));
    vi.spyOn(apiService, "rateContextualReturn").mockResolvedValue(false);
    render(<App />);
    const dismiss = await screen.findByRole("button", { name: "Not for today" });
    await user.click(dismiss);
    expect(await screen.findByText("That preference was not saved. Please try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not for today" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Where does this memory land now?" })).toBeTruthy();
  });

  it("carries a contextual check-in into the compass", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("remember-ask-recent-question-v1", JSON.stringify({ question: "How can I protect focused creative work?", askedAt: new Date().toISOString() }));
    render(<App />);
    await screen.findByRole("button", { name: "Not for today" });
    await user.click(screen.getByRole("button", { name: "I see it differently" }));
    expect(await screen.findByText("Your change of mind is part of the story.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "See how I’m changing" }));
    expect(await screen.findByText("You said this no longer feels the same.")).toBeTruthy();
  });

  it("does not restore an old return when a delayed check-in finishes after changing needs", async () => {
    const user = userEvent.setup();
    let acknowledge!: (saved: boolean) => void;
    vi.spyOn(apiService, "reflectOnMemory").mockReturnValue(new Promise<boolean>((resolve) => { acknowledge = resolve; }));
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    await user.click(screen.getByRole("button", { name: "Still true" }));
    await user.click(screen.getByRole("button", { name: "Focus" }));
    await act(async () => acknowledge(true));
    expect(screen.queryByText("Kept as part of your compass.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Before focused work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Still true" })).toBeTruthy();
  });

  it("turns repeated ideas into an explorable line of thought", async () => {
    const user = userEvent.setup();
    window.location.hash = "/evolution";
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Threads" }));
    expect(screen.getByRole("heading", { name: "Ideas that keep finding you" })).toBeTruthy();
    const identity = screen.getByRole("tab", { name: /Identity Still unresolved · 3 saves/i });
    expect(identity).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Still unresolved")).toBeTruthy();
    expect(screen.getByText("You left this open")).toBeTruthy();
    expect(screen.getByText("Where it started")).toBeTruthy();
    expect(screen.getAllByText("Uncertainty is not empty time. It is where a self becomes negotiable.")).toHaveLength(2);
    expect(screen.getByText("Where it is now")).toBeTruthy();
    expect(screen.getByText("Pain can become useful without needing to be called good.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Explore in Ask/i }));
    expect(screen.getByRole("heading", { name: "Ask" })).toBeTruthy();
    expect(screen.getByLabelText("Ask your library")).toHaveValue("What would help me know what I think about identity, without forcing an answer too early?");
  });

  it("turns chosen ideas and real-life experiments into a personal compass", async () => {
    const user = userEvent.setup();
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{
      id: "practice-1", goalId: null, title: "Make before consuming", firstStep: "Create for fifteen minutes",
      notes: "Carried forward from “The shape of a creative life”.\nhttps://example.com/creative-life",
      area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 15,
      dueAt: null, scheduledStart: null, scheduledEnd: null, source: "practice", completedAt: null,
      createdAt: timestamp, updatedAt: timestamp,
    }];
    localStorage.setItem("remember-life-os-v1", JSON.stringify(snapshot));
    window.location.hash = "/evolution";
    render(<App />);

    expect(screen.getByRole("heading", { name: "What you’re carrying now" })).toBeTruthy();
    expect(screen.getByText("Protect a small daily window for making before consuming.")).toBeTruthy();
    expect(screen.getAllByText("Make before consuming").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /From The shape of a creative life/i })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Keep" }));
    await waitFor(() => expect(screen.getByText("During a hard period, notice what it is changing instead of treating the whole period as wasted.")).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "Release" })).toHaveLength(2);
  });

  it("learns what happened when a saved idea is tested in real life", async () => {
    const user = userEvent.setup();
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{
      id: "practice-result-1", goalId: null, title: "Make before consuming", firstStep: "Create for fifteen minutes",
      notes: "Carried forward from “The shape of a creative life”.\nhttps://example.com/creative-life",
      area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 15,
      dueAt: null, scheduledStart: null, scheduledEnd: null, source: "practice", sourceItemId: "creative-life", completedAt: null,
      createdAt: timestamp, updatedAt: timestamp,
    }];
    lifeService.saveLocalLife(snapshot);
    render(<App />);

    await user.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Plan" }));
    await user.click(screen.getByRole("button", { name: "Finish experiment" }));
    expect(screen.getByRole("heading", { name: "What happened when you tried it?" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "It helped I want to carry this forward" }));
    await user.type(screen.getByLabelText(/What did you notice/i), "Starting first changed the whole session.");
    await user.click(screen.getByRole("button", { name: "Finish and remember this" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("button", { name: "Patterns" }));
    expect(screen.getByRole("heading", { name: "What your experiments are teaching you" })).toBeTruthy();
    expect(screen.getByText("This helped. Keep it available as a principle, not just a saved thought.")).toBeTruthy();
    expect(screen.getByText("Starting first changed the whole session.")).toBeTruthy();
    expect(screen.getByText("Already in your compass")).toBeTruthy();
  });

  it("turns a mixed result into an editable next experiment", async () => {
    const user = userEvent.setup();
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{
      id: "practice-mixed-1", goalId: null, title: "Name one useful change", firstStep: "Write one honest sentence",
      notes: "Carried forward from “Your worst years can shape your best life”.\nhttps://www.youtube.com/watch?v=aqz-KE-bpKQ",
      area: "growth", status: "done", priority: "normal", energy: "any", durationMinutes: 15,
      dueAt: null, scheduledStart: null, scheduledEnd: null, source: "practice", sourceItemId: "worst-years",
      practiceOutcome: "mixed", practiceReflection: "Writing helped, but the action was still too broad.", reflectedAt: timestamp,
      completedAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
    }];
    lifeService.saveLocalLife(snapshot);
    const createTask = vi.spyOn(lifeService, "createTask");
    window.location.hash = "/evolution";
    render(<App />);

    expect(screen.getByText("Part of this worked. Change one part before you decide whether it belongs.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Adjust and try again" }));
    const title = screen.getByLabelText("What will you try this time?");
    const firstStep = screen.getByLabelText("What is the first step?");
    await user.clear(title);
    await user.type(title, "Choose one change worth keeping");
    await user.clear(firstStep);
    await user.type(firstStep, "Circle the change that still matters today");
    await user.click(screen.getByRole("button", { name: "Add to Plan" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: "Choose one change worth keeping",
      firstStep: "Circle the change that still matters today",
      source: "practice",
      sourceItemId: "worst-years",
    })));
  });

  it("returns a saved idea that can help with the current task", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{
      id: "active-task",
      goalId: null,
      title: "Protect a focused block for creative work",
      firstStep: "Make before consuming",
      notes: "",
      area: "direction",
      status: "active",
      priority: "normal",
      energy: "any",
      durationMinutes: 15,
      dueAt: null,
      scheduledStart: null,
      scheduledEnd: null,
      source: "manual",
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
    lifeService.saveLocalLife(snapshot);
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByText("For your current task")).toBeTruthy();
    expect(screen.getAllByText("Protect a focused block for creative work").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "The work becomes clearer when identity is not attached to the outcome." })).toBeTruthy();
    expect(screen.getByText(/Remember connected this save to your current task/)).toBeTruthy();

    expect(screen.getByRole("button", { name: "Try this today" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not for today" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Ask about this/i }));
    expect(screen.getByRole("heading", { name: "Ask" })).toBeTruthy();
    expect(screen.getByLabelText("Ask your library")).toHaveValue("What from “The shape of a creative life” could help me with “Protect a focused block for creative work” today?");
  });

  it("turns the week into one useful story and repeats what worked", async () => {
    const user = userEvent.setup();
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{
      id: "weekly-result-1", goalId: null, title: "Make before consuming", firstStep: "Create for fifteen minutes",
      notes: "Carried forward from “The shape of a creative life”.\nhttps://example.com/creative-life",
      area: "work", status: "done", priority: "high", energy: "medium", durationMinutes: 15,
      dueAt: null, scheduledStart: null, scheduledEnd: null, source: "practice", sourceItemId: "creative-life",
      practiceOutcome: "helped", practiceReflection: "Starting first changed the whole session.", reflectedAt: timestamp,
      completedAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
    }];
    lifeService.saveLocalLife(snapshot);
    const createTask = vi.spyOn(lifeService, "createTask");
    render(<App />);

    expect(screen.getByText("This week, remembered")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Something worked." })).toBeTruthy();
    expect(screen.getByText("Starting first changed the whole session.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Repeat what worked" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: "Make before consuming",
      firstStep: "Create for fifteen minutes",
      area: "work",
      priority: "high",
      energy: "medium",
      source: "practice",
      sourceItemId: "creative-life",
    })));
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(screen.getAllByText("Make before consuming").length).toBeGreaterThan(0);
  });

  it("keeps two-option library sorting visible instead of hiding it in a menu", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    const sort = screen.getByRole("group", { name: "Sort library" });
    const newest = within(sort).getByRole("button", { name: "Newest" });
    const oldest = within(sort).getByRole("button", { name: "Oldest" });
    expect(newest).toHaveAttribute("aria-pressed", "true");
    expect(oldest).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(oldest);
    expect(oldest).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Oldest first")).toBeTruthy();
  });

  it("keeps five mobile destinations and every contextual action reachable", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobileNavigation).getAllByRole("button").map((button) => button.textContent)).toEqual(["Today", "Plan", "Library", "Ask", "Life"]);
    const mobileHeader = container.querySelector<HTMLElement>(".mobile-header")!;
    expect(within(mobileHeader).getByRole("button", { name: "Save" })).toBeTruthy();
    expect(within(mobileHeader).getByRole("button", { name: "Open settings" })).toBeTruthy();

    await user.click(within(mobileNavigation).getByRole("button", { name: "Life" }));
    const lifeSections = screen.getByRole("navigation", { name: "Life sections" });
    expect(within(lifeSections).getAllByRole("button").map((button) => button.textContent)).toEqual(["Health", "Money", "Files"]);
    expect(screen.getAllByRole("button", { name: "Log weight" })).toHaveLength(1);
    await user.click(within(lifeSections).getByRole("button", { name: "Money" }));
    expect(screen.getAllByRole("button", { name: "Add transaction" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Add account" })).toHaveLength(1);
    await user.click(within(screen.getByRole("navigation", { name: "Life sections" })).getByRole("button", { name: "Files" }));
    expect(screen.getAllByRole("button", { name: "Upload file" })).toHaveLength(1);
  });

  it("keeps legacy hashes and browser-driven route changes synchronized", async () => {
    window.location.hash = "/patterns";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Patterns" })).toBeTruthy();

    window.location.hash = "/calendar";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeTruthy();

    window.location.hash = "/you";
    fireEvent(window, new HashChangeEvent("hashchange"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Health" })).toBeTruthy());
  });

  it("keeps connected saves grouped into one compact grid column", async () => {
    window.location.hash = "/library/item/worst-years";
    const { container } = render(<App />);
    const connections = container.querySelectorAll<HTMLButtonElement>(".connection-list button");
    expect(connections).toHaveLength(2);
    for (const connection of connections) {
      expect(Array.from(connection.children).map((child) => child.classList.contains("connection-copy") ? "copy" : child.tagName.toLowerCase())).toEqual(["span", "copy", "svg"]);
      expect(connection.querySelector(".connection-copy > strong")).toBeTruthy();
      expect(connection.querySelector(".connection-copy > small")).toBeTruthy();
    }
  });

  it("carries a saved experiment into Plan with its source intact", async () => {
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    window.location.hash = "/library/item/worst-years";
    render(<App />);

    expect(screen.getByRole("heading", { name: "Don’t just save the idea. Try it." })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Try this" })[0]);

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      firstStep: "Write down one useful change this difficult season revealed, then choose one action that honors it.",
      source: "practice",
      status: "queued",
    })));
    const createdTask = createTask.mock.calls[0][0];
    expect(createdTask.notes).toContain("Your worst years can shape your best life");
    expect(createdTask.notes).toContain("https://");

    const openPlan = await screen.findByRole("button", { name: "Added to Plan" });
    await user.click(openPlan);
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByText(createdTask.title)).toBeTruthy();
  });

  it("validates capture links and labels an offline-only save honestly", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
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
    expect(screen.getByText("New YouTube save")).toBeTruthy();
  });

  it("recognizes TikTok captures as playable TikTok sources", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await user.type(screen.getByLabelText("Link"), "https://www.tiktok.com/@scout2015/video/6718335390845095173");
    await user.click(screen.getByRole("button", { name: /Save now/i }));

    expect(screen.getByRole("heading", { name: "Saved on this device" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("New TikTok save")).toBeTruthy());
    expect(screen.getByText("TikTok")).toBeTruthy();
  });

  it("captures the user’s own thought without asking for a link", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await user.click(screen.getByRole("button", { name: "Thought" }));
    const thought = "The first quiet hour is where I can hear myself think.";
    await user.type(screen.getByLabelText("Your thought"), thought);
    await user.click(screen.getByRole("button", { name: "When I’m stuck" }));
    await user.click(screen.getByRole("button", { name: /Save now/i }));

    expect(screen.getByRole("heading", { name: "Saved on this device" })).toBeTruthy();
    expect(screen.getByText("Reconnect to upload it and begin analysis.")).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem(apiConfig.storageKey)).toContain('"sourceType":"Thought"'));
    await waitFor(() => expect(screen.getAllByText(thought).length).toBeGreaterThan(0));
  });

  it("shows one thought after the server assigns its saved identity", async () => {
    const user = userEvent.setup();
    const thought = "Make room to think before saying yes.";
    vi.spyOn(apiService, "loadImprints").mockResolvedValue({ items: [], source: "api" });
    vi.spyOn(apiService, "saveImprint").mockImplementation(async (draft) => ({
      item: { ...draft, id: "saved-thought", url: "remember://thought/saved-thought", syncState: "synced" },
      synced: true, deduplicated: false,
    }));
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await user.click(screen.getByRole("button", { name: "Thought" }));
    await user.type(screen.getByLabelText("Your thought"), thought);
    await user.click(screen.getByRole("button", { name: /Save now/i }));
    await screen.findByRole("heading", { name: "Saved" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);

    expect(within(screen.getByRole("main")).getAllByRole("button", { name: /Make room to think before saying yes/ })).toHaveLength(1);
  });

  it("traps dialog focus, closes on Escape, and restores the invoking control", async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getAllByRole("button", { name: "Save" })[0];
    trigger.focus();
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Link")).toBe(document.activeElement));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toBe(document.activeElement));
  });

  it("keeps grounded sources tucked behind a disclosure", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await user.click(screen.getByRole("button", { name: /Where do my saved ideas disagree/i }));
    expect(screen.getByText(/Where do my saved ideas disagree/i)).toBeTruthy();
    expect(await screen.findByText(/Two instincts sit in tension/i, {}, { timeout: 1800 })).toBeTruthy();
    expect(screen.getByText("From your saves")).toBeTruthy();
    const supportingSaves = screen.getByText("Supporting saves");
    const disclosure = supportingSaves.closest("details");
    expect(disclosure?.open).toBe(false);
    await user.click(supportingSaves);
    expect(disclosure?.open).toBe(true);
    expect(screen.getByText("How to live with uncertainty")).toBeTruthy();
  });

  it("turns a grounded Ask answer into a sourced experiment in Plan", async () => {
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await user.click(screen.getByRole("button", { name: /What do I seem to believe about success/i }));

    expect(await screen.findByText("Put this to work")).toBeTruthy();
    expect(screen.getByText("Make something for fifteen minutes before consuming anything tomorrow.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try this experiment" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      firstStep: "Make something for fifteen minutes before consuming anything tomorrow.",
      source: "practice",
    })));
    expect(createTask.mock.calls[0][0].notes).toContain("The shape of a creative life");

    await user.click(await screen.findByRole("button", { name: /Added to Plan/i }));
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByText("Make something for fifteen minutes before consuming anything tomorrow")).toBeTruthy();
  });

  it("recovers a stale Ask conversation once and starts a fresh thread", async () => {
    sessionStorage.setItem("remember-ask-thread-v2", "stale-thread");
    const ask = vi.spyOn(apiService, "askLibrary")
      .mockRejectedValueOnce(new AskAPIError(404, "thread_not_found", "Conversation not found."))
      .mockResolvedValueOnce({
        id: "answer-1",
        role: "assistant",
        text: "Attention keeps returning.",
        citations: [],
        grounded: true,
        limitations: [],
        threadId: "fresh-thread",
      });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await user.type(screen.getByLabelText("Ask your library"), "What keeps returning?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(await screen.findByText("Attention keeps returning.")).toBeTruthy();
    expect(ask).toHaveBeenNthCalledWith(1, "What keeps returning?", undefined, undefined, undefined, "stale-thread");
    expect(ask).toHaveBeenNthCalledWith(2, "What keeps returning?");
    expect(sessionStorage.getItem("remember-ask-thread-v2")).toBe("fresh-thread");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.getByRole("heading", { name: "What are you looking for?" })).toBeTruthy();
    expect(sessionStorage.getItem("remember-ask-thread-v2")).toBeNull();
    expect(sessionStorage.getItem("remember-ask-session-v2")).toBeNull();
  });

  it("shows an actionable Ask failure and retries without duplicating the question", async () => {
    const ask = vi.spyOn(apiService, "askLibrary")
      .mockRejectedValueOnce(new AskAPIError(429, "rate_limited", "Too many requests."))
      .mockResolvedValueOnce({
        id: "answer-2",
        role: "assistant",
        text: "Here is the grounded answer.",
        citations: [],
        grounded: true,
        limitations: [],
        threadId: "thread-2",
      });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await user.type(screen.getByLabelText("Ask your library"), "Where do my ideas disagree?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    const failure = await screen.findByRole("alert");
    expect(within(failure).getByText("Ask needs a moment")).toBeTruthy();
    await user.click(within(failure).getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Here is the grounded answer.")).toBeTruthy();
    expect(screen.getAllByText("Where do my ideas disagree?")).toHaveLength(1);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("enforces the Ask question contract before sending", async () => {
    const ask = vi.spyOn(apiService, "askLibrary");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    const input = screen.getByLabelText("Ask your library");
    expect(input).toHaveAttribute("minlength", "2");
    expect(input).toHaveAttribute("maxlength", "1000");
    await user.type(input, "x");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least two characters");
    expect(ask).not.toHaveBeenCalled();
  });

  it("does not expose notification controls that are not implemented", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Open settings" })[0]);
    expect(screen.queryByRole("switch", { name: "Weekly memory" })).toBeNull();
    expect(screen.queryByText("One relevant idea each Sunday")).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("turns a new move into the single active Reset task", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add task" }));
    await user.type(screen.getByLabelText("Outcome"), "Finish the Personal Life OS shell");
    await user.type(screen.getByLabelText("First physical action"), "Open the app and wire the first route");
    await user.click(screen.getByRole("button", { name: /^Create task/i }));
    expect(await screen.findByRole("heading", { name: "Finish the Personal Life OS shell" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "I can’t do this" }));
    await user.click(screen.getByRole("button", { name: /It’s too big/i }));
    expect(await screen.findByText(/begin for two minutes/i)).toBeTruthy();
  });

  it("shows task choices directly and submits the selected details", async () => {
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.type(screen.getByLabelText("Outcome"), "Prepare the release");
    await user.type(screen.getByLabelText("First physical action"), "Open the release checklist");
    await user.click(screen.getByRole("radio", { name: "Work" }));
    await user.click(screen.getByRole("radio", { name: "25 min" }));
    await user.click(screen.getByRole("radio", { name: "High" }));
    await user.click(screen.getByRole("button", { name: /^Create task/i }));
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ area: "work", durationMinutes: 25, priority: "high" })));
  });

  it("traps focus in Life OS composers and restores it on Escape", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    const trigger = screen.getByRole("button", { name: "Add task" });
    trigger.focus();
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Outcome")).toBe(document.activeElement));
    const hiddenNavigation = document.querySelector<HTMLElement>('.bottom-nav');
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
    expect(hiddenNavigation?.inert).toBe(true);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toBe(document.activeElement));
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeTruthy();
    expect(Boolean(hiddenNavigation?.inert)).toBe(false);
  });

  it("keeps a failed task form open without losing what was typed", async () => {
    vi.spyOn(lifeService, "createTask").mockRejectedValueOnce(new Error("Could not save task."));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    await user.click(screen.getByRole("button", { name: "Add task" }));
    await user.type(screen.getByLabelText("Outcome"), "Keep this exact title");
    await user.type(screen.getByLabelText("First physical action"), "Keep this exact first action");
    await user.click(screen.getByRole("button", { name: /^Create task/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save task.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText("Outcome") as HTMLInputElement).value).toBe("Keep this exact title");
    expect((screen.getByLabelText("First physical action") as HTMLTextAreaElement).value).toBe("Keep this exact first action");
  });

  it("keeps finance currencies separate and records expenses from a positive amount", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.accounts = [
      { id: "usd", externalId: null, name: "US checking", institution: "", type: "checking", balance: 1_000, currency: "USD", source: "manual", lastSyncedAt: null, createdAt: timestamp, updatedAt: timestamp },
      { id: "eur", externalId: null, name: "EU checking", institution: "", type: "checking", balance: 500, currency: "EUR", source: "manual", lastSyncedAt: null, createdAt: timestamp, updatedAt: timestamp },
    ];
    localStorage.setItem("remember-life-os-v1", JSON.stringify(snapshot));
    window.location.hash = "/money";
    const addTransaction = vi.spyOn(lifeService, "addFinanceTransaction");
    const user = userEvent.setup();
    render(<App />);

    const netWorth = screen.getByText("Net worth by currency").parentElement!;
    expect(netWorth.textContent).toContain("€500");
    expect(netWorth.textContent).toContain("$1,000");
    expect(netWorth.textContent).not.toContain("$1,500");

    await user.click(screen.getByRole("button", { name: "Add transaction" }));
    await user.type(screen.getByLabelText("Name or merchant"), "Lunch");
    await user.type(screen.getByLabelText("Amount"), "25");
    const currency = screen.getByRole("combobox", { name: "Currency" });
    expect((currency as HTMLInputElement).value).toMatch(/^USD/);
    await user.click(currency);
    await user.clear(currency);
    await user.type(currency, "CAD");
    await user.click(await screen.findByRole("option", { name: /CAD.*Canadian Dollar/i }));
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(addTransaction).toHaveBeenCalled());
    expect(addTransaction.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ amount: -25, currency: "CAD" }));
  });

  it("keeps a selected file available when its upload fails", async () => {
    window.location.hash = "/files";
    vi.spyOn(lifeService, "uploadVaultFile").mockRejectedValueOnce(new Error("Could not upload file."));
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText("Upload file") as HTMLInputElement;
    await user.upload(input, new File(["notes"], "notes.txt", { type: "text/plain" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not upload file.");
    expect(input.files?.[0]?.name).toBe("notes.txt");
  });

  it("uses an accessible in-app confirmation before permanently deleting a file", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.files = [{ id: "file-1", name: "private-notes.txt", mimeType: "text/plain", sizeBytes: 512, folder: "Vault", tags: [], summary: "", createdAt: timestamp, updatedAt: timestamp }];
    localStorage.setItem("remember-life-os-v1", JSON.stringify(snapshot));
    window.location.hash = "/files";
    const nativeConfirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Delete private-notes.txt" }));
    const confirmation = screen.getByRole("alertdialog", { name: "Delete private-notes.txt?" });
    expect(within(confirmation).getByText("This permanently removes the file from Remember. This cannot be undone.")).toBeTruthy();
    expect(nativeConfirm).not.toHaveBeenCalled();

    await user.click(within(confirmation).getByRole("button", { name: "Keep file" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("private-notes.txt")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete private-notes.txt" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete file" }));
    await waitFor(() => expect(screen.queryByText("private-notes.txt")).toBeNull());
    expect(JSON.parse(localStorage.getItem("remember-life-os-v1") ?? "{}").files).toEqual([]);
  });

  it("keeps persisted focus time when completing the task fails", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{ id: "active-task", goalId: null, title: "Finish carefully", firstStep: "Run the checks", notes: "", area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp }];
    localStorage.setItem("remember-life-os-v1", JSON.stringify(snapshot));
    sessionStorage.setItem(focusTimerStorageKey("active-task"), JSON.stringify({ accumulatedMs: 12_000, startedAt: null }));
    window.location.hash = "/tasks";
    vi.spyOn(lifeService, "completeTask").mockRejectedValueOnce(new Error("Could not complete task."));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not complete task.");
    expect(sessionStorage.getItem(focusTimerStorageKey("active-task"))).toContain("12000");
    expect(screen.getByRole("timer", { name: /Elapsed time/ })).toBeTruthy();
  });

  it("automatically flushes queued Life changes when the connection returns", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    await user.click(screen.getByRole("button", { name: "Add task" }));
    await user.type(screen.getByLabelText("Outcome"), "Sync this when online");
    await user.type(screen.getByLabelText("First physical action"), "Reconnect the app");
    await user.click(screen.getByRole("button", { name: /^Create task/i }));
    await waitFor(() => expect(lifeService.getLifeSyncState().pendingCount).toBe(1));

    let serverTask: ReturnType<typeof emptyLifeSnapshot>["tasks"][number] | null = null;
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/life/tasks" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        const timestamp = new Date().toISOString();
        serverTask = { id: "00000000-0000-4000-8000-000000000099", goalId: body.goalId, title: body.title, firstStep: body.firstStep, notes: body.notes, area: body.area, status: "active", priority: body.priority, energy: body.energy, durationMinutes: body.durationMinutes, dueAt: body.dueAt, scheduledStart: null, scheduledEnd: null, source: body.source, completedAt: null, createdAt: timestamp, updatedAt: timestamp };
        return new Response(JSON.stringify({ task: serverTask }), { status: 201, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ...emptyLifeSnapshot(), tasks: serverTask ? [serverTask] : [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    apiConfig.baseUrl = "https://remember.test";
    fireEvent(window, new Event("online"));

    await waitFor(() => expect(lifeService.getLifeSyncState()).toEqual({ pendingCount: 0, error: null }));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/life/tasks"), expect.objectContaining({ method: "POST" }));
    expect(lifeService.readLocalLife().tasks[0].id).toBe("00000000-0000-4000-8000-000000000099");
  });
});
