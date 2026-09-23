import { z } from "zod";

export const autopilotRequestSchema = z.object({
  availableMinutes: z.number().int().min(5).max(180).default(30),
  energy: z.enum(["low", "medium", "high"]).default("medium"),
  timeZone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Use a valid time zone."),
  excludedIds: z.array(z.string().max(100)).max(50).default([]),
  startFocus: z.boolean().default(true),
});

export const autopilotOptionSchema = z.object({
  id: z.string(),
  kind: z.enum(["task", "routine", "pause"]),
  title: z.string(),
  firstStep: z.string(),
  durationMinutes: z.number(),
  facts: z.array(z.string()),
});

export const autopilotResponseSchema = z.object({
  provider: z.literal("openrouter"),
  model: z.string(),
  evaluatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  confidence: z.number().min(0).max(1),
  disposition: z.enum(["decided", "review"]),
  availableMinutes: z.number(),
  focusStarted: z.boolean().default(false),
  selected: autopilotOptionSchema,
  alternatives: z.array(autopilotOptionSchema),
});

export type AutopilotRequest = z.infer<typeof autopilotRequestSchema>;
export type AutopilotOption = z.infer<typeof autopilotOptionSchema>;
export type AutopilotResponse = z.infer<typeof autopilotResponseSchema>;
