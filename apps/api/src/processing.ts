import { sourceTypeSchema, type ImprintAnalysis } from "@remember/domain";
import { z } from "zod";
import { publicProcessingError, safeErrorMessage } from "./http";
import { analysisProvider } from "./providers";
import { Repository } from "./repository";
import { sourceAdapterFor } from "./sources";
import type { ItemRow, ProcessingInput, SourceMetadata } from "./types";

const embeddingsSchema = z.object({ data: z.array(z.array(z.number())) });

function sourceFromRow(row: ItemRow) {
  return {
    originalUrl: row.original_url,
    canonicalUrl: row.canonical_url,
    sourceType: sourceTypeSchema.parse(row.source_type),
    externalId: row.external_id,
    timestampSeconds: row.captured_timestamp_seconds,
  };
}

export async function fetchAndStoreMetadata(env: Env, row: ItemRow, suppliedSourceText?: string): Promise<SourceMetadata> {
  let metadata: SourceMetadata;
  let persistedSourceText: string | undefined;
  try {
    const stored = JSON.parse(row.metadata_json) as { transcript?: unknown };
    if (typeof stored.transcript === "string" && stored.transcript.trim()) persistedSourceText = stored.transcript;
  } catch {
    persistedSourceText = undefined;
  }
  const sourceText = suppliedSourceText?.trim() || persistedSourceText;
  try {
    metadata = await sourceAdapterFor(sourceTypeSchema.parse(row.source_type), String(env.ANALYSIS_PROVIDER) === "openrouter" && !sourceText).fetchMetadata(sourceFromRow(row));
    if (sourceText) metadata = { ...metadata, transcript: sourceText, providerMetadata: { ...metadata.providerMetadata, transcriptSource: suppliedSourceText ? "client_caption_proxy" : "persisted", transcript: sourceText } };
  } catch (error) {
    metadata = {
      title: row.title,
      author: row.author,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: row.duration_seconds,
      transcript: null,
      providerMetadata: { metadataSource: "unavailable", error: safeErrorMessage(error) },
    };
  }
  await new Repository(env.DB).updateSourceMetadata(row.source_id, metadata);
  return metadata;
}

export async function analyzeRow(env: Env, row: ItemRow, metadata: SourceMetadata): Promise<ImprintAnalysis> {
  return analysisProvider(env).analyze({
    canonicalUrl: row.canonical_url,
    sourceType: sourceTypeSchema.parse(row.source_type),
    title: metadata.title ?? row.title,
    author: metadata.author ?? row.author,
    personalReaction: row.personal_reaction,
    sourceText: metadata.transcript,
  });
}

export async function indexAnalysis(env: Env, row: ItemRow, analysis: ImprintAnalysis): Promise<boolean> {
  if (String(env.ANALYSIS_PROVIDER) === "mock") return false;
  try {
    const result = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [
        [row.title, analysis.essence, analysis.summary, analysis.themes.join(", ")].filter(Boolean).join("\n").slice(0, 12_000),
      ],
    });
    const vectors = embeddingsSchema.parse(result).data;
    const vector = vectors[0];
    if (!vector) return false;
    await env.VECTOR_INDEX.upsert([
      {
        id: row.id,
        namespace: row.user_id,
        values: vector,
        metadata: { userId: row.user_id, itemId: row.id, sourceType: row.source_type },
      },
    ]);
    return true;
  } catch (error) {
    console.error(JSON.stringify({ message: "vector indexing unavailable", itemId: row.id, error: safeErrorMessage(error) }));
    return false;
  }
}

export async function runIngestion(env: Env, input: ProcessingInput): Promise<void> {
  const repository = new Repository(env.DB);
  try {
    await repository.markProcessing(input.itemId);
    const original = await repository.itemForProcessing(input.userId, input.itemId);
    const metadata = await fetchAndStoreMetadata(env, original, input.sourceText);
    const row = await repository.itemForProcessing(input.userId, input.itemId);
    const provider = analysisProvider(env);
    const analysis = await analyzeRow(env, row, metadata);
    await repository.persistAnalysis(row, analysis, provider);
    await Promise.all([indexAnalysis(env, row, analysis), repository.createConnections(row, analysis)]);
  } catch (error) {
    console.error(JSON.stringify({ message: "inline ingestion failed", itemId: input.itemId, error: safeErrorMessage(error) }));
    await repository.markFailed(input.itemId, publicProcessingError(error));
    throw error;
  }
}
