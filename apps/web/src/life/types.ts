import type { Commitment, RoutineStep } from "@remember/domain";

export type { Commitment, RoutineStep };
export type CommitmentKind = Commitment["kind"];
export type CommitmentImportance = Commitment["importance"];

export type LifeArea = "health" | "work" | "relationships" | "environment" | "money" | "growth" | "direction";
export type TaskStatus = "inbox" | "queued" | "active" | "waiting" | "done" | "removed";
export type TaskPriority = "low" | "normal" | "high" | "must";
export type BlockerReason = "big" | "unclear" | "time" | "place" | "irrelevant" | "different";
export type PracticeOutcome = "helped" | "mixed" | "not_for_me";
export interface PracticeResult { outcome: PracticeOutcome; reflection: string }

export interface Goal {
  id: string; title: string; area: LifeArea; vision: string; why: string;
  status: "active" | "paused" | "completed" | "archived"; progress: number;
  targetDate: string | null; createdAt: string; updatedAt: string;
}

export interface LifeTask {
  id: string; goalId: string | null; title: string; firstStep: string; notes: string; area: LifeArea;
  status: TaskStatus; priority: TaskPriority; energy: "low" | "medium" | "high" | "any";
  durationMinutes: number; dueAt: string | null; scheduledStart: string | null; scheduledEnd: string | null;
  source: "manual" | "goal" | "mission" | "practice" | "decision" | "calendar" | "health" | "floor";
  sourceItemId?: string | null; practiceOutcome?: PracticeOutcome | null;
  practiceReflection?: string; reflectedAt?: string | null;
  completedAt: string | null; createdAt: string; updatedAt: string;
  repeatEveryDays?: number | null; notBefore?: string | null;
  /** Set when the task is one day's occurrence of a commitment or chore. */
  commitmentId?: string | null; occurrenceDate?: string | null;
  /** Minutes the focus timer actually ran, recorded on completion. */
  actualMinutes?: number | null;
}

export interface BlockerEvent {
  id: string; taskId: string; taskTitle: string; reason: BlockerReason; originalDuration: number; createdAt: string;
}

export interface LifeFloorItem {
  id: string; title: string; area: LifeArea; target: number; unit: string; completionDates: string[]; createdAt: string; updatedAt: string;
}

export interface CalendarEvent {
  id: string; externalId: string | null; source: "manual" | "apple" | "google" | "outlook" | "task";
  calendarName: string; title: string; notes: string; location: string; url: string | null;
  startAt: string; endAt: string; allDay: boolean; status: "confirmed" | "tentative" | "cancelled";
  createdAt: string; updatedAt: string;
}

export interface HealthMetric {
  id: string; externalId: string | null;
  type: "steps" | "active_energy" | "exercise_minutes" | "sleep" | "weight" | "resting_heart_rate" | "heart_rate_variability" | "workout" | "water" | "mindful_minutes";
  value: number; unit: string; startAt: string; endAt: string; source: string;
  metadata: Record<string, string | number | boolean | null>; createdAt: string;
}

export interface FinanceAccount {
  id: string; externalId: string | null; name: string; institution: string;
  type: "checking" | "savings" | "credit" | "investment" | "cash" | "loan" | "other";
  balance: number; currency: string; source: "manual" | "csv" | "provider"; lastSyncedAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface FinanceTransaction {
  id: string; accountId: string | null; externalId: string | null; name: string; merchant: string;
  amount: number; currency: string; category: string; occurredAt: string; status: "pending" | "posted";
  notes: string; createdAt: string; updatedAt: string;
}

export interface VaultFile {
  id: string; name: string; mimeType: string; sizeBytes: number; folder: string; tags: string[];
  summary: string; createdAt: string; updatedAt: string;
}

export interface LifeSnapshot {
  goals: Goal[]; tasks: LifeTask[]; blockers: BlockerEvent[]; floor: LifeFloorItem[];
  events: CalendarEvent[]; health: HealthMetric[]; accounts: FinanceAccount[];
  transactions: FinanceTransaction[]; files: VaultFile[]; commitments: Commitment[];
}

export const emptyLifeSnapshot = (): LifeSnapshot => ({
  goals: [], tasks: [], blockers: [], floor: [], events: [], health: [], accounts: [], transactions: [], files: [], commitments: [],
});
