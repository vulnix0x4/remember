import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig, askLibrary, authHeaders, loadEvolution, loadImprint, loadImprints, loadResurfacedMemory, login, logout, mapApiItem, respondToResurfacing, saveImprint, saveImprintToApi, searchImprints, type ApiItem } from "./api";
import { imprints } from "../fixtures";

describe("fixture-backed API boundary", () => {
  beforeEach(() => localStorage.clear());

  it("loads deterministic fixtures when no API base is configured", async () => {
    expect(apiConfig.baseUrl).toBeNull();
    const result = await loadImprints();
    expect(result.source).toBe("local");
    expect(result.items[0].id).toBe(imprints[0].id);
  });

  it("persists captures locally before an API is available", async () => {
    const item = { ...imprints[0], id: "new-id", url: "https://youtube.com/watch?v=local-save" };
    const result = await saveImprint(item);
    expect(result.synced).toBe(false);
    expect(localStorage.getItem(apiConfig.storageKey)).toContain("local-save");
  });

  it("does not create a second local copy for the same URL", async () => {
    const item = { ...imprints[0], id: "duplicate", url: "https://youtube.com/watch?v=dedupe" };
    await saveImprint(item);
    await saveImprint({ ...item, id: "duplicate-2" });
    const stored = JSON.parse(localStorage.getItem(apiConfig.storageKey) ?? "[]") as typeof imprints;
    expect(stored.filter((entry) => entry.url === item.url)).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("removes every known demo fixture while preserving a real legacy capture", async () => {
    const vamp = { ...imprints[0], id: "user-vamp", title: "Vamp video", url: "https://www.youtube.com/watch?v=vamp1234567" };
    localStorage.setItem(apiConfig.legacyStorageKey, JSON.stringify(imprints));
    localStorage.setItem(apiConfig.storageKey, JSON.stringify([vamp]));

    const result = await loadImprints();

    expect(result.items).toEqual([vamp]);
    expect(result.items.some((item) => item.url.includes("dQw4w9WgXcQ"))).toBe(false);
  });

  it("syncs a non-demo legacy capture into the live account and clears the old cache", async () => {
    const vamp = { ...imprints[2], id: "user-vamp", title: "Vamp video", url: "https://vamp.example/video" };
    const remote: ApiItem = { id: "remote-x", sourceType: "web", originalUrl: "https://x.com/example/status/1", canonicalUrl: "https://x.com/example/status/1", title: "X save", status: "ready", savedAt: "2026-08-22T12:00:00Z", analysis: null };
    const recovered: ApiItem = { id: "remote-vamp", sourceType: "web", originalUrl: vamp.url, canonicalUrl: vamp.url, title: vamp.title, status: "pending", savedAt: "2026-08-22T12:01:00Z", analysis: null };
    localStorage.setItem(apiConfig.legacyStorageKey, JSON.stringify([...imprints, vamp]));
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ items: [remote] }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: recovered, deduplicated: false }), { status: 202, headers: { "content-type": "application/json" } }));

    const result = await loadImprints(undefined, "https://memory.remember.test", fetcher);

    expect(result.items.map((item) => item.id)).toEqual(["remote-x", "remote-vamp"]);
    expect(localStorage.getItem(apiConfig.legacyStorageKey)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("loads every API page without skipping items", async () => {
    const first: ApiItem = { id: "page-1", sourceType: "web", originalUrl: "https://example.com/1", canonicalUrl: "https://example.com/1", title: "One", status: "ready", savedAt: "2026-08-22T12:00:00Z", analysis: null };
    const second: ApiItem = { ...first, id: "page-2", originalUrl: "https://example.com/2", canonicalUrl: "https://example.com/2", title: "Two" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ items: [first], nextCursor: "next-page" }))
      .mockResolvedValueOnce(Response.json({ items: [second], nextCursor: null }));

    const result = await loadImprints(undefined, "https://memory.remember.test", fetcher);

    expect(result.items.map((item) => item.id)).toEqual(["page-1", "page-2"]);
    expect(String(fetcher.mock.calls[1][0])).toContain("cursor=next-page");
  });

  it("maps the backend DTO into the presentation model", () => {
    const apiItem: ApiItem = {
      id: "api-id",
      sourceType: "youtube",
      originalUrl: "https://youtu.be/abc",
      canonicalUrl: "https://www.youtube.com/watch?v=abc",
      title: "A mapped memory",
      author: "Thoughtful Creator",
      thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
      durationSeconds: 198,
      status: "ready",
      savedAt: "2026-08-20T12:00:00.000Z",
      personalReaction: "This captured what I was feeling.",
      analysis: {
        essence: "Keep the useful part.",
        summary: "A source-backed summary.",
        keyIdeas: [{ text: "Attention shapes memory." }],
        keyMoments: [{ seconds: 92, label: "A clear distinction", context: "The source separates memory from storage." }],
        themes: ["Identity"],
        candidatePrinciples: [{ text: "Return to what changes you." }],
        personalRelevanceHypotheses: [{ text: "This may connect to a period of change." }],
        uncertainties: [{ text: "No transcript was available." }],
      },
    };
    const mapped = mapApiItem(apiItem);
    expect(mapped.sourceType).toBe("YouTube");
    expect(mapped.url).toBe(apiItem.canonicalUrl);
    expect(mapped.creator).toBe("Thoughtful Creator");
    expect(mapped.thumbnailUrl).toBe(apiItem.thumbnailUrl);
    expect(mapped.keyIdeas).toEqual(["Attention shapes memory."]);
    expect(mapped.moments[0]).toMatchObject({ time: "1:32", seconds: 92, title: "A clear distinction" });
    expect(mapped.personalReaction).toBe(apiItem.personalReaction);
  });

  it("maps a POST response and sends a public timestamped transcript with the raw reaction", async () => {
    const pending: ApiItem = {
      id: "posted-id",
      sourceType: "web",
      originalUrl: "https://example.com/read",
      canonicalUrl: "https://example.com/read",
      title: null,
      status: "pending",
      savedAt: "2026-08-21T12:00:00.000Z",
      personalReaction: "The raw note",
      analysis: null,
    };
    const transcript = "[0:01] A grounded opening.\n[0:12] A second idea.";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(`# Transcript\n\n## Transcript\n${transcript}\n---\nGenerated by fallback.`))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: pending }), { status: 202, headers: { "content-type": "application/json" } }));
    const local = { ...imprints[0], personalReaction: "The raw note", hypothesis: "A tentative guess" };
    const result = await saveImprintToApi(local, "https://api.remember.test/", fetcher);
    expect(result.item.sourceType).toBe("Article");
    expect(result.item.status).toBe("processing");
    const init = fetcher.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ url: local.url, personalReaction: "The raw note", sourceText: transcript });
    expect(init.credentials).toBe("include");
  });

  it("loads an individual Imprint from local persistence without an API", async () => {
    const result = await loadImprint(imprints[0].id);
    expect(result.source).toBe("local");
    expect(result.item?.id).toBe(imprints[0].id);
  });

  it("loads detail connections and the saved principle state", async () => {
    const item: ApiItem = { id: "detail-id", sourceType: "web", originalUrl: "https://example.com/detail", canonicalUrl: "https://example.com/detail", title: "Detail", status: "ready", savedAt: "2026-08-22T12:00:00Z", analysis: null, analysisScope: "article" };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({
      item,
      connections: [{ fromItemId: "detail-id", toItemId: "related-id" }],
      principles: [{ id: "principle-id", status: "active" }],
    }));

    const result = await loadImprint("detail-id", undefined, "https://memory.remember.test", fetcher);

    expect(result.item?.connectionIds).toEqual(["related-id"]);
    expect(result.item?.principleId).toBe("principle-id");
    expect(result.item?.principleStatus).toBe("active");
    expect(result.item?.analysisScope).toBe("article");
  });

  it("uses development auth locally and bearer auth for a private remote preview", () => {
    expect(authHeaders("http://127.0.0.1:8787")).toEqual({ "x-dev-user-id": "00000000-0000-4000-8000-000000000001" });
    expect(authHeaders("https://preview.remember.test", "private-token")).toEqual({ authorization: "Bearer private-token" });
  });

  it("handles an invalid saved date without throwing", () => {
    const mapped = mapApiItem({ id: "invalid-date", sourceType: "web", originalUrl: "https://example.com", canonicalUrl: "https://example.com", title: null, status: "pending", savedAt: "not-a-date", analysis: null });
    expect(mapped.savedAt).toBe("not-a-date");
    expect(mapped.lifePeriod).toBe("Saved recently");
  });

  it("never exposes raw infrastructure failures as user-facing analysis", () => {
    const mapped = mapApiItem({
      id: "failed-item",
      sourceType: "youtube",
      originalUrl: "https://youtube.com/watch?v=abcdefghijk",
      canonicalUrl: "https://youtube.com/watch?v=abcdefghijk",
      title: "Saved video",
      status: "failed",
      savedAt: "2026-08-22T12:00:00Z",
      processingError: "The operation was aborted due to timeout at provider edge",
      analysis: null,
    });
    expect(mapped.summary).toContain("Your original source is safe");
    expect(mapped.summary.toLowerCase()).not.toContain("timeout");
    expect(mapped.summary.toLowerCase()).not.toContain("provider");
  });

  it("maps semantic search and grounded Ask API responses", async () => {
    const apiItem: ApiItem = { id: "search-id", sourceType: "web", originalUrl: "https://example.com", canonicalUrl: "https://example.com", title: "Result", status: "ready", savedAt: "2026-08-21T12:00:00Z", analysis: null };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [apiItem], query: "identity" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ threadId: "thread-id", answer: "Grounded answer", grounded: true, limitations: ["Saved sources only."], citations: [{ itemId: "search-id", title: "Result", timestampSeconds: 42, url: "https://example.com#moment" }] }), { status: 200 }));
    const search = await searchImprints("identity", imprints, undefined, "http://127.0.0.1:8787", fetcher);
    const answer = await askLibrary("What shaped me?", undefined, "http://127.0.0.1:8787", fetcher);
    expect(search.source).toBe("api");
    expect(search.items[0].sourceType).toBe("Article");
    expect(answer?.citations?.[0]).toEqual({ imprintId: "search-id", label: "Result", seconds: 42, url: "https://example.com#moment" });
    expect(answer?.grounded).toBe(true);
    expect(answer?.limitations).toEqual(["Saved sources only."]);
    expect(answer?.threadId).toBe("thread-id");
  });

  it("loads exact evolution counts without deriving client-side trends", async () => {
    const overview = { themes: [{ name: "Discipline", count: 2, lastSeenAt: "2026-08-22T12:00:00Z" }], principles: [], tensions: [], timeline: [{ month: "2026-08", theme: "Discipline", count: 2 }] };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(overview));
    expect(await loadEvolution(undefined, "http://127.0.0.1:8787", fetcher)).toEqual(overview);
    expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:8787/api/evolution");
  });

  it("loads and responds to a resurfaced memory through the API", async () => {
    const memory = { eventId: "event-id", itemId: "item-id", canonicalUrl: "https://example.com", reason: "Worth revisiting", surfacedAt: "2026-08-21T12:00:00Z" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ memory }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recorded: true }), { status: 200 }));
    expect(await loadResurfacedMemory(undefined, "http://127.0.0.1:8787", fetcher)).toEqual(memory);
    expect(await respondToResurfacing("event-id", "still_true", "http://127.0.0.1:8787", fetcher)).toBe(true);
    expect(JSON.parse(String((fetcher.mock.calls[1][1] as RequestInit).body))).toEqual({ response: "still_true" });
  });

  it("uses cookie credentials for login and logout without storing the password", async () => {
    const session = { id: "owner", mode: "password" as const, email: "owner@remember.test" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: session }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await login(session.email, "private-password", "https://memory.remember.test", fetcher)).toEqual(session);
    await logout("https://memory.remember.test", fetcher);
    const loginInit = fetcher.mock.calls[0][1] as RequestInit;
    expect(loginInit.credentials).toBe("include");
    expect(loginInit.headers).toEqual({ "content-type": "application/json" });
    expect(localStorage.getItem("private-password")).toBeNull();
    expect((fetcher.mock.calls[1][1] as RequestInit).credentials).toBe("include");
  });
});
