import { useSyncExternalStore } from "react";
import type { BrainBlock } from "@remember/domain";
import { todayTasks } from "./planning";
import type { LifeTask } from "./types";

/** A deep-work block on one project. It lives on this device. */
export interface ProjectBlock { projectId: string; startedAt: number; minutes: number }

export const BLOCK_MINUTES = 60;
export const BLOCK_LENGTHS = [30, 60, 90];
/** A forgotten block ends by itself after this long. */
export const BLOCK_MAX_MS = 4 * 60 * 60_000;

export function blockIsLive(block: ProjectBlock | null, now = Date.now()): block is ProjectBlock {
  return Boolean(block && now - block.startedAt < BLOCK_MAX_MS);
}

/** The project's task to work on: its current one, else the next that can happen now, in Jev's order. */
export function blockTask(projectId: string, tasks: LifeTask[], plan: Map<string, BrainBlock>, now: Date): LifeTask | null {
  const active = tasks.find((task) => task.status === "active" && task.goalId === projectId);
  return active ?? todayTasks(tasks, plan, now).find((task) => task.goalId === projectId) ?? null;
}

/** Open tasks in the project that can happen now, and the ones finished since the block began. */
export function blockCounts(block: ProjectBlock, tasks: LifeTask[], plan: Map<string, BrainBlock>, now: Date) {
  const done = tasks.filter((task) => task.goalId === block.projectId && task.status === "done" && task.completedAt && Date.parse(task.completedAt) >= block.startedAt).length;
  const toGo = todayTasks(tasks, plan, now).filter((task) => task.goalId === block.projectId).length;
  return { done, toGo };
}

const KEY = "remember-project-block-v1";
const EVENT = "remember-project-block-change";

function parse(raw: string | null): ProjectBlock | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProjectBlock>;
    return typeof value.projectId === "string" && typeof value.startedAt === "number" && typeof value.minutes === "number" ? value as ProjectBlock : null;
  } catch { return null; }
}

let cached: { raw: string | null; value: ProjectBlock | null } = { raw: null, value: null };
function snapshot() {
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return cached.value; /* Private mode: keep the block for this view. */ }
  if (raw !== cached.raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

export function readBlock(): ProjectBlock | null { return snapshot(); }

export function writeBlock(block: ProjectBlock | null) {
  try {
    if (block) localStorage.setItem(KEY, JSON.stringify(block));
    else localStorage.removeItem(KEY);
  } catch { /* The block still runs for this view. */ }
  cached = { raw: block ? JSON.stringify(block) : null, value: block };
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The running block, or null. */
export function useProjectBlock() {
  const block = useSyncExternalStore(subscribe, snapshot, () => null);
  return blockIsLive(block) ? block : null;
}
