import { z } from "zod";

export const lifeAreaSchema = z.enum([
  "health",
  "work",
  "relationships",
  "environment",
  "money",
  "growth",
  "direction",
]);

export const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);
export const taskStatusSchema = z.enum(["inbox", "queued", "active", "waiting", "done", "removed"]);
export const taskPrioritySchema = z.enum(["low", "normal", "high", "must"]);
export const taskEnergySchema = z.enum(["low", "medium", "high", "any"]);
export const taskSourceSchema = z.enum(["manual", "goal", "mission", "practice", "decision", "calendar", "health", "floor"]);
export const practiceOutcomeSchema = z.enum(["helped", "mixed", "not_for_me"]);
export const blockerReasonSchema = z.enum(["big", "unclear", "time", "place", "irrelevant", "different"]);

const optionalDateTime = z.iso.datetime({ offset: true }).nullable().optional();

export const goalSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  area: lifeAreaSchema,
  vision: z.string().trim().max(5_000),
  why: z.string().trim().max(5_000),
  status: goalStatusSchema,
  progress: z.number().int().min(0).max(100),
  targetDate: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const createGoalSchema = goalSchema.pick({ title: true, area: true }).extend({
  vision: goalSchema.shape.vision.default(""),
  why: goalSchema.shape.why.default(""),
  targetDate: optionalDateTime,
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: goalStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one goal field is required.");

export const taskSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(300),
  firstStep: z.string().trim().max(1_000),
  notes: z.string().trim().max(10_000),
  area: lifeAreaSchema,
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  energy: taskEnergySchema,
  durationMinutes: z.number().int().min(2).max(720),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  scheduledStart: z.iso.datetime({ offset: true }).nullable(),
  scheduledEnd: z.iso.datetime({ offset: true }).nullable(),
  source: taskSourceSchema,
  sourceItemId: z.uuid().nullable(),
  practiceOutcome: practiceOutcomeSchema.nullable(),
  practiceReflection: z.string().trim().max(2_000),
  reflectedAt: z.iso.datetime({ offset: true }).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  repeatEveryDays: z.number().int().min(1).max(365).nullable().optional(),
  notBefore: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const createTaskSchema = taskSchema.pick({ title: true }).extend({
  goalId: z.uuid().nullable().optional(),
  firstStep: taskSchema.shape.firstStep.default(""),
  notes: taskSchema.shape.notes.default(""),
  area: lifeAreaSchema.default("direction"),
  status: taskStatusSchema.default("inbox"),
  priority: taskPrioritySchema.default("normal"),
  energy: taskEnergySchema.default("any"),
  durationMinutes: taskSchema.shape.durationMinutes.default(15),
  dueAt: optionalDateTime,
  scheduledStart: optionalDateTime,
  scheduledEnd: optionalDateTime,
  source: taskSourceSchema.default("manual"),
  sourceItemId: z.uuid().nullable().optional(),
  repeatEveryDays: z.number().int().min(1).max(365).nullable().optional(),
  notBefore: optionalDateTime,
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one task field is required.");

export const blockerEventSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  taskTitle: z.string(),
  reason: blockerReasonSchema,
  originalDuration: z.number().int().min(0),
  createdAt: z.iso.datetime({ offset: true }),
});

export const lifeFloorItemSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  area: lifeAreaSchema,
  target: z.number().int().min(1).max(100),
  unit: z.string().trim().min(1).max(80),
  completionDates: z.array(z.iso.datetime({ offset: true })),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const createLifeFloorItemSchema = lifeFloorItemSchema.pick({ title: true, area: true, target: true, unit: true });

export const calendarEventSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  source: z.enum(["manual", "apple", "google", "outlook", "task"]),
  calendarName: z.string().trim().max(200),
  title: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(10_000),
  location: z.string().trim().max(1_000),
  url: z.url().nullable(),
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
  allDay: z.boolean(),
  status: z.enum(["confirmed", "tentative", "cancelled"]),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const upsertCalendarEventSchema = calendarEventSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  externalId: z.string().max(1_000).nullable().optional(),
  source: calendarEventSchema.shape.source.default("manual"),
  calendarName: calendarEventSchema.shape.calendarName.default("Personal"),
  notes: calendarEventSchema.shape.notes.default(""),
  location: calendarEventSchema.shape.location.default(""),
  url: z.url().nullable().optional(),
  allDay: calendarEventSchema.shape.allDay.default(false),
  status: calendarEventSchema.shape.status.default("confirmed"),
}).refine((value) => Date.parse(value.endAt) >= Date.parse(value.startAt), "Calendar event must end after it starts.");

