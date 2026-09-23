import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imprints } from "../fixtures";
import type { Imprint } from "../types";
import { CAPTURE_TIMEOUT_MS, apiConfig, loadImprints, mapApiItem, saveImprint, saveImprintToApi, type ApiItem } from "./api";

const baseUrl = "https://recovery.remember.test";
const thought: Imprint = {
  ...imprints[0], id: "draft-thought", url: "remember://thought/draft-thought",
  sourceType: "Thought", title: "Make room to think", noteText: "Make room to think before saying yes.",
  status: "processing", syncState: "local",
};
const remote: ApiItem = {
  id: "server-thought", sourceType: "note", originalUrl: "remember://thought/server-thought",
  canonicalUrl: "remember://thought/server-thought", title: thought.title, noteText: thought.noteText,
  status: "pending", savedAt: "2026-09-07T18:00:00Z", analysis: null,
};
const cached = () => JSON.parse(localStorage.getItem(apiConfig.storageKey) ?? "[]") as Imprint[];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("capture recovery", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("does not recreate a synced save deleted on another device", async () => {
    localStorage.setItem(apiConfig.storageKey, JSON.stringify([mapApiItem(remote)]));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] }));

    const result = await loadImprints(undefined, baseUrl, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([]);
    expect(cached()).toEqual([]);
  });

  it("reuses a capture identity after the server saved it but the response was lost", async () => {
    localStorage.setItem(apiConfig.storageKey, JSON.stringify([thought]));
    const keys: string[] = [];
    let attempts = 0;
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method !== "POST") return Response.json({ items: [] });
      keys.push(new Headers(init.headers).get("idempotency-key")!);
      if (++attempts === 1) throw new TypeError("Connection lost after commit");
      return Response.json({ item: remote, deduplicated: true });
    });

    expect((await loadImprints(undefined, baseUrl, fetcher)).items[0].syncState).toBe("local");
    const recovered = await loadImprints(undefined, baseUrl, fetcher);

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(recovered.items.map((item) => item.id)).toEqual([remote.id]);
    expect(cached().map((item) => item.id)).toEqual([remote.id]);
  });

  it("does not claim sync succeeded without a saved item in the response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ deduplicated: false }));
    await expect(saveImprintToApi(thought, baseUrl, fetcher)).rejects.toThrow(/incomplete/i);
  });

  it("keeps a new local capture when an older library request finishes", async () => {
    const response = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(response.promise)
      .mockRejectedValue(new TypeError("Offline"));
    const loading = loadImprints(undefined, baseUrl, fetcher);
    await saveImprint(thought);
    response.resolve(Response.json({ items: [] }));

    const result = await loading;

    expect(result.items.map((item) => item.id)).toEqual([thought.id]);
    expect(cached().map((item) => item.id)).toEqual([thought.id]);
  });

  it("stops recovery when a library refresh is cancelled", async () => {
    localStorage.setItem(apiConfig.storageKey, JSON.stringify([thought]));
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => {
      controller.abort();
      return Response.json({ items: [] });
    });

    await expect(loadImprints(controller.signal, baseUrl, fetcher)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cached()[0].id).toBe(thought.id);
  });

  it("gives two separately saved thoughts different capture identities", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ item: remote }));
    await saveImprintToApi(thought, baseUrl, fetcher);
    await saveImprintToApi({ ...thought, id: "a-separate-thought" }, baseUrl, fetcher);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("idempotency-key"))
      .not.toBe(new Headers(fetcher.mock.calls[1][1]?.headers).get("idempotency-key"));
  });

  it("persists the acknowledged server identity before the next refresh", async () => {
    const response = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(response.promise);
    const saving = saveImprint(thought, baseUrl, fetcher);
    expect(cached()[0]).toMatchObject({ id: thought.id, syncState: "local" });
    response.resolve(Response.json({ item: remote }));

    await saving;

    expect(cached()).toHaveLength(1);
    expect(cached()[0]).toMatchObject({ id: remote.id, url: remote.canonicalUrl, syncState: "synced" });
    const refresh = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [remote] }));
    expect((await loadImprints(undefined, baseUrl, refresh)).items).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shares a pending upload with a refresh instead of posting twice", async () => {
    const response = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => init?.method === "POST"
      ? response.promise : Response.json({ items: [] }));
    const saving = saveImprint(thought, baseUrl, fetcher);
    const loading = loadImprints(undefined, baseUrl, fetcher);
    // Let the GET parse and reach the pending capture while its POST is held.
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    response.resolve(Response.json({ item: remote }));

    await saving;
    const result = await loading;

    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(result.items.map((item) => item.id)).toEqual([remote.id]);
  });

  it("preserves a synced capture absent from an earlier GET snapshot", async () => {
    const response = deferred<Response>();
    const refresh = vi.fn<typeof fetch>().mockReturnValueOnce(response.promise);
    const loading = loadImprints(undefined, baseUrl, refresh);
    await saveImprint(thought, baseUrl, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ item: remote })));
    response.resolve(Response.json({ items: [] }));

    expect((await loading).items.map((item) => item.id)).toEqual([remote.id]);
    expect(cached().map((item) => item.id)).toEqual([remote.id]);
  });

  it("keeps the unsynced badge after a failed upload and reload", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Offline"));
    await saveImprint({ ...thought, syncState: undefined }, baseUrl, fetcher);

    expect((await loadImprints(undefined, baseUrl, fetcher)).items[0].syncState).toBe("local");
  });

  it("releases a stalled upload and retains the draft for a successful retry", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const saving = saveImprint(thought, baseUrl, fetcher);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);

    expect(await saving).toMatchObject({ synced: false, item: { id: thought.id, syncState: "local" } });
    expect(cached()[0].id).toBe(thought.id);
    const retry = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ item: remote }));
    expect(await saveImprint(thought, baseUrl, retry)).toMatchObject({ synced: true, item: { id: remote.id } });
    expect(new Headers(retry.mock.calls[0][1]?.headers).get("idempotency-key"))
      .toBe(new Headers(fetcher.mock.calls[0][1]?.headers).get("idempotency-key"));
  });
});
