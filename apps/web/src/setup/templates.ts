import type { Commitment, CommitmentImportance, CommitmentKind, RoutineStep } from "../life/types";
import { durationLabel } from "../life/planning";

/** Weekday bits: Sunday = 1, Monday = 2 … Saturday = 64. */
export const DAY_BITS = [1, 2, 4, 8, 16, 32, 64] as const;
export const EVERY_DAY = 127;
export const WEEKDAYS = 2 | 4 | 8 | 16 | 32;
export const WEEKENDS = 1 | 64;
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CommitmentTemplate {
  title: string; kind: CommitmentKind; days: number; everyDays: number | null;
  durationMinutes: number; importance: CommitmentImportance; steps: RoutineStep[];
}

export const LAUNDRY_STEPS: RoutineStep[] = [
  { title: "Gather dirty clothes" },
  { title: "Start the washer" },
  { title: "Washer running", waitMinutes: 45 },
  { title: "Move clothes to the dryer" },
  { title: "Dryer running", waitMinutes: 50 },
  { title: "Fold everything" },
  { title: "Put it all away" },
];

export const commitmentTemplates: CommitmentTemplate[] = [
  { title: "College study", kind: "commitment", days: EVERY_DAY, everyDays: null, durationMinutes: 120, importance: "must", steps: [] },
  { title: "Coursework", kind: "commitment", days: WEEKDAYS, everyDays: null, durationMinutes: 60, importance: "must", steps: [] },
  { title: "Gym", kind: "commitment", days: 2 | 8 | 32, everyDays: null, durationMinutes: 60, importance: "high", steps: [] },
  { title: "Walk", kind: "commitment", days: EVERY_DAY, everyDays: null, durationMinutes: 20, importance: "normal", steps: [] },
];

export const choreTemplates: CommitmentTemplate[] = [
  { title: "Laundry", kind: "chore", days: EVERY_DAY, everyDays: 7, durationMinutes: 30, importance: "normal", steps: LAUNDRY_STEPS },
  { title: "Dishes", kind: "chore", days: EVERY_DAY, everyDays: 1, durationMinutes: 15, importance: "normal", steps: [] },
  { title: "Take out trash", kind: "chore", days: EVERY_DAY, everyDays: 7, durationMinutes: 5, importance: "normal", steps: [] },
  { title: "Groceries", kind: "chore", days: EVERY_DAY, everyDays: 7, durationMinutes: 45, importance: "normal", steps: [] },
  { title: "Clean bathroom", kind: "chore", days: EVERY_DAY, everyDays: 7, durationMinutes: 30, importance: "normal", steps: [] },
  { title: "Change sheets", kind: "chore", days: EVERY_DAY, everyDays: 14, durationMinutes: 15, importance: "normal", steps: [] },
];

/** "Every day", "Weekdays", "Weekends", or "Mon, Wed, Fri". */
export function daysLabel(days: number) {
  if (days === EVERY_DAY) return "Every day";
  if (days === WEEKDAYS) return "Weekdays";
  if (days === WEEKENDS) return "Weekends";
  const picked = DAY_BITS.map((bit, index) => days & bit ? DAY_SHORT[index] : null).filter(Boolean);
  return picked.length ? picked.join(", ") : "No days";
}

export const rhythmChoices: Array<{ label: string; value: number }> = [
  { label: "Every day", value: 1 },
  { label: "Every few days", value: 3 },
  { label: "Weekly", value: 7 },
  { label: "Every 2 weeks", value: 14 },
  { label: "Monthly", value: 30 },
];

/** "daily", "weekly", "every 2 weeks"… as used after the chore's name. */
export function rhythmLabel(everyDays: number | null) {
  if (!everyDays || everyDays === 1) return "daily";
  if (everyDays === 3) return "every few days";
  if (everyDays === 7) return "weekly";
  if (everyDays === 14) return "every 2 weeks";
  if (everyDays === 30) return "monthly";
  return `every ${everyDays} days`;
}

export const importanceLabels: Record<CommitmentImportance, string> = { must: "Must do", high: "Important", normal: "Nice to do" };

/** The one meta line under a commitment or chore row. */
export function commitmentMeta(commitment: Pick<Commitment, "kind" | "days" | "everyDays" | "durationMinutes" | "fixedStart" | "steps">) {
  if (commitment.kind === "chore") {
    const parts = [rhythmLabel(commitment.everyDays), durationLabel(commitment.durationMinutes)];
    if (commitment.days !== EVERY_DAY) parts.push(daysLabel(commitment.days));
    if (commitment.steps.length) parts.push(`${commitment.steps.length} steps`);
    return parts.join(" · ").replace(/^./, (letter) => letter.toUpperCase());
  }
  const parts = [daysLabel(commitment.days), durationLabel(commitment.durationMinutes)];
  if (commitment.fixedStart) parts.push(fixedStartLabel(commitment.fixedStart));
  return parts.join(" · ");
}

export function fixedStartLabel(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date(2026, 0, 1, hour, minute);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", ...(minute ? { minute: "2-digit" } : {}) }).format(date);
}
