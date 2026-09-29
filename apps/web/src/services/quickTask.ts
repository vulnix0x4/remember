import type { TaskPriority } from "../life/types";

/** What one typed line of text means as a task. Dates are local-time `Date`s. */
export interface QuickTask {
  title: string;
  durationMinutes?: number;
  notBefore?: Date;
  dueAt?: Date;
  repeatEveryDays?: number;
  /** Where the repeat came from: typed in the text, the usual rhythm for a known chore, or learned from past completions. */
  repeatSource?: "typed" | "usual" | "learned";
  priority?: Extract<TaskPriority, "high" | "must">;
}

/** A previously seen task, used to learn how often (and how long) the person actually does something. */
export interface TaskHistoryEntry { title: string; completedAt?: string | null; actualMinutes?: number | null; status?: string }

/** How often common chores usually repeat, in days. First match wins. Mirrors docs/REDESIGN.md. */
const USUAL_RHYTHMS: Array<[RegExp, number]> = [
  [/\b(?:dishes|make\s+(?:the\s+|my\s+)?bed|meds|medication|pills|vitamins|walk\s+(?:the\s+)?dog|feed\s+(?:the\s+)?(?:dog|cat|pets?)|floss|journal|skincare)\b/i, 1],
  [/\bwater\s+(?:the\s+)?plants\b/i, 3],
  [/\b(?:sheets|bedding|change\s+(?:the\s+)?bed)\b/i, 14],
  [/\b(?:laundry|vacuum|mop|groceries|grocery|trash|garbage|recycling|bins|dust|meal\s+prep|clean\s+(?:the\s+)?(?:bathroom|kitchen|room|house|apartment)|mow\s+(?:the\s+)?lawn|weekly\s+review|plan\s+(?:the\s+|my\s+)?week|call\s+(?:mom|dad|grandma|grandpa|parents))\b/i, 7],
  [/\b(?:rent|bills?|credit\s+card|mortgage|haircut|budget|wash\s+(?:the\s+)?car|car\s+wash|clean\s+(?:the\s+)?fridge|back\s*up)\b/i, 30],
  [/\b(?:air\s+filter|hvac\s+filter|furnace\s+filter|toothbrush|oil\s+change|change\s+(?:the\s+)?oil)\b/i, 90],
  [/\b(?:dentist|teeth\s+cleaning)\b/i, 180],
  [/\b(?:checkup|check-up|eye\s+exam|registration)\b/i, 365],
];
const RHYTHM_STEPS = [1, 2, 3, 7, 14, 30, 90, 180, 365];

export function usualRepeatDays(title: string): number | undefined {
  return USUAL_RHYTHMS.find(([pattern]) => pattern.test(title))?.[1];
}

/** The person's own rhythm for a task title, from when they completed it before. */
export function learnedRepeatDays(title: string, history: TaskHistoryEntry[], now: Date = new Date()): number | undefined {
  const key = title.trim().toLowerCase();
  const completions = history
    .filter((entry) => entry.completedAt && entry.title.trim().toLowerCase() === key)
    .map((entry) => Date.parse(entry.completedAt!))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  if (!completions.length) return undefined;
  const gapDays = ((completions.length > 1 ? completions[0] : now.getTime()) - (completions.length > 1 ? completions[1] : completions[0])) / 86_400_000;
  if (gapDays < 0.5) return undefined;
  return RHYTHM_STEPS.reduce((best, step) => Math.abs(step - gapDays) < Math.abs(best - gapDays) ? step : best);
}

/** Typical minutes for common tasks. Whole words, first match wins. Mirrors docs/REDESIGN.md. */
// Longest first, so "run errands" is an errand (45), not a run (30). Mirrors the iOS table.
const KNOWN_DURATIONS: Array<[RegExp, number]> = [
  [/\b(?:gym|workout|work\s+out|study|homework|meal\s+prep|project|write|writing)\b/i, 60],
  [/\b(?:groceries|grocery|errands?)\b/i, 45],
  [/\b(?:cook|dinner)\b/i, 40],
  [/\b(?:laundry|run|clean|read|meeting)\b/i, 30],
  [/\b(?:walk|vacuum)\b/i, 20],
  [/\b(?:dishes|shower|tidy|water\s+(?:the\s+)?plants)\b/i, 15],
  [/\b(?:email|call|pay|bills?|rent|book)\b/i, 10],
  [/\b(?:text|trash|meds)\b/i, 5],
];
export const DEFAULT_ESTIMATE_MINUTES = 15;

export interface DurationEstimate { minutes: number; source: "history" | "known" | "default" }

/**
 * How long a task will probably take: the median of the last three real times for the same title,
 * else the usual time for a known kind of task, else 15 minutes.
 */