export const healthMetricTypeSchema = z.enum([
  "steps",
  "active_energy",
  "exercise_minutes",
  "sleep",
  "weight",
  "resting_heart_rate",
  "heart_rate_variability",
  "workout",
  "water",
  "mindful_minutes",
]);

export const healthMetricSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  type: healthMetricTypeSchema,
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(50),
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
  source: z.string().trim().min(1).max(200),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  createdAt: z.iso.datetime({ offset: true }),
});

export const upsertHealthMetricSchema = healthMetricSchema.omit({ id: true, createdAt: true }).extend({
  externalId: z.string().max(1_000).nullable().optional(),
  metadata: healthMetricSchema.shape.metadata.default({}),
});

export const financeAccountSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  name: z.string().trim().min(1).max(200),
  institution: z.string().trim().max(200),
  type: z.enum(["checking", "savings", "credit", "investment", "cash", "loan", "other"]),
  balance: z.number().finite(),
  currency: z.string().trim().length(3),
  source: z.enum(["manual", "csv", "provider"]),
  lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const upsertFinanceAccountSchema = financeAccountSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  externalId: z.string().max(1_000).nullable().optional(),
  institution: financeAccountSchema.shape.institution.default(""),
  currency: financeAccountSchema.shape.currency.default("USD"),
  source: financeAccountSchema.shape.source.default("manual"),
  lastSyncedAt: optionalDateTime,
});

export const financeTransactionSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid().nullable(),
  externalId: z.string().nullable(),
  name: z.string().trim().min(1).max(300),
  merchant: z.string().trim().max(300),
  amount: z.number().finite(),
  currency: z.string().trim().length(3),
  category: z.string().trim().max(100),
  occurredAt: z.iso.datetime({ offset: true }),
  status: z.enum(["pending", "posted"]),
  notes: z.string().trim().max(5_000),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const upsertFinanceTransactionSchema = financeTransactionSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  accountId: z.uuid().nullable().optional(),
  externalId: z.string().max(1_000).nullable().optional(),
  merchant: financeTransactionSchema.shape.merchant.default(""),
  currency: financeTransactionSchema.shape.currency.default("USD"),
  category: financeTransactionSchema.shape.category.default("Uncategorized"),
  status: financeTransactionSchema.shape.status.default("posted"),
  notes: financeTransactionSchema.shape.notes.default(""),
});

export const vaultFileSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().min(0),
  folder: z.string().trim().max(500),
  tags: z.array(z.string().trim().min(1).max(80)).max(50),
  summary: z.string().trim().max(5_000),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const lifeSnapshotSchema = z.object({
  goals: z.array(goalSchema),
  tasks: z.array(taskSchema),
  blockers: z.array(blockerEventSchema),
  floor: z.array(lifeFloorItemSchema),
  events: z.array(calendarEventSchema),
  health: z.array(healthMetricSchema),
  accounts: z.array(financeAccountSchema),
  transactions: z.array(financeTransactionSchema),
  files: z.array(vaultFileSchema),
});

export type LifeArea = z.infer<typeof lifeAreaSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CreateGoal = z.infer<typeof createGoalSchema>;
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type BlockerReason = z.infer<typeof blockerReasonSchema>;
export type BlockerEvent = z.infer<typeof blockerEventSchema>;
export type LifeFloorItem = z.infer<typeof lifeFloorItemSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type HealthMetric = z.infer<typeof healthMetricSchema>;
export type FinanceAccount = z.infer<typeof financeAccountSchema>;
export type FinanceTransaction = z.infer<typeof financeTransactionSchema>;
export type VaultFile = z.infer<typeof vaultFileSchema>;
export type LifeSnapshot = z.infer<typeof lifeSnapshotSchema>;
