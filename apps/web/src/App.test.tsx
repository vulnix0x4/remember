import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { focusTimerStorageKey } from "./life/LifeOS";
import { emptyLifeSnapshot } from "./life/types";
import { dueLabel } from "./life/planning";
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

  it("keeps a selected file available when its upload fails", async () => {
    window.location.hash = "/files";
    vi.spyOn(lifeService, "uploadVaultFile").mockRejectedValueOnce(new Error("Could not upload file."));
    const user = userEvent.setup();
    render(<App />);
    const input = await screen.findByLabelText("Upload file") as HTMLInputElement;
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

  it("automatically flushes queued Life changes when the connection returns", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    await user.type(screen.getByLabelText("Add a task"), "Sync this when online{Enter}");
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

  it("navigates between the five tabs with one add bar and no top-right add buttons", async () => {
    const user = userEvent.setup();
    render(<App />);
    const primary = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primary).getAllByRole("button").map((button) => button.textContent)).toEqual(["Today", "Plan", "Library", "Ask", "Life"]);
    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeTruthy();
    expect(screen.getAllByLabelText("Add a task")).toHaveLength(1);
    await user.click(within(primary).getByRole("button", { name: "Plan" }));
    expect(screen.getByRole("heading", { level: 1, name: "Plan" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Plan sections" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Tasks", "Calendar", "Goals"]);
    expect(screen.getAllByLabelText("Add a task")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^(Add task|New goal|Add event|Save)$/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Goals" }));
    expect(screen.getAllByLabelText("Add a goal")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByRole("group", { name: "Choose a day" })).toBeTruthy();
    expect(screen.getAllByLabelText("Add a task")).toHaveLength(1);
    await user.click(within(primary).getByRole("button", { name: "Library" }));
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeTruthy();
    expect(screen.getAllByLabelText("Save a link or thought")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Patterns" }));
    expect(screen.getAllByLabelText("Save a link or thought")).toHaveLength(1);
    expect(within(screen.getByRole("group", { name: "Pattern views" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Compass", "Threads", "Takeaways", "Contrasts", "History"]);
    await user.click(within(primary).getByRole("button", { name: "Ask" }));
    expect(screen.getAllByLabelText("Ask your library")).toHaveLength(1);
    await user.click(within(primary).getByRole("button", { name: "Life" }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps five mobile destinations and every Life action reachable", async () => {
    const user = userEvent.setup();
    render(<App />);
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobileNavigation).getAllByRole("button").map((button) => button.textContent)).toEqual(["Today", "Plan", "Library", "Ask", "Life"]);
    expect(screen.getByRole("button", { name: "Open settings" })).toBeTruthy();
    await user.click(within(mobileNavigation).getByRole("button", { name: "Life" }));
    const lifeSections = screen.getByRole("navigation", { name: "Life sections" });
    expect(within(lifeSections).getAllByRole("button").map((button) => button.textContent)).toEqual(["Health", "Money", "Files"]);
    expect(await screen.findByRole("button", { name: "Log weight" })).toBeTruthy();
    await user.click(within(lifeSections).getByRole("button", { name: "Money" }));
    expect(await screen.findByRole("button", { name: "Add an account" })).toBeTruthy();
    expect(screen.getByLabelText("Add a transaction")).toBeTruthy();
    await user.click(within(screen.getByRole("navigation", { name: "Life sections" })).getByRole("button", { name: "Files" }));
    expect(await screen.findByRole("button", { name: "Add a file" })).toBeTruthy();
  });

  it("keeps legacy hashes and browser-driven route changes synchronized", async () => {
    window.location.hash = "/patterns";
    render(<App />);
    expect(screen.getByRole("group", { name: "Pattern views" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Patterns" })).toHaveAttribute("aria-current", "page");

    window.location.hash = "/calendar";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(await screen.findByRole("group", { name: "Choose a day" })).toBeTruthy();

    window.location.hash = "/you";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(await screen.findByRole("button", { name: "Log weight" })).toBeTruthy();
  });

  it("brings a kept idea back from a Library moment and records where it lands", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    const checkIn = screen.getByRole("group", { name: "Where does this memory land now?" });
    expect(within(checkIn).getAllByRole("button").map((button) => button.textContent)).toEqual(["Still true", "I see it differently", "Not sure yet", "Let it go"]);
    await user.click(within(checkIn).getByRole("button", { name: "I see it differently" }));
    expect(await screen.findByText("Your change of mind is part of the story.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "See how I’m changing" }));
    expect(screen.getByRole("group", { name: "Pattern views" })).toBeTruthy();
    expect(await screen.findByText("You said this no longer feels the same.")).toBeTruthy();
  });

  it("does not offer a released idea again but keeps it in the library", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    await user.click(screen.getByRole("button", { name: "Let it go" }));
    expect(await screen.findByText("Released from your current guidance.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByText(fixtureImprints[0].title).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    expect(screen.queryByRole("group", { name: "Where does this memory land now?" })).toBeNull();
  });

  it("does not restore an old return when a delayed check-in finishes after changing moments", async () => {
    const user = userEvent.setup();
    let acknowledge!: (saved: boolean) => void;
    vi.spyOn(apiService, "reflectOnMemory").mockReturnValue(new Promise<boolean>((resolve) => { acknowledge = resolve; }));
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.click(screen.getByRole("button", { name: "Get unstuck" }));
    await user.click(screen.getByRole("button", { name: "Still true" }));
    await user.click(screen.getByRole("button", { name: "Focus" }));
    await act(async () => acknowledge(true));
    expect(screen.queryByText("Kept as part of your compass.")).toBeNull();
    expect(screen.getByRole("heading", { name: "The work becomes clearer when identity is not attached to the outcome." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Still true" })).toBeTruthy();
  });

  it("shows one idea for today and moves on when it is not for today", async () => {
    const user = userEvent.setup();
    const items = fixtureImprints.slice(0, 2).map((item, index) => ({ ...item, returnCue: "date" as const, returnAt: `2026-08-0${index + 1}T09:00:00Z` }));
    vi.spyOn(apiService, "loadImprints").mockResolvedValue({ items, source: "local" });
    render(<App />);
    expect(await screen.findByText("You kept this for today")).toBeTruthy();
    expect(screen.getByRole("heading", { name: items[0].essence })).toBeTruthy();
    expect(screen.getAllByRole("region", { name: /./ }).filter((region) => region.classList.contains("idea-card"))).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Not today" }));
    expect(screen.getByRole("heading", { name: items[1].essence })).toBeTruthy();
  });

  it("returns a saved idea that can help with the current task and adds its step to Plan", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{ id: "active-task", goalId: null, title: "Protect a focused block for creative work", firstStep: "Make before consuming", notes: "", area: "direction", status: "active", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp }];
    lifeService.saveLocalLife(snapshot);
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("For your current task")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The work becomes clearer when identity is not attached to the outcome." })).toBeTruthy();
    expect(screen.getByText(/Remember connected this save to your current task/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try this today" }));
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ source: "practice", sourceItemId: "creative-life" })));
    expect(await screen.findByText("Added · Jev will fit it in")).toBeTruthy();
  });

  it("keeps the idea visible when Not today fails to save", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("remember-ask-recent-question-v1", JSON.stringify({ question: "How can I protect focused creative work?", askedAt: new Date().toISOString() }));
    vi.spyOn(apiService, "rateContextualReturn").mockResolvedValue(false);
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Not today" }));
    expect((await screen.findByRole("alert")).textContent).toContain("That preference wasn’t saved. Try again.");
    expect(screen.getByRole("button", { name: "Not today" })).toBeTruthy();
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
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("heading", { name: "What happened when you tried it?" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "It helped I want to carry this forward" }));
    await user.type(screen.getByLabelText(/What did you notice/i), "Starting first changed the whole session.");
    await user.click(screen.getByRole("button", { name: "Finish and remember this" }));
    expect(await screen.findByRole("heading", { name: "Done." })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3_000 });
    await user.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("button", { name: "Patterns" }));
    expect(screen.getByRole("heading", { name: "What your experiments are teaching you" })).toBeTruthy();
    expect(screen.getAllByText("Starting first changed the whole session.").length).toBeGreaterThan(0);
  });

  it("turns the week into one useful story in Patterns and repeats what worked", async () => {
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
    window.location.hash = "/evolution";
    render(<App />);
    expect(screen.getByText("This week, remembered")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Repeat what worked" }));
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Make before consuming", priority: "high", source: "practice", sourceItemId: "creative-life" })));
    expect(await screen.findByRole("heading", { level: 1, name: "Plan" })).toBeTruthy();
  });

  it("filters the library with one chip row, including oldest first", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    const filters = screen.getByRole("group", { name: "Filter library" });
    const oldest = within(filters).getByRole("button", { name: "Oldest first" });
    expect(oldest).toHaveAttribute("aria-pressed", "false");
    const firstTitle = () => within(screen.getByRole("main")).getAllByRole("listitem")[0].textContent;
    const newestFirst = firstTitle();
    await user.click(oldest);
    expect(oldest).toHaveAttribute("aria-pressed", "true");
    expect(firstTitle()).not.toBe(newestFirst);
    await user.click(within(filters).getByRole("button", { name: "Thoughts" }));
    expect(within(screen.getByRole("main")).getAllByRole("listitem")).toHaveLength(1);
  });

  it("carries a saved experiment into Plan with its source intact", async () => {
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    window.location.hash = "/library/item/worst-years";
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Try this" })[0]);
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ source: "practice", status: "queued" })));
    const createdTask = createTask.mock.calls[0][0];
    expect(createdTask.notes).toContain("Your worst years can shape your best life");
    await user.click(await screen.findByRole("button", { name: "Added to Plan" }));
    expect(screen.getByRole("heading", { level: 1, name: "Plan" })).toBeTruthy();
    expect((await screen.findAllByText(createdTask.title)).length).toBeGreaterThan(0);
  });

  it("saves a link from the Library bar and says honestly when it only stayed on this device", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    const bar = screen.getByLabelText("Save a link or thought");
    await user.type(bar, "https://youtube.com/watch?v=new-memory worth rewatching{Enter}");
    expect(await screen.findByText("Saved on this device")).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem(apiConfig.storageKey)).toContain("new-memory"));
    expect(screen.getByText("New YouTube save")).toBeTruthy();
    expect(bar).toHaveValue("");
    expect(bar).toBe(document.activeElement);
    await user.type(bar, `${fixtureImprints[0].url}{Enter}`);
    expect((await screen.findByRole("alert")).textContent).toContain("You already saved this");
    expect(bar).toHaveValue(fixtureImprints[0].url);
  });

  it("recognizes TikTok links saved from the bar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.type(screen.getByLabelText("Save a link or thought"), "https://www.tiktok.com/@scout2015/video/6718335390845095173{Enter}");
    expect(await screen.findByText("New TikTok save")).toBeTruthy();
    expect(screen.getByText(/^TikTok ·/)).toBeTruthy();
  });

  it("saves plain words as the user’s own thought", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    const thought = "The first quiet hour is where I can hear myself think.";
    await user.type(screen.getByLabelText("Save a link or thought"), `${thought}{Enter}`);
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
    await user.click(screen.getAllByRole("button", { name: "Library" })[0]);
    await user.type(screen.getByLabelText("Save a link or thought"), `${thought}{Enter}`);
    expect(await screen.findByText("Thought saved")).toBeTruthy();
    expect(within(screen.getByRole("main")).getAllByRole("button", { name: /Make room to think before saying yes/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(window.location.hash).toBe("#/library/item/saved-thought");
  });

  it("turns a grounded Ask answer into a sourced experiment in Plan", async () => {
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Ask" })[0]);
    await user.type(screen.getByLabelText("Ask your library"), "What do I seem to believe about success?{Enter}");
    expect(await screen.findByText("Put this to work")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try this experiment" }));
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ firstStep: "Make something for fifteen minutes before consuming anything tomorrow.", source: "practice" })));
    await user.click(await screen.findByRole("button", { name: /Added to Plan/i }));
    expect(screen.getByRole("heading", { level: 1, name: "Plan" })).toBeTruthy();
  });

  it("adds a task from one typed line and makes it smaller when stuck", async () => {
    const createTask = vi.spyOn(lifeService, "createTask");
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "What’s on your mind?" })).toBeTruthy();
    const bar = screen.getByLabelText("Add a task");
    await user.type(bar, "finish the life os shell 30m !");
    expect(within(screen.getByRole("list", { name: "Understood" })).getAllByRole("listitem").map((chip) => chip.textContent)).toEqual(["30 min", "Important"]);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Finish the life os shell", durationMinutes: 30, priority: "high", status: "queued", area: "direction" })));
    expect(await screen.findByText("Added · Jev will fit it in")).toBeTruthy();
    expect(bar).toHaveValue("");
    expect(bar).toBe(document.activeElement);
    expect(await screen.findByRole("heading", { name: "Finish the life os shell" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Start" }));
    const focus = screen.getByRole("dialog", { name: "Finish the life os shell" });
    expect(within(focus).getByRole("timer", { name: /Time left 30 minutes/ })).toBeTruthy();
    await user.click(within(focus).getByRole("button", { name: "I’m stuck" }));
    expect(screen.getByRole("dialog", { name: "What’s getting in the way?" })).toBeTruthy();
    expect(screen.queryByText(/Choose another task/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "It’s too big" }));
    expect(await screen.findByText("Made it smaller")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText(/begin for two minutes/i)).toBeTruthy();
  });

  it("completes, deletes, and moves tasks aside without confirmation and undoes each", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    const task = (id: string, title: string, status: "active" | "queued") => ({ id, goalId: null, title, firstStep: "", notes: "", area: "direction" as const, status, priority: "normal" as const, energy: "any" as const, durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual" as const, completedAt: null, createdAt: timestamp, updatedAt: timestamp });
    snapshot.tasks = [task("a", "First thing", "active"), task("b", "Second thing", "queued"), task("c", "Third thing", "queued")];
    lifeService.saveLocalLife(snapshot);
    const nativeConfirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    window.location.hash = "/tasks";
    render(<App />);
    const status = (id: string) => lifeService.readLocalLife().tasks.find((item) => item.id === id)?.status;

    await user.click(await screen.findByRole("button", { name: "Complete Second thing" }));
    await waitFor(() => expect(status("b")).toBe("done"));
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(status("b")).toBe("queued"));

    await user.click(await screen.findByRole("button", { name: /^Third thing/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(status("c")).toBe("removed"));
    expect(await screen.findByText("Deleted")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(status("c")).toBe("queued"));

    await user.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Today" }));
    await user.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(lifeService.readLocalLife().tasks.find((item) => item.id === "a")?.notBefore).toBeTruthy());
    expect(await screen.findByText("Moved aside")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(lifeService.readLocalLife().tasks.find((item) => item.id === "a")).toMatchObject({ status: "active", notBefore: null }));
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it("edits a task in its sheet and saves when dismissed", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{ id: "t1", goalId: null, title: "Prepare the release", firstStep: "", notes: "", area: "work", status: "queued", priority: "high", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp }, { id: "t0", goalId: null, title: "Something active", firstStep: "", notes: "", area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp }];
    lifeService.saveLocalLife(snapshot);
    const updateTask = vi.spyOn(lifeService, "updateTask");
    const user = userEvent.setup();
    window.location.hash = "/tasks";
    render(<App />);
    const row = await screen.findByRole("button", { name: /^Prepare the release/ });
    row.focus();
    await user.click(row);
    const sheet = screen.getByRole("dialog");
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    expect(document.querySelector<HTMLElement>(".bottom-nav")?.hasAttribute("inert")).toBe(true);
    await user.type(within(sheet).getByPlaceholderText("Start with…"), "Open the checklist");
    await user.click(within(sheet).getByRole("button", { name: "90 min" }));
    await user.click(within(sheet).getByRole("button", { name: "Weekly" }));
    await user.click(within(sheet).getByRole("switch", { name: "Important" }));
    expect(updateTask).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { firstStep: "Open the checklist", durationMinutes: 90, repeatEveryDays: 7, priority: "normal" }));
    await waitFor(() => expect(row).toBe(document.activeElement));
  });

  it("keeps the typed task when adding fails", async () => {
    vi.spyOn(lifeService, "createTask").mockRejectedValueOnce(new Error("Could not save task."));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Add a task"), "Keep this exact title{Enter}");
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save task.");
    expect(screen.getByLabelText("Add a task")).toHaveValue("Keep this exact title");
  });

  it("keeps finance currencies separate and records expenses from the add bar", async () => {
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
    const netWorth = await screen.findByRole("region", { name: "Net worth by currency" });
    expect(netWorth.textContent).toContain("€500");
    expect(netWorth.textContent).toContain("$1,000");
    expect(netWorth.textContent).not.toContain("$1,500");
    await user.type(screen.getByLabelText("Add a transaction"), "25 lunch{Enter}");
    expect(screen.getByLabelText("Name or merchant")).toHaveValue("Lunch");
    expect(screen.getByLabelText("Amount")).toHaveValue(25);
    const currency = screen.getByRole("combobox", { name: "Currency" });
    await user.click(currency);
    await user.clear(currency);
    await user.type(currency, "CAD");
    await user.click(await screen.findByRole("option", { name: /CAD.*Canadian Dollar/i }));
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(addTransaction).toHaveBeenCalled());
    expect(addTransaction.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ name: "Lunch", amount: -25, currency: "CAD" }));
  });

  it("keeps persisted focus time when completing the task fails", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    snapshot.tasks = [{ id: "active-task", goalId: null, title: "Finish carefully", firstStep: "Run the checks", notes: "", area: "work", status: "active", priority: "normal", energy: "any", durationMinutes: 15, dueAt: null, scheduledStart: null, scheduledEnd: null, source: "manual", completedAt: null, createdAt: timestamp, updatedAt: timestamp }];
    localStorage.setItem("remember-life-os-v1", JSON.stringify(snapshot));
    sessionStorage.setItem(focusTimerStorageKey("active-task"), JSON.stringify({ accumulatedMs: 12_000, startedAt: null }));
    vi.spyOn(lifeService, "completeTask").mockRejectedValueOnce(new Error("Could not complete task."));
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("Doing")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not complete task.");
    expect(sessionStorage.getItem(focusTimerStorageKey("active-task"))).toContain("12000");
    expect(screen.getByRole("timer", { name: /Elapsed time/ })).toBeTruthy();
  });

  it("labels a deadline the same way on the Now card and in Plan", async () => {
    const snapshot = emptyLifeSnapshot();
    const timestamp = new Date().toISOString();
    const due = new Date(); due.setDate(due.getDate() + 2); due.setHours(17, 0, 0, 0);
    const base = { goalId: null, firstStep: "", notes: "", area: "direction" as const, priority: "normal" as const, energy: "any" as const, durationMinutes: 15, scheduledStart: null, scheduledEnd: null, source: "manual" as const, completedAt: null, createdAt: timestamp, updatedAt: timestamp };
    snapshot.tasks = [{ ...base, id: "rent", title: "Pay rent", status: "active", dueAt: due.toISOString() }, { ...base, id: "bills", title: "Pay bills", status: "queued", dueAt: due.toISOString() }];
    lifeService.saveLocalLife(snapshot);
    const expected = dueLabel(snapshot.tasks[0], new Date())!;
    expect(expected).toMatch(/ 5 PM$/);
    const user = userEvent.setup();
    render(<App />);
    expect(within(screen.getByRole("region", { name: "Pay rent" })).getByText(expected)).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /^Pay bills/ })).getByText(new RegExp(expected))).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]);
    expect(within(await screen.findByRole("button", { name: /^Pay bills/ })).getByText(new RegExp(expected))).toBeTruthy();
  });
});
