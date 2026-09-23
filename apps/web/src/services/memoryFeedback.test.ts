import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadEvolution, loadImprints, logout, rateContextualReturn, reflectOnMemory } from "./api";
import { mergeMemoryFeedback, readMemoryFeedback, saveMemoryFeedback } from "./memoryFeedback";

const baseUrl = "https://feedback.remember.test";
describe("durable memory feedback", () => {
  beforeEach(() => localStorage.clear());

  it("keeps local check-ins and dismissal preferences across visits", async () => {
    expect(await reflectOnMemory("memory", "no_longer_relevant")).toBe(true);
    expect(await rateContextualReturn("other", "not_today")).toBe(true);
    expect(readMemoryFeedback()).toMatchObject({
      reflections: [{ itemId: "memory", response: "no_longer_relevant" }],
      returnFeedback: [{ itemId: "other", response: "not_today" }],
    });
  });

  it("does not remember a rejected remote response as successful", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({}, { status: 503 }));
    expect(await reflectOnMemory("memory", "no_longer_relevant", baseUrl, fetcher)).toBe(false);
    expect(await rateContextualReturn("memory", "not_today", baseUrl, fetcher)).toBe(false);
    expect(readMemoryFeedback(baseUrl)).toEqual({ reflections: [], returnFeedback: [] });
  });

  it("uses the acknowledged server timestamp and isolates feedback by archive", async () => {
    const reflection = { id: "server-response", itemId: "memory", response: "still_true" as const, occurredAt: "2026-09-07T18:00:00Z" };
    expect(await reflectOnMemory("memory", "still_true", baseUrl, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ recorded: true, reflection })))).toBe(true);
    expect(readMemoryFeedback(baseUrl).reflections).toEqual([reflection]);
    expect(readMemoryFeedback("https://another.remember.test").reflections).toEqual([]);
    expect(readMemoryFeedback().reflections).toEqual([]);
  });

  it("retains feedback learned from another device when later reads fail", async () => {
    const reflection = { id: "other-device", itemId: "memory", response: "no_longer_relevant", occurredAt: "2026-09-07T18:00:00Z" };
    const overview = { themes: [], principles: [], tensions: [], timeline: [], reflections: [reflection] };
    await loadEvolution(undefined, baseUrl, vi.fn<typeof fetch>().mockResolvedValue(Response.json(overview)));
    await loadEvolution(undefined, baseUrl, vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Offline")));
    expect(readMemoryFeedback(baseUrl).reflections).toEqual([reflection]);
  });

  it("deduplicates repeated acknowledgements and keeps new decisions first", () => {
    const older = { id: "older", itemId: "memory", response: "no_longer_relevant" as const, occurredAt: "2026-09-07T17:00:00Z" };
    const newer = { ...older, id: "newer", response: "still_true" as const, occurredAt: "2026-09-07T18:00:00Z" };
    saveMemoryFeedback({ reflections: [older] });
    saveMemoryFeedback({ reflections: [newer, older] });
    expect(readMemoryFeedback().reflections).toEqual([newer, older]);
    expect(mergeMemoryFeedback(readMemoryFeedback(), { reflections: [older] }).reflections).toHaveLength(2);
  });

  it("clears the archive feedback cache on sign-out", async () => {
    saveMemoryFeedback({ reflections: [{ id: "private", itemId: "memory", response: "still_true", occurredAt: "2026-09-07T18:00:00Z" }] }, baseUrl);
    await logout(baseUrl, vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));
    expect(readMemoryFeedback(baseUrl).reflections).toEqual([]);
  });

  it("removes deleted-source feedback only after an authoritative library read", async () => {
    saveMemoryFeedback({ reflections: [{ id: "released", itemId: "deleted-memory", response: "no_longer_relevant", occurredAt: "2026-09-07T18:00:00Z" }] }, baseUrl);
    await loadImprints(undefined, baseUrl, vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Offline")));
    expect(readMemoryFeedback(baseUrl).reflections).toHaveLength(1);
    await loadImprints(undefined, baseUrl, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] })));
    expect(readMemoryFeedback(baseUrl).reflections).toEqual([]);
  });
});
