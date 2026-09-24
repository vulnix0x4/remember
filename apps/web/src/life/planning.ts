import type { BrainBlock, BrainState } from "@remember/domain";
import { describeRepeat } from "../services/quickTask";
import type { LifeTask } from "./types";

const OPEN = new Set<LifeTask["status"]>(["active", "queued", "inbox"]);
const PRIORITY_WEIGHT: Record<LifeTask["priority"], number> = { must: 4, high: 3, normal: 2, low: 1 };

export function isOpen(task: LifeTask) { return OPEN.has(task.status); }
export function isImportant(task: Pick<LifeTask, "priority">) { return task.priority === "high" || task.priority === "must"; }

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }

/** When the task is allowed to start, if that is in the future. */
export function laterStart(task: LifeTask, now: Date): Date | null {
  if (task.status === "active") return null;
  if (task.notBefore && Date.parse(task.notBefore) > now.getTime()) return new Date(task.notBefore);
  if (task.scheduledStart && startOfDay(new Date(task.scheduledStart)) > startOfDay(now)) return new Date(task.scheduledStart);
  return null;
}

/** Jev's current plan, limited to tasks that are still open. */
export function planByTask(brain: BrainState | null | undefined, tasks: LifeTask[]): Map<string, BrainBlock> {
  if (!brain?.settings.enabled) return new Map();
  const open = new Set(tasks.filter(isOpen).map((task) => task.id));
  return new Map(brain.plan.filter((block) => open.has(block.taskId)).map((block) => [block.taskId, block]));
}

/** Open tasks that can be done now, in Jev's order (then importance, deadline, age). */
export function todayTasks(tasks: LifeTask[], plan: Map<string, BrainBlock>, now: Date): LifeTask[] {
  return tasks.filter((task) => isOpen(task) && !laterStart(task, now)).sort((a, b) => {
    const aPlan = plan.get(a.id)?.startAt ?? "9999"; const bPlan = plan.get(b.id)?.startAt ?? "9999";
    const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER; const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
    return aPlan.localeCompare(bPlan)
      || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
      || aDue - bDue
      || a.createdAt.localeCompare(b.createdAt);
  });
}

/** Open tasks that start later, soonest first. */
export function laterTasks(tasks: LifeTask[], now: Date): LifeTask[] {
  return tasks.filter((task) => isOpen(task) && laterStart(task, now))
    .sort((a, b) => laterStart(a, now)!.getTime() - laterStart(b, now)!.getTime());
}

export function doneToday(tasks: LifeTask[], now: Date): LifeTask[] {
  return tasks.filter((task) => task.status === "done" && task.completedAt && startOfDay(new Date(task.completedAt)) === startOfDay(now))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

/** The one thing to do now: the active task, else Jev's pick, else the best available task. */
export function pickNow(tasks: LifeTask[], plan: Map<string, BrainBlock>, now: Date): { task: LifeTask; block?: BrainBlock } | null {
  const active = tasks.find((task) => task.status === "active");
  const task = active ?? todayTasks(tasks, plan, now)[0];
  return task ? { task, block: plan.get(task.id) } : null;
}

/** "3 PM", "3:30 PM", or "Thu 3 PM" when it is not today. */
export function timeLabel(value: Date | string, now: Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", ...(date.getMinutes() ? { minute: "2-digit" } : {}) }).format(date);
  if (startOfDay(date) === startOfDay(now)) return time;
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 1) return `Tomorrow ${time}`;
  const day = new Intl.DateTimeFormat("en-US", days > 0 && days < 7 ? { weekday: "short" } : { month: "short", day: "numeric" }).format(date);
  return `${day} ${time}`;
}

export function durationLabel(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hr`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
  return `${minutes} min`;
}

/** When the task starts, as shown everywhere: its later start, else Jev's planned time, else its scheduled time. */
export function startLabel(task: LifeTask, now: Date, block?: BrainBlock): string | null {
  const start = laterStart(task, now) ?? block?.startAt ?? task.scheduledStart;
  return start ? timeLabel(start, now) : null;
}

/** "Due Fri 5 PM" — the one due label used by the Now card and every row. */
export function dueLabel(task: Pick<LifeTask, "dueAt">, now: Date): string | null {
  return task.dueAt ? `Due ${timeLabel(task.dueAt, now)}` : null;
}

/** One meta line: "15 min · Thu 3 PM · Weekly · Important". */
export function taskMeta(task: LifeTask, now: Date, block?: BrainBlock): string {
  const parts = [durationLabel(task.durationMinutes)];
  const start = startLabel(task, now, block);
  if (start) parts.push(start);
  const due = dueLabel(task, now);
  if (due) parts.push(due);
  if (task.repeatEveryDays) parts.push(describeRepeat(task.repeatEveryDays));
  if (isImportant(task)) parts.push(task.priority === "must" ? "Urgent" : "Important");
  return parts.join(" · ");
}

/** "2 min ago", "just now", "3 hr ago". */
export function agoLabel(value: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
