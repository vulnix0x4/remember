import { z } from "zod";

export const brainSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  timeZone: z.string().max(100).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }),
  startHour: z.number().int().min(0).max(23).default(8),
  endHour: z.number().int().min(1).max(24).default(21),
  preferences: z.string().trim().max(2000).default(""),
// An end hour at or before the start hour means the day runs past midnight (for example 12 PM to 3 AM).
}).refine((value) => value.endHour !== value.startHour, "Your day can't start and end at the same hour.");
export const brainBlockSchema = z.object({
  taskId: z.string(), title: z.string(), firstStep: z.string(),
  startAt: z.iso.datetime(), endAt: z.iso.datetime(),
  confidence: z.number().min(0).max(1), reason: z.string(),
});
export const brainStateSchema = z.object({
  settings: brainSettingsSchema,
  status: z.enum(["paused", "waiting", "planning", "ready", "unavailable"]),
  message: z.string(),
  model: z.string().nullable(),
  evaluatedAt: z.iso.datetime().nullable(),
  nextCheckAt: z.iso.datetime().nullable(),
  plan: z.array(brainBlockSchema),
  contextUsed: z.array(z.string()),
  unscheduledCount: z.number().int().min(0),
});
export type BrainSettings = z.infer<typeof brainSettingsSchema>;
export type BrainBlock = z.infer<typeof brainBlockSchema>;
export type BrainState = z.infer<typeof brainStateSchema>;
