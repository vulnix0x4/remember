import type { EvolutionOverview } from "./api";

export type MemoryFeedback = Pick<EvolutionOverview, "reflections" | "returnFeedback">;
const emptyFeedback = (): MemoryFeedback => ({ reflections: [], returnFeedback: [] });
const storageKey = (baseUrl?: string | null) => `remember-memory-feedback-v1:${baseUrl?.replace(/\/$/, "") || "local"}`;

export function readMemoryFeedback(baseUrl?: string | null): MemoryFeedback {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(baseUrl)) ?? "null") as MemoryFeedback | null;
    const valid = (entry: { id: string; itemId: string; occurredAt: string }) => entry
      && typeof entry.id === "string" && typeof entry.itemId === "string" && Number.isFinite(Date.parse(entry.occurredAt));
    return {
      reflections: Array.isArray(stored?.reflections) ? stored.reflections.filter((entry) => valid(entry)
        && ["still_true", "changed_mind", "not_sure", "no_longer_relevant"].includes(entry.response)) : [],
      returnFeedback: Array.isArray(stored?.returnFeedback) ? stored.returnFeedback.filter((entry) => valid(entry)
        && ["useful", "not_today"].includes(entry.response)) : [],
    };
  } catch { return emptyFeedback(); }
}

export function mergeMemoryFeedback(...sources: Array<Partial<MemoryFeedback> | null>): MemoryFeedback {
  const merge = <T extends { id: string; occurredAt: string }>(values: T[]) => [...new Map(values.map((entry) => [entry.id, entry])).values()]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  return {
    reflections: merge(sources.flatMap((source) => source?.reflections ?? [])),
    returnFeedback: merge(sources.flatMap((source) => source?.returnFeedback ?? [])),
  };
}

export function saveMemoryFeedback(feedback: Partial<MemoryFeedback>, baseUrl?: string | null): void {
  localStorage.setItem(storageKey(baseUrl), JSON.stringify(mergeMemoryFeedback(feedback, readMemoryFeedback(baseUrl))));
}

export function clearMemoryFeedback(baseUrl?: string | null): void {
  localStorage.removeItem(storageKey(baseUrl));
}

export function retainMemoryFeedback(itemIds: Iterable<string>, baseUrl?: string | null): void {
  const known = new Set(itemIds);
  const feedback = readMemoryFeedback(baseUrl);
  if (!feedback.reflections.length && !feedback.returnFeedback.length) return;
  localStorage.setItem(storageKey(baseUrl), JSON.stringify({
    reflections: feedback.reflections.filter((entry) => known.has(entry.itemId)),
    returnFeedback: feedback.returnFeedback.filter((entry) => known.has(entry.itemId)),
  }));
}
