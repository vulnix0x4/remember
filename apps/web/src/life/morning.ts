import { useSyncExternalStore } from "react";
import type { Commitment, LifeTask } from "./types";

/**
 * Morning flow: a short warm-up of quick tasks, then ten minutes on the big one, then free choice.
 * Easy wins get the engine going; the cap keeps small tasks from eating the whole day.
 */
export const WARMUP_COUNT = 3;
export const WARMUP_MINUTES = 20;
export const BIG_MINUTES = 10;
/** Quick tasks are this long or shorter. */
export const SMALL_MAX_MINUTES = 15;
/** Big tasks are at least this long. */
export const BIG_MIN_MINUTES = 30;

export type MorningStage = "warmup" | "big" | "done";

export interface MorningSession {
  /** Local calendar day, "YYYY-MM-DD". A session only counts on its own day. */
  day: string;
  /** Null when the person chose "Not today". */
  startedAt: number | null;
  bigTaskId: string | null;
  stage: MorningStage;
}

const PRIORITY_WEIGHT: Record<LifeTask["priority"], number> = { must: 4, high: 3, normal: 2, low: 1 };

export function dayKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Morning is from two hours before your day starts until four hours after. */
export function isMorning(now: Date, startHour = 8) {
  const hour = now.getHours();
  const from = (startHour - 2 + 24) % 24;
  return (hour - from + 24) % 24 < 6;
}

/**
 * Picks the warm-up and the big one from tasks that can be done now, kept in Jev's order.
 * Guided routines (laundry) are left out; they run alongside everything else.
 */
export function morningCandidates(available: LifeTask[], commitments: Commitment[]) {
  const routines = new Set(commitments.filter((item) => item.steps.length > 0).map((item) => item.id));
  const open = available.filter((task) => (task.status === "queued" || task.status === "inbox") && !(task.commitmentId && routines.has(task.commitmentId)));
  const big = open.filter((task) => task.durationMinutes >= BIG_MIN_MINUTES)
    .reduce<LifeTask | null>((best, task) => !best || PRIORITY_WEIGHT[task.priority] > PRIORITY_WEIGHT[best.priority] ? task : best, null);
  const small = open.filter((task) => task.id !== big?.id && task.durationMinutes <= SMALL_MAX_MINUTES);
  return { small, big };
}

export function shouldOfferMorning(session: MorningSession | null, candidates: ReturnType<typeof morningCandidates>, now: Date, startHour?: number, hasActive = false) {
  if (hasActive || session?.day === dayKey(now) || !isMorning(now, startHour)) return false;
  return Boolean(candidates.big) || candidates.small.length >= 2;
}

export function startMorning(candidates: ReturnType<typeof morningCandidates>, now: Date): MorningSession {
  return {
    day: dayKey(now),
    startedAt: now.getTime(),
    bigTaskId: candidates.big?.id ?? null,
    stage: candidates.small.length ? "warmup" : candidates.big ? "big" : "done",
  };
}

export function skipMorning(now: Date): MorningSession {
  return { day: dayKey(now), startedAt: null, bigTaskId: null, stage: "done" };
}

/** Warm-up tasks finished since the morning started (the big one doesn't count). */
export function warmupDone(session: MorningSession, tasks: LifeTask[]) {
  const since = session.startedAt ?? Number.MAX_SAFE_INTEGER;
  return tasks.filter((task) => task.status === "done" && task.id !== session.bigTaskId && task.completedAt && Date.parse(task.completedAt) >= since).length;
}

/**
 * Where the morning is now. The warm-up ends after three quick wins or twenty minutes, whichever
 * comes first, but never interrupts a task in progress: the switch shows on the next pick.
 */
export function morningStage(session: MorningSession | null, tasks: LifeTask[], small: LifeTask[], now: Date): MorningStage | null {
  if (!session || session.day !== dayKey(now) || session.startedAt === null) return null;
  const bigOpen = () => {
    const big = tasks.find((task) => task.id === session.bigTaskId);
    return Boolean(big && (big.status === "queued" || big.status === "inbox" || big.status === "active") && !(big.notBefore && Date.parse(big.notBefore) > now.getTime()));
  };
  let stage = session.stage;
  if (stage === "warmup") {
    const over = warmupDone(session, tasks) >= WARMUP_COUNT
      || now.getTime() - session.startedAt >= WARMUP_MINUTES * 60_000
      || small.length === 0;
    if (over) stage = "big";
  }
  if (stage === "big" && !bigOpen()) stage = "done";
  return stage;
}

/** What the Now card offers during the morning, or null to let Jev choose as usual. */
export function morningPick(session: MorningSession | null, tasks: LifeTask[], small: LifeTask[], now: Date): { task: LifeTask; label: string; stage: "warmup" | "big" } | null {
  const stage = morningStage(session, tasks, small, now);
  if (!session || stage === "done" || stage === null) return null;
  if (stage === "warmup") {
    const done = warmupDone(session, tasks);
    return small[0] ? { task: small[0], label: `Warm-up · ${Math.min(done + 1, WARMUP_COUNT)} of ${WARMUP_COUNT}`, stage } : null;
  }
  const big = tasks.find((task) => task.id === session.bigTaskId);
  return big ? { task: big, label: "The big one", stage } : null;
}

/** True while this task is the big one and should get a ten-minute start instead of its full length. */
export function isBigStart(session: MorningSession | null, taskId: string, now: Date) {
  return Boolean(session && session.day === dayKey(now) && session.startedAt !== null && session.stage !== "done" && session.bigTaskId === taskId);
}

/* ---------- Stored on this device, one session per day ---------- */

const KEY = "remember-morning-v1";
const EVENT = "remember-morning-change";

function parse(raw: string | null): MorningSession | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as MorningSession; } catch { return null; }
}

export function readMorning(): MorningSession | null {
  try { return parse(localStorage.getItem(KEY)); } catch { return null; }
}

let cached: { raw: string | null; value: MorningSession | null } = { raw: null, value: null };
function snapshot() {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* Private mode: no session. */ }
  if (raw !== cached.raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

export function writeMorning(session: MorningSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch { /* The flow still works for this view. */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Ends the morning flow for today, for example after the big one is done or stopped. */
export function endMorning() {
  const session = readMorning();
  if (session && session.stage !== "done") writeMorning({ ...session, stage: "done" });
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

export function useMorningSession() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
