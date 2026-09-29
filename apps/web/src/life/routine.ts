import type { RoutineStep } from "./types";

/**
 * Where someone is in a guided routine (laundry and friends). Stored per task in localStorage so a
 * reload, or coming back after the washer finishes, lands on the same step with the same wait.
 */
export interface RoutineProgress {
  /** Index of the current step. */
  step: number;
  /** When the current step's hands-off wait ends (ms since epoch), if it has one. */
  waitEndsAt: number | null;
  /** True once the "wait is over" nudge was sent, so it's never repeated. */
  notified?: boolean;
}

export function routineStorageKey(taskId: string) { return `remember-routine-v1:${taskId}`; }

export function readRoutine(taskId: string): RoutineProgress | null {
  try {
    const stored = JSON.parse(localStorage.getItem(routineStorageKey(taskId)) ?? "null") as Partial<RoutineProgress> | null;
    if (!stored || typeof stored.step !== "number" || stored.step < 0) return null;
    return { step: Math.floor(stored.step), waitEndsAt: typeof stored.waitEndsAt === "number" ? stored.waitEndsAt : null, notified: Boolean(stored.notified) };
  } catch { return null; }
}

export const ROUTINE_EVENT = "remember-routine";

export function writeRoutine(taskId: string, progress: RoutineProgress | null) {
  try {
    if (progress) localStorage.setItem(routineStorageKey(taskId), JSON.stringify(progress));
    else localStorage.removeItem(routineStorageKey(taskId));
  } catch { /* Progress still works for this view. */ }
  window.dispatchEvent(new CustomEvent(ROUTINE_EVENT, { detail: taskId }));
}

/** Arriving on a step. A wait only starts when the person taps "Start 45-min timer". */
export function enterStep(steps: RoutineStep[], index: number): RoutineProgress {
  const step = Math.max(0, Math.min(index, steps.length - 1));
  return { step, waitEndsAt: null, notified: false };
}

/** Starts the current step's hands-off wait. The routine then runs in the background. */
export function startWait(progress: RoutineProgress, steps: RoutineStep[], now = Date.now()): RoutineProgress {
  const wait = steps[progress.step]?.waitMinutes ?? 0;
  return { ...progress, waitEndsAt: now + Math.max(1, wait) * 60_000, notified: false };
}

/** Moves to the next step. Returns `finished` after the last step. Also used for "It's done already". */
export function advanceRoutine(progress: RoutineProgress, steps: RoutineStep[]): { progress: RoutineProgress; finished: boolean } {
  if (progress.step >= steps.length - 1) return { progress, finished: true };
  return { progress: enterStep(steps, progress.step + 1), finished: false };
}

export function waitRemainingMs(progress: RoutineProgress, now = Date.now()) {
  return progress.waitEndsAt === null ? 0 : Math.max(0, progress.waitEndsAt - now);
}

export function isWaiting(progress: RoutineProgress, now = Date.now()) {
  return waitRemainingMs(progress, now) > 0;
}

/** "Washer running" → "Washer". Used to say what finished. */
function waitSubject(title: string) {
  return title.replace(/\s+(?:is\s+)?(?:running|going|on|spinning|in progress|working|drying|washing|cooking|baking|soaking)$/i, "").trim();
}

/** "Washer’s done" (or "Time’s up") for the step whose wait just ended. */
export function waitDoneTitle(steps: RoutineStep[], index: number) {
  const current = steps[index];
  const subject = current ? waitSubject(current.title) : "";
  return subject && subject.toLowerCase() !== current?.title.toLowerCase() ? `${subject}’s done` : "Time’s up";
}

/** "Washer’s done. Next: Move clothes to the dryer." — the line (and nudge) when a wait ends. */
export function waitDoneMessage(steps: RoutineStep[], index: number) {
  const next = steps[index + 1];
  const done = `${waitDoneTitle(steps, index)}.`;
  return next ? `${done} Next: ${next.title.replace(/[.!]$/, "")}.` : done;
}

/** "32 min left", at minute resolution, for the Today strip. */
export function waitMinutesLeftLabel(ms: number) {
  return `${Math.max(1, Math.ceil(ms / 60_000))} min left`;
}

/** "38 min left", or "45 sec left" for the last minute. */
export function waitLeftLabel(ms: number) {
  if (ms >= 60_000) return `${Math.ceil(ms / 60_000)} min left`;
  return `${Math.max(1, Math.ceil(ms / 1_000))} sec left`;
}