export function estimateDuration(title: string, history: TaskHistoryEntry[] = []): DurationEstimate {
  const key = title.trim().toLowerCase();
  const recent = history
    .filter((entry) => entry.completedAt && entry.title.trim().toLowerCase() === key && typeof entry.actualMinutes === "number" && entry.actualMinutes > 0)
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))
    .slice(0, 3)
    .map((entry) => entry.actualMinutes!)
    .sort((a, b) => a - b);
  if (recent.length) {
    const middle = Math.floor(recent.length / 2);
    const median = recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2;
    return { minutes: Math.min(720, Math.max(2, Math.round(median))), source: "history" };
  }
  const known = KNOWN_DURATIONS.find(([pattern]) => pattern.test(title))?.[1];
  return known ? { minutes: known, source: "known" } : { minutes: DEFAULT_ESTIMATE_MINUTES, source: "default" };
}

export function estimateMinutes(title: string, history: TaskHistoryEntry[] = []): number {
  return estimateDuration(title, history).minutes;
}

export const QUICK_TASK_DEFAULTS = { durationMinutes: 15, area: "direction", status: "queued", priority: "normal" } as const;

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};
const DAY_PATTERN = "monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun";
const WHEN_WORD = `today|tonight|tomorrow|tmrw|tmr|this\\s+weekend|weekend|next\\s+week|(?:next\\s+)?(?:${DAY_PATTERN})`;

function at(day: Date, hour: number, offsetDays = 0): Date {
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsetDays, hour, 0, 0, 0);
  return date;
}

function nextWeekday(now: Date, weekday: number): Date {
  const ahead = ((weekday - now.getDay() + 7) % 7) || 7;
  return at(now, 9, ahead);
}

function weekendStart(now: Date): Date {
  if (now.getDay() === 6 && now.getHours() < 9) return at(now, 9);
  return nextWeekday(now, 6);
}

/** Resolves a recognized "when" word to its 09:00 start day (or null for "today"/"tonight" handled separately). */
function whenDay(word: string, now: Date): Date | null {
  const value = word.toLowerCase().replace(/\s+/g, " ").trim();
  if (value === "today" || value === "tonight") return at(now, 9);
  if (value === "tomorrow" || value === "tmrw" || value === "tmr") return at(now, 9, 1);
  if (value === "this weekend" || value === "weekend") return weekendStart(now);
  if (value === "next week") return nextWeekday(now, 1);
  const day = value.replace(/^next /, "");
  return day in DAY_NAMES ? nextWeekday(now, DAY_NAMES[day]) : null;
}

/**
 * Turns one line such as "call mom tomorrow 20m" into a task. Pure and
 * case-insensitive; every recognized token is removed from the title.
 */
