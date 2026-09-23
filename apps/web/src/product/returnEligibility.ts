import type { Imprint } from "../types";

export interface ReturnHistory {
  reflections?: Array<{ itemId: string; response: "still_true" | "changed_mind" | "not_sure" | "no_longer_relevant"; occurredAt: string }>;
  returnFeedback?: Array<{ itemId: string; response: "useful" | "not_today"; occurredAt: string }>;
  excludingItemIds?: Iterable<string>;
}

export function latestByItem<T extends { itemId: string; occurredAt: string }>(values: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const value of values) {
    const timestamp = Date.parse(value.occurredAt);
    if (!Number.isFinite(timestamp)) continue;
    const prior = latest.get(value.itemId);
    if (!prior || timestamp > Date.parse(prior.occurredAt)) latest.set(value.itemId, value);
  }
  return latest;
}

export function createReturnEligibility(history: ReturnHistory = {}, now = new Date()): (imprint: Imprint) => boolean {
  const excluded = new Set(history.excludingItemIds);
  const reflections = latestByItem(history.reflections ?? []);
  const feedback = latestByItem(history.returnFeedback ?? []);
  return (imprint) => {
    if (imprint.status !== "ready" && imprint.status !== "partial" || excluded.has(imprint.id)) return false;
    const reflection = reflections.get(imprint.id);
    if (reflection?.response === "no_longer_relevant") return false;
    if (imprint.returnCue === "date" && imprint.returnAt && reflection
      && Date.parse(reflection.occurredAt) >= Date.parse(imprint.returnAt)) return false;
    const rating = feedback.get(imprint.id);
    return !(rating?.response === "not_today" && Date.parse(rating.occurredAt) >= now.getTime() - 7 * 86_400_000);
  };
}

export function canReturnImprint(imprint: Imprint, history: ReturnHistory = {}, now = new Date()): boolean {
  return createReturnEligibility(history, now)(imprint);
}
