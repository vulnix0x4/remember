import { z } from "zod";
import { analysisSchema } from "./analysis";

export const itemStatusSchema = z.enum(["pending", "processing", "ready", "partial", "failed"]);
export const sourceTypeSchema = z.enum(["youtube", "web", "note"]);
export const connectionTypeSchema = z.enum([
  "related_to",
  "supports",
  "contradicts",
  "extends",
  "same_theme",
  "changed_into",
]);

export const returnCueSchema = z.enum(["stuck", "focus", "decision", "date"]);

const returnCueFields = {
  returnCue: returnCueSchema.optional(),
  returnAt: z.iso.datetime({ offset: true }).optional(),
};

function validateReturnCue(
  value: {
    returnCue?: z.infer<typeof returnCueSchema> | null | undefined;
    returnAt?: string | null | undefined;
  },
  context: z.RefinementCtx,
) {
  if (value.returnCue === "date" && !value.returnAt) {
    context.addIssue({ code: "custom", path: ["returnAt"], message: "Choose when Remember should bring this back." });
  }
  if (value.returnCue !== "date" && value.returnAt) {
    context.addIssue({ code: "custom", path: ["returnAt"], message: "A return date only applies to a dated cue." });
  }
}

function validateCaptureSubject(
  value: { url?: string | undefined; thought?: string | undefined },
  context: z.RefinementCtx,
) {
  if (!value.url && !value.thought) {
    context.addIssue({ code: "custom", path: ["url"], message: "Add a link or write a thought to remember." });
  }
  if (value.url && value.thought) {
    context.addIssue({ code: "custom", path: ["thought"], message: "Save either a link or a thought at one time." });
  }
}

export const captureRequestSchema = z.object({
  url: z.string().trim().min(1).max(2_048).optional(),
  thought: z.string().trim().min(1).max(20_000).optional(),
  personalReaction: z.string().trim().max(5_000).optional(),
  sourceText: z.string().trim().min(1).max(160_000).optional(),
  savedAt: z.iso.datetime({ offset: true }).optional(),
  ...returnCueFields,
}).superRefine(validateReturnCue).superRefine(validateCaptureSubject);

export const returnCueUpdateSchema = z.object({
  returnCue: returnCueSchema.nullable(),
  returnAt: z.iso.datetime({ offset: true }).nullable().default(null),
}).superRefine(validateReturnCue);

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const askRequestSchema = z.object({
  question: z.string().trim().min(2).max(1_000),
  threadId: z.uuid().optional(),
});

export const decisionRequestSchema = z.object({
  decision: z.string().trim().min(3).max(500),
  context: z.string().trim().max(1_000).optional(),
});

export const citationSchema = z.object({
  itemId: z.uuid(),
  title: z.string(),
  url: z.url(),
  timestampSeconds: z.number().int().min(0).optional(),
  excerpt: z.string(),
});

export const askAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  grounded: z.boolean(),
  limitations: z.array(z.string()),
});

export const decisionBriefSchema = z.object({
  decision: z.string(),
  perspective: z.string(),
  whatMatters: z.string(),
  pullToward: z.string(),
  pullAgainst: z.string(),
  smallTest: z.string(),
  nextQuestion: z.string(),
  citations: z.array(citationSchema),
  grounded: z.boolean(),
  limitations: z.array(z.string()),
});

export const imprintSchema = z.object({
  id: z.uuid(),
  sourceType: sourceTypeSchema,
  originalUrl: z.url(),
  canonicalUrl: z.url(),
  externalId: z.string().nullable(),
  title: z.string().nullable(),
  author: z.string().nullable(),
  thumbnailUrl: z.url().nullable(),
  durationSeconds: z.number().int().min(0).nullable(),
  status: itemStatusSchema,
  savedAt: z.iso.datetime(),
  personalReaction: z.string().nullable(),
  noteText: z.string().nullable(),
  returnCue: returnCueSchema.nullable(),
  returnAt: z.iso.datetime().nullable(),
  capturedTimestampSeconds: z.number().int().min(0).nullable(),
  processingError: z.string().nullable(),
  analysisScope: z.enum(["pending", "transcript", "caption", "post", "article", "thought"]),
  analysis: analysisSchema.nullable(),
  provenance: z
    .object({
      provider: z.string(),
      model: z.string().nullable(),
      contractVersion: z.number().int().positive(),
      generated: z.literal(true),
    })
    .nullable(),
});

export const captureResponseSchema = z.object({
  item: imprintSchema,
  deduplicated: z.boolean(),
  duplicate: z.boolean(),
});

export const itemListResponseSchema = z.object({
  items: z.array(imprintSchema),
  nextCursor: z.string().nullable(),
});

export const searchResponseSchema = z.object({
  items: z.array(imprintSchema),
  query: z.string(),
});

export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ConnectionType = z.infer<typeof connectionTypeSchema>;
export type ReturnCue = z.infer<typeof returnCueSchema>;
export type CaptureRequest = z.infer<typeof captureRequestSchema>;
export type AskAnswer = z.infer<typeof askAnswerSchema>;
export type DecisionBrief = z.infer<typeof decisionBriefSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Imprint = z.infer<typeof imprintSchema>;
export type CaptureResponse = z.infer<typeof captureResponseSchema>;
export type ItemListResponse = z.infer<typeof itemListResponseSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
