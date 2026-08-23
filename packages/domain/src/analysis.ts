import { z } from "zod";

const conciseText = z.string().trim().min(1).max(2_000);

export const keyIdeaSchema = z.object({
  text: conciseText,
  explanation: z.string().trim().max(4_000).default(""),
});

export const keyMomentSchema = z.object({
  seconds: z.number().int().min(0),
  label: conciseText,
  context: z.string().trim().max(4_000).default(""),
  sourceVerified: z.boolean().default(false),
});

export const claimSchema = z.object({
  text: conciseText,
  confidence: z.number().min(0).max(1),
});

export const candidatePrincipleSchema = z.object({
  text: conciseText,
  rationale: z.string().trim().max(4_000).default(""),
});

export const actionableExperimentSchema = z.object({
  text: conciseText,
  duration: z.string().trim().max(120).optional(),
});

export const personalRelevanceHypothesisSchema = z.object({
  text: conciseText,
  evidence: z.array(conciseText).max(8).default([]),
  confidence: z.number().min(0).max(1),
  label: z.literal("hypothesis").default("hypothesis"),
});

export const uncertaintySchema = z.object({
  text: conciseText,
  field: z.string().trim().max(120).optional(),
});

export const analysisSchema = z.object({
  essence: conciseText,
  summary: z.string().trim().min(1).max(12_000),
  keyIdeas: z.array(keyIdeaSchema).max(20),
  keyMoments: z.array(keyMomentSchema).max(30),
  themes: z.array(conciseText).max(20),
  claims: z.array(claimSchema).max(30),
  candidatePrinciples: z.array(candidatePrincipleSchema).max(15),
  actionableExperiments: z.array(actionableExperimentSchema).max(15),
  personalRelevanceHypotheses: z.array(personalRelevanceHypothesisSchema).max(12),
  uncertainties: z.array(uncertaintySchema).max(20),
});

export type ImprintAnalysis = z.infer<typeof analysisSchema>;

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "essence",
    "summary",
    "keyIdeas",
    "keyMoments",
    "themes",
    "claims",
    "candidatePrinciples",
    "actionableExperiments",
    "personalRelevanceHypotheses",
    "uncertainties",
  ],
  properties: {
    essence: { type: "string" },
    summary: { type: "string" },
    keyIdeas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "explanation"],
        properties: { text: { type: "string" }, explanation: { type: "string" } },
      },
    },
    keyMoments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["seconds", "label", "context", "sourceVerified"],
        properties: {
          seconds: { type: "integer", minimum: 0 },
          label: { type: "string" },
          context: { type: "string" },
          sourceVerified: { type: "boolean" },
        },
      },
    },
    themes: { type: "array", items: { type: "string" } },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "confidence"],
        properties: { text: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } },
      },
    },
    candidatePrinciples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "rationale"],
        properties: { text: { type: "string" }, rationale: { type: "string" } },
      },
    },
    actionableExperiments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" }, duration: { type: "string" } },
      },
    },
    personalRelevanceHypotheses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidence", "confidence", "label"],
        properties: {
          text: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          label: { type: "string", enum: ["hypothesis"] },
        },
      },
    },
    uncertainties: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" }, field: { type: "string" } },
      },
    },
  },
} as const;