export function parseQuickTask(text: string, now: Date = new Date(), history: TaskHistoryEntry[] = []): QuickTask {
  const original = text.trim();
  let rest = ` ${original} `;
  const result: Omit<QuickTask, "title"> = {};
  const take = (pattern: RegExp, onMatch: (match: RegExpExecArray) => void) => {
    const match = pattern.exec(rest);
    if (!match) return false;
    onMatch(match);
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
    return true;
  };

  // "once" turns automatic repeat off.
  const once = take(/\b(?:just\s+once|one\s+time|once)\b/i, () => undefined);

  // Repeat (before durations and days so "every 3 days" is not read as anything else).
  take(/\bevery\s+(\d+)\s+days?\b/i, (match) => { result.repeatEveryDays = Math.min(365, Math.max(1, Number(match[1]))); })
    || take(/\bevery\s+other\s+day\b/i, () => { result.repeatEveryDays = 2; })
    || take(/\b(?:every\s+day|everyday|daily)\b/i, () => { result.repeatEveryDays = 1; })
    || take(/\b(?:every\s+week|weekly)\b/i, () => { result.repeatEveryDays = 7; })
    || take(/\b(?:every\s+month|monthly)\b/i, () => { result.repeatEveryDays = 30; });

  // Duration.
  const setDuration = (minutes: number) => { result.durationMinutes = Math.min(720, Math.max(2, Math.round(minutes))); };
  take(/\bhalf\s+(?:an\s+)?hour\b/i, () => setDuration(30))
    || take(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i, (match) => setDuration(Number(match[1]) * 60))
    || take(/\b(\d+)\s*(?:m|min|mins|minute|minutes)\b/i, (match) => setDuration(Number(match[1])))
    || take(/\ban\s+hour\b/i, () => setDuration(60));

  // Deadline: "by friday" → due at 17:00 that day.
  take(new RegExp(`\\bby\\s+(${WHEN_WORD})\\b`, "i"), (match) => {
    const day = whenDay(match[1], now);
    if (day) result.dueAt = at(day, 17);
  });

  // Start day.
  take(/\btonight\b/i, () => {
    const evening = at(now, 18);
    if (evening.getTime() > now.getTime()) result.notBefore = evening;
  })
    || take(/\b(?:tomorrow|tmrw|tmr)\b/i, () => { result.notBefore = at(now, 9, 1); })
    || take(/\b(?:this\s+weekend|weekend)\b/i, () => { result.notBefore = weekendStart(now); })
    || take(/\bnext\s+week\b/i, () => { result.notBefore = nextWeekday(now, 1); })
    || take(new RegExp(`\\b(?:on\\s+|next\\s+)?(${DAY_PATTERN})\\b`, "i"), (match) => { result.notBefore = nextWeekday(now, DAY_NAMES[match[1].toLowerCase()]); });
  take(/\btoday\b/i, () => undefined);

  // Priority.
  take(/!!+|\burgent\b/i, () => { result.priority = "must"; })
    || take(/(?:^|\s)!(?=\s|$)|\basap\b|\bimportant\b/i, () => { result.priority = "high"; });

  let title = rest.replace(/\s+/g, " ").trim();
  let previous = "";
  while (previous !== title) {
    previous = title;
    title = title.replace(/(?:\s+(?:on|by|at)|\s*[,-])$/i, "").trim();
  }
  if (!title) return { title: original };
  title = title[0].toUpperCase() + title.slice(1);
  if (result.repeatEveryDays) result.repeatSource = "typed";
  else if (!once) {
    const learned = learnedRepeatDays(title, history, now);
    const usual = learned ? undefined : usualRepeatDays(title);
    if (learned) { result.repeatEveryDays = learned; result.repeatSource = "learned"; }
    else if (usual) { result.repeatEveryDays = usual; result.repeatSource = "usual"; }
  }
  return { title, ...result };
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

/** Short human label for a parsed day, e.g. "Tonight", "Tomorrow", "Sat". */
export function describeDay(date: Date, now: Date = new Date()): string {
  if (sameDay(date, now)) return date.getHours() >= 18 ? "Tonight" : "Today";
  if (sameDay(date, at(now, 0, 1))) return "Tomorrow";
  const days = Math.round((at(date, 0).getTime() - at(now, 0).getTime()) / 86_400_000);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  return days < 7 ? weekday : `${weekday} ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`;
}

export function describeRepeat(days: number): string {
  if (days === 1) return "Daily";
  if (days === 7) return "Weekly";
  if (days === 30) return "Monthly";
  if (days === 2) return "Every other day";
  if (days === 14) return "Every 2 weeks";
  if (days === 90) return "Every 3 months";
  if (days === 180) return "Every 6 months";
  if (days === 365) return "Yearly";
  return `Every ${days} days`;
}

export type QuickChipKind = "duration" | "when" | "due" | "repeat" | "priority";

function minutesLabel(minutes: number) {
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hr` : `${minutes} min`;
}

/**
 * Read-only preview chips for what was understood. Empty when nothing was recognized.
 * Pass `history` to also show an estimated length (`~30 min`) when none was typed.
 */
export function quickTaskChips(parsed: QuickTask, now: Date = new Date(), history?: TaskHistoryEntry[]): Array<{ kind: QuickChipKind; label: string }> {
  const chips: Array<{ kind: QuickChipKind; label: string }> = [];
  if (parsed.durationMinutes) chips.push({ kind: "duration", label: minutesLabel(parsed.durationMinutes) });
  else if (history) {
    const estimate = estimateDuration(parsed.title, history);
    if (estimate.source !== "default") chips.push({ kind: "duration", label: `~${minutesLabel(estimate.minutes)}` });
  }
  if (parsed.notBefore) chips.push({ kind: "when", label: describeDay(parsed.notBefore, now) });
  if (parsed.dueAt) chips.push({ kind: "due", label: `Due ${describeDay(parsed.dueAt, now).replace("Tonight", "today").replace("Today", "today")}` });
  if (parsed.repeatEveryDays) {
    const source = parsed.repeatSource === "usual" ? " · usual" : parsed.repeatSource === "learned" ? " · your rhythm" : "";
    chips.push({ kind: "repeat", label: `${describeRepeat(parsed.repeatEveryDays)}${source}` });
  }
  if (parsed.priority) chips.push({ kind: "priority", label: parsed.priority === "must" ? "Urgent" : "Important" });
  return chips;
}

export type WhenKey = "anytime" | "tonight" | "tomorrow" | "weekend" | "nextWeek";

/** The start choices offered in the task sheet. "Tonight" is left out once 18:00 has passed. */
export function whenOptions(now: Date = new Date()): Array<{ key: WhenKey; label: string; date: Date | null }> {
  const tonight = at(now, 18);
  return [
    { key: "anytime" as const, label: "Anytime", date: null },
    ...(tonight.getTime() > now.getTime() ? [{ key: "tonight" as const, label: "Tonight", date: tonight }] : []),
    { key: "tomorrow" as const, label: "Tomorrow", date: at(now, 9, 1) },
    { key: "weekend" as const, label: "This weekend", date: weekendStart(now) },
    { key: "nextWeek" as const, label: "Next week", date: nextWeekday(now, 1) },
  ];
}
