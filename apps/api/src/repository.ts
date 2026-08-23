import {
  analysisSchema,
  connectionTypeSchema,
  itemStatusSchema,
  sourceTypeSchema,
  type CanonicalSourceUrl,
  type ConnectionType,
  type ImprintAnalysis,
} from "@remember/domain";
import { ApiError } from "./http";
import type { ItemRow, SourceMetadata } from "./types";

export const ITEM_SELECT = `
  SELECT i.*, s.type AS source_type, s.external_id, s.title, s.author, s.thumbnail_url,
         s.duration_seconds, s.metadata_json, a.provider, a.provider_model,
         a.essence, a.summary, a.analysis_json
  FROM items i
  JOIN sources s ON s.id = i.source_id
  LEFT JOIN analyses a ON a.item_id = i.id`;

function nowIso(): string {
  return new Date().toISOString();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseAnalysis(value: string | null): ImprintAnalysis | null {
  if (!value) return null;
  const parsed = analysisSchema.safeParse(JSON.parse(value) as unknown);
  return parsed.success ? parsed.data : null;
}

export function publicItem(row: ItemRow) {
  return {
    id: row.id,
    sourceType: sourceTypeSchema.parse(row.source_type),
    originalUrl: row.original_url,
    canonicalUrl: row.canonical_url,
    externalId: row.external_id,
    title: row.title,
    author: row.author,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    status: itemStatusSchema.parse(row.status),
    savedAt: row.saved_at,
    personalReaction: row.personal_reaction,
    capturedTimestampSeconds: row.captured_timestamp_seconds,
    processingError: row.processing_error,
    analysis: parseAnalysis(row.analysis_json),
    provenance: row.provider
      ? { provider: row.provider, model: row.provider_model, contractVersion: 1, generated: true }
      : null,
  };
}

export class Repository {
  constructor(private readonly db: D1Database) {}

  async capture(
    userId: string,
    source: CanonicalSourceUrl,
    personalReaction: string | null,
    savedAt: string,
    idempotencyKey: string | null,
  ): Promise<{ row: ItemRow; created: boolean }> {
    const requestHash = await sha256(JSON.stringify({ url: source.canonicalUrl, personalReaction }));
    if (idempotencyKey) {
      const prior = await this.db
        .prepare(
          `SELECT k.request_hash, ${ITEM_SELECT.replace(/^\s*SELECT\s+/i, "")}
           JOIN idempotency_keys k ON k.item_id = i.id
           WHERE k.user_id = ?1 AND k.key = ?2`,
        )
        .bind(userId, idempotencyKey)
        .first<ItemRow & { request_hash: string }>();
      if (prior) {
        if (prior.request_hash !== requestHash) {
          throw new ApiError(409, "idempotency_conflict", "This idempotency key was already used for another request.");
        }
        return { row: prior, created: false };
      }
    }

    const existing = await this.db
      .prepare(`${ITEM_SELECT} WHERE i.user_id = ?1 AND i.canonical_url = ?2`)
      .bind(userId, source.canonicalUrl)
      .first<ItemRow>();
    if (existing) return { row: existing, created: false };

    const sourceId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const now = nowIso();
    const statements = [
      this.db
        .prepare(
          `INSERT INTO sources (id, type, canonical_url, external_id, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?5)
           ON CONFLICT(canonical_url) DO UPDATE SET updated_at = excluded.updated_at`,
        )
        .bind(sourceId, source.sourceType, source.canonicalUrl, source.externalId, now),
      this.db
        .prepare(
          `INSERT INTO items (
             id, user_id, source_id, original_url, canonical_url, status, personal_reaction,
             captured_timestamp_seconds, saved_at, created_at, updated_at
           )
           SELECT ?1, ?2, id, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?8
           FROM sources WHERE canonical_url = ?4`,
        )
        .bind(
          itemId,
          userId,
          source.originalUrl,
          source.canonicalUrl,
          personalReaction,
          source.timestampSeconds,
          savedAt,
          now,
        ),
      this.db
        .prepare(
          `INSERT INTO ingestion_jobs (item_id, status, created_at, updated_at)
           VALUES (?1, 'pending', ?2, ?2)`,
        )
        .bind(itemId, now),
    ];
    if (idempotencyKey) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO idempotency_keys (user_id, key, request_hash, item_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)`,
          )
          .bind(userId, idempotencyKey, requestHash, itemId, now),
      );
    }
    try {
      await this.db.batch(statements);
    } catch (error) {
      const raced = await this.db
        .prepare(`${ITEM_SELECT} WHERE i.user_id = ?1 AND i.canonical_url = ?2`)
        .bind(userId, source.canonicalUrl)
        .first<ItemRow>();
      if (raced) return { row: raced, created: false };
      throw error;
    }
    return { row: await this.requireItem(userId, itemId), created: true };
  }

  async recordWorkflow(itemId: string, instanceId: string): Promise<void> {
    await this.db
      .prepare("UPDATE ingestion_jobs SET workflow_instance_id = ?2, updated_at = ?3 WHERE item_id = ?1")
      .bind(itemId, instanceId, nowIso())
      .run();
  }

  async queueRetry(userId: string, itemId: string): Promise<ItemRow> {
    const item = await this.requireItem(userId, itemId);
    if (item.status !== "failed" && item.status !== "partial") {
      throw new ApiError(409, "retry_not_allowed", "Only failed or partial Imprints can be retried.");
    }
    const now = nowIso();
    await this.db.batch([
      this.db
        .prepare("UPDATE items SET status = 'pending', processing_error = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(itemId, now),
      this.db
        .prepare("UPDATE ingestion_jobs SET status = 'pending', last_error = NULL, updated_at = ?2 WHERE item_id = ?1")
        .bind(itemId, now),
    ]);
    return this.requireItem(userId, itemId);
  }

  async listItems(userId: string, limit: number, cursor: string | null, status: string | null): Promise<ItemRow[]> {
    const clauses = ["i.user_id = ?1"];
    const values: Array<string | number> = [userId];
    if (cursor) {
      values.push(cursor);
      clauses.push(`i.saved_at < ?${values.length}`);
    }
    if (status) {
      values.push(status);
      clauses.push(`i.status = ?${values.length}`);
    }
    values.push(limit);
    const result = await this.db
      .prepare(`${ITEM_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY i.saved_at DESC, i.id DESC LIMIT ?${values.length}`)
      .bind(...values)
      .all<ItemRow>();
    return result.results;
  }

  async requireItem(userId: string, itemId: string): Promise<ItemRow> {
    const row = await this.db
      .prepare(`${ITEM_SELECT} WHERE i.user_id = ?1 AND i.id = ?2`)
      .bind(userId, itemId)
      .first<ItemRow>();
    if (!row) throw new ApiError(404, "item_not_found", "Imprint not found.");
    return row;
  }

  async itemForProcessing(userId: string, itemId: string): Promise<ItemRow> {
    return this.requireItem(userId, itemId);
  }

  async markProcessing(itemId: string): Promise<void> {
    const now = nowIso();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE items SET status = 'processing', processing_started_at = ?2,
           processing_error = NULL, updated_at = ?2 WHERE id = ?1`,
        )
        .bind(itemId, now),
      this.db
        .prepare(
          `UPDATE ingestion_jobs SET status = 'running', attempts = attempts + 1,
           last_error = NULL, updated_at = ?2 WHERE item_id = ?1`,
        )
        .bind(itemId, now),
    ]);
  }

  async updateSourceMetadata(sourceId: string, metadata: SourceMetadata): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sources SET title = COALESCE(?2, title), author = COALESCE(?3, author),
         thumbnail_url = COALESCE(?4, thumbnail_url), duration_seconds = COALESCE(?5, duration_seconds),
         metadata_json = ?6, updated_at = ?7 WHERE id = ?1`,
      )
      .bind(
        sourceId,
        metadata.title,
        metadata.author,
        metadata.thumbnailUrl,
        metadata.durationSeconds,
        JSON.stringify(metadata.providerMetadata),
        nowIso(),
      )
      .run();
  }

  async persistAnalysis(
    row: ItemRow,
    analysis: ImprintAnalysis,
    provider: { name: string; model: string },
  ): Promise<void> {
    const now = nowIso();
    const analysisId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      this.db.prepare("DELETE FROM moments WHERE item_id = ?1").bind(row.id),
      this.db.prepare("DELETE FROM item_topics WHERE item_id = ?1").bind(row.id),
      this.db.prepare("DELETE FROM candidate_principles WHERE item_id = ?1").bind(row.id),
      this.db.prepare("DELETE FROM item_search WHERE item_id = ?1").bind(row.id),
      this.db
        .prepare(
          `INSERT INTO analyses (id, item_id, provider, provider_model, contract_version, essence, summary, analysis_json, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?8)
           ON CONFLICT(item_id) DO UPDATE SET provider = excluded.provider, provider_model = excluded.provider_model,
             contract_version = excluded.contract_version, essence = excluded.essence, summary = excluded.summary,
             analysis_json = excluded.analysis_json, updated_at = excluded.updated_at`,
        )
        .bind(analysisId, row.id, provider.name, provider.model, analysis.essence, analysis.summary, JSON.stringify(analysis), now),
    ];

    for (const moment of analysis.keyMoments) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO moments (id, item_id, seconds, label, context, source_verified, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(crypto.randomUUID(), row.id, moment.seconds, moment.label, moment.context, moment.sourceVerified ? 1 : 0, now),
      );
    }
    for (const theme of [...new Set(analysis.themes.map((value) => value.trim()).filter(Boolean))]) {
      const normalized = theme.toLocaleLowerCase("en-US");
      const topicId = `topic_${(await sha256(normalized)).slice(0, 32)}`;
      statements.push(
        this.db
          .prepare("INSERT INTO topics (id, normalized_name, display_name, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(normalized_name) DO NOTHING")
          .bind(topicId, normalized, theme, now),
        this.db
          .prepare(
            `INSERT INTO item_topics (item_id, topic_id, confidence)
             SELECT ?1, id, 1 FROM topics WHERE normalized_name = ?2
             ON CONFLICT(item_id, topic_id) DO UPDATE SET confidence = excluded.confidence`,
          )
          .bind(row.id, normalized),
      );
    }
    for (const principle of analysis.candidatePrinciples) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO candidate_principles (id, user_id, item_id, text, rationale, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
          )
          .bind(crypto.randomUUID(), row.user_id, row.id, principle.text, principle.rationale, now),
      );
    }
    statements.push(
      this.db
        .prepare(
          "INSERT INTO item_search (item_id, user_id, title, essence, summary, themes, personal_context) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(
          row.id,
          row.user_id,
          row.title ?? "",
          analysis.essence,
          analysis.summary,
          analysis.themes.join(" "),
          [
            row.personal_reaction,
            ...analysis.keyIdeas.flatMap((idea) => [idea.text, idea.explanation]),
            ...analysis.keyMoments.flatMap((moment) => [moment.label, moment.context]),
            ...analysis.claims.map((claim) => claim.text),
            ...analysis.candidatePrinciples.flatMap((principle) => [principle.text, principle.rationale]),
            ...analysis.actionableExperiments.map((experiment) => experiment.text),
            ...analysis.personalRelevanceHypotheses.flatMap((hypothesis) => [hypothesis.text, ...hypothesis.evidence]),
            ...analysis.uncertainties.map((uncertainty) => uncertainty.text),
          ]
            .filter(Boolean)
            .join(" "),
        ),
      this.db
        .prepare(
          `UPDATE items SET status = 'ready', processed_at = ?2, processing_error = NULL,
           updated_at = ?2 WHERE id = ?1`,
        )
        .bind(row.id, now),
      this.db
        .prepare("UPDATE ingestion_jobs SET status = 'complete', last_error = NULL, updated_at = ?2 WHERE item_id = ?1")
        .bind(row.id, now),
    );
    await this.db.batch(statements);
  }

  async markFailed(itemId: string, errorMessage: string): Promise<void> {
    const now = nowIso();
    const safe = errorMessage.slice(0, 500);
    await this.db.batch([
      this.db
        .prepare("UPDATE items SET status = 'failed', processing_error = ?2, updated_at = ?3 WHERE id = ?1")
        .bind(itemId, safe, now),
      this.db
        .prepare("UPDATE ingestion_jobs SET status = 'failed', last_error = ?2, updated_at = ?3 WHERE item_id = ?1")
        .bind(itemId, safe, now),
    ]);
  }

  async createConnections(row: ItemRow, analysis: ImprintAnalysis): Promise<number> {
    const candidates = await this.db
      .prepare(
        `SELECT i.id, a.analysis_json FROM items i JOIN analyses a ON a.item_id = i.id
         WHERE i.user_id = ?1 AND i.id <> ?2 AND i.status = 'ready'
         ORDER BY i.saved_at DESC LIMIT 100`,
      )
      .bind(row.user_id, row.id)
      .all<{ id: string; analysis_json: string }>();
    const currentThemes = new Set(analysis.themes.map((theme) => theme.toLocaleLowerCase("en-US")));
    const statements: D1PreparedStatement[] = [];
    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "into", "your", "their", "about", "have", "will"]);
    const claimShape = (text: string) => {
      const normalized = text.toLocaleLowerCase("en-US");
      const tokens = new Set((normalized.match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((token) => !stopWords.has(token) && token !== "not"));
      return { tokens, negative: /\b(?:not|never|cannot|isn't|doesn't|won't)\b/i.test(text) };
    };
    const similarity = (left: Set<string>, right: Set<string>) => {
      if (!left.size || !right.size) return 0;
      const shared = [...left].filter((token) => right.has(token)).length;
      return shared / Math.min(left.size, right.size);
    };
    for (const candidate of candidates.results) {
      const other = parseAnalysis(candidate.analysis_json);
      if (!other) continue;
      const shared = other.themes.filter((theme) => currentThemes.has(theme.toLocaleLowerCase("en-US")));
      if (shared.length) {
        statements.push(
          this.connectionStatement(
            row,
            candidate.id,
            "same_theme",
            `Both Imprints return to ${shared.slice(0, 3).join(", ")}.`,
            Math.min(0.95, 0.55 + shared.length * 0.1),
          ),
        );
      }
      let strongest: { type: "supports" | "contradicts"; explanation: string; confidence: number } | null = null;
      for (const currentClaim of analysis.claims) {
        const current = claimShape(currentClaim.text);
        for (const otherClaim of other.claims) {
          const prior = claimShape(otherClaim.text);
          const score = similarity(current.tokens, prior.tokens);
          if (score < 0.6) continue;
          const type = current.negative === prior.negative ? "supports" : "contradicts";
          const confidence = Math.min(currentClaim.confidence, otherClaim.confidence, score);
          if (!strongest || confidence > strongest.confidence) {
            strongest = {
              type,
              confidence,
              explanation:
                type === "supports"
                  ? "These Imprints make closely aligned claims."
                  : "These Imprints make similar claims with opposing polarity; review the sources to resolve the tension.",
            };
          }
        }
      }
      if (strongest) statements.push(this.connectionStatement(row, candidate.id, strongest.type, strongest.explanation, strongest.confidence));
    }
    if (statements.length) await this.db.batch(statements);
    return statements.length;
  }

  private connectionStatement(
    row: ItemRow,
    toItemId: string,
    type: "same_theme" | "supports" | "contradicts",
    explanation: string,
    confidence: number,
  ): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO connections (id, user_id, from_item_id, to_item_id, type, explanation, confidence, provenance, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'heuristic', ?8)
         ON CONFLICT(user_id, from_item_id, to_item_id, type) DO UPDATE SET
           explanation = excluded.explanation, confidence = excluded.confidence`,
      )
      .bind(crypto.randomUUID(), row.user_id, row.id, toItemId, type, explanation, confidence, nowIso());
  }

  async listConnections(userId: string, itemId?: string): Promise<Record<string, unknown>[]> {
    const condition = itemId ? "AND (c.from_item_id = ?2 OR c.to_item_id = ?2)" : "";
    const statement = this.db.prepare(
      `SELECT c.id, c.from_item_id AS fromItemId, c.to_item_id AS toItemId, c.type,
              c.explanation, c.confidence, c.provenance, c.created_at AS createdAt
       FROM connections c WHERE c.user_id = ?1 ${condition}
       ORDER BY c.confidence DESC, c.created_at DESC LIMIT 200`,
    );
    const result = itemId ? await statement.bind(userId, itemId).all() : await statement.bind(userId).all();
    return result.results;
  }

  async addConnection(
    userId: string,
    fromItemId: string,
    toItemId: string,
    type: ConnectionType,
    explanation: string,
  ): Promise<void> {
    connectionTypeSchema.parse(type);
    await Promise.all([this.requireItem(userId, fromItemId), this.requireItem(userId, toItemId)]);
    if (fromItemId === toItemId) throw new ApiError(422, "self_connection", "An Imprint cannot connect to itself.");
    await this.db
      .prepare(
        `INSERT INTO connections (id, user_id, from_item_id, to_item_id, type, explanation, confidence, provenance, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 'manual', ?7)
         ON CONFLICT(user_id, from_item_id, to_item_id, type) DO UPDATE SET explanation = excluded.explanation, confidence = 1`,
      )
      .bind(crypto.randomUUID(), userId, fromItemId, toItemId, type, explanation, nowIso())
      .run();
  }

  async rateLimit(actorId: string, action: string, limit: number, windowSeconds: number): Promise<void> {
    const now = Math.floor(Date.now() / 1_000);
    const windowStart = now - (now % windowSeconds);
    const result = await this.db
      .prepare(
        `INSERT INTO rate_limits (actor_id, action, window_start, request_count, expires_at)
         VALUES (?1, ?2, ?3, 1, ?4)
         ON CONFLICT(actor_id, action, window_start) DO UPDATE SET request_count = request_count + 1
         RETURNING request_count`,
      )
      .bind(actorId, action, windowStart, windowStart + windowSeconds * 2)
      .first<{ request_count: number }>();
    if ((result?.request_count ?? limit + 1) > limit) throw new ApiError(429, "rate_limited", "Too many requests. Try again shortly.");
  }
}
