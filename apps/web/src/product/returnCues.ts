import type { Imprint, ReturnCue } from "../types";
import { createReturnEligibility, type ReturnHistory } from "./returnEligibility";

export const returnCueChoices: Array<{ value: ReturnCue; label: string; shortLabel: string }> = [
  { value: "stuck", label: "When I’m stuck", shortLabel: "Get unstuck" },
  { value: "focus", label: "Before focused work", shortLabel: "Focus" },
  { value: "decision", label: "When I’m deciding", shortLabel: "Decide" },
  { value: "date", label: "On a day I choose", shortLabel: "Choose a day" },
];

export function returnCueLabel(cue: ReturnCue): string {
  return returnCueChoices.find((choice) => choice.value === cue)?.label ?? "When I need it";
}

export function returnCueReason(cue: ReturnCue): string {
  if (cue === "stuck") return "You kept this for a moment when you felt stuck.";
  if (cue === "focus") return "You kept this for the start of focused work.";
  if (cue === "decision") return "You kept this for a decision that needed perspective.";
  return "You chose today for this idea to come back.";
}

export function returnCueQuestion(imprint: Imprint, cue: ReturnCue): string {
  const moment = cue === "stuck" ? "get unstuck" : cue === "focus" ? "focus on what matters" : cue === "decision" ? "think through a decision" : "use this today";
  return `What from “${imprint.title}” could help me ${moment} right now?`;
}

export function localDateToReturnAt(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) || returnAtToLocalDate(date.toISOString()) !== value ? undefined : date.toISOString();
}

export function scheduleReturnDay(value: string, now = new Date()): string | undefined {
  const start = localDateToReturnAt(value);
  const today = returnAtToLocalDate(now.toISOString());
  if (!start || value < today) return undefined;
  return value === today ? now.toISOString() : start;
}

export function returnAtToLocalDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function findReturnForMoment(
  imprints: Imprint[],
  cue: ReturnCue,
  now = new Date(),
  history: ReturnHistory = {},
): Imprint | null {
  const canReturn = createReturnEligibility(history, now);
  const eligible = imprints.filter((imprint) => {
    if (!canReturn(imprint)) return false;
    if (imprint.returnCue !== cue) return false;
    if (cue !== "date") return true;
    if (!imprint.returnAt) return false;
    const returnAt = new Date(imprint.returnAt);
    return !Number.isNaN(returnAt.getTime()) && returnAt <= now;
  });
  return eligible.sort((left, right) => {
    if (cue === "date") return Date.parse(left.returnAt ?? "") - Date.parse(right.returnAt ?? "");
    if (Boolean(left.personalReaction) !== Boolean(right.personalReaction)) return left.personalReaction ? -1 : 1;
    return (Date.parse(right.savedAt) || 0) - (Date.parse(left.savedAt) || 0);
  })[0] ?? null;
}
