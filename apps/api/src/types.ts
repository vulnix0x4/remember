import type { Context } from "hono";

export interface AuthenticatedUser {
  id: string;
  mode: "access" | "development" | "password" | "token";
  email?: string;
}

export interface AppVariables {
  user: AuthenticatedUser;
  requestId: string;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export interface ItemRow {
  id: string;
  user_id: string;
  source_id: string;
  original_url: string;
  canonical_url: string;
  status: string;
  personal_reaction: string | null;
  captured_timestamp_seconds: number | null;
  saved_at: string;
  processing_started_at: string | null;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  source_type: string;
  external_id: string | null;
  title: string | null;
  author: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  metadata_json: string;
  provider: string | null;
  provider_model: string | null;
  essence: string | null;
  summary: string | null;
  analysis_json: string | null;
}

export interface SourceMetadata {
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  providerMetadata: Record<string, string | number | boolean | null>;
}

export interface ProcessingInput {
  itemId: string;
  userId: string;
  sourceText?: string;
}
