import { ApiError } from "./http";

const reflectionKinds = "('still_true', 'changed_mind', 'not_sure', 'no_longer_relevant')";

function signalHistoryQuery(type: "reflection" | "returnFeedback") {
  const response = type === "reflection" ? "kind" : "value_text";
  const condition = type === "reflection" ? `ps.kind IN ${reflectionKinds}` : "ps.kind = 'resurfacing_rating'";
  // Keep every item's current decision, with a bounded amount of history for threads.
  // Insertion order resolves feedback recorded within the same millisecond.
  return `WITH history AS (
    SELECT ps.id, ps.item_id AS itemId, ps.${response} AS response, ps.occurred_at AS occurredAt,
           ps.rowid AS sequence,
           ROW_NUMBER() OVER (PARTITION BY ps.item_id ORDER BY ps.occurred_at DESC, ps.rowid DESC) AS itemRank
    FROM personal_signals ps JOIN items i ON i.id = ps.item_id
    WHERE ps.user_id = ?1 AND i.user_id = ?1 AND i.status IN ('ready', 'partial') AND ${condition}
  )
  SELECT id, itemId, response, occurredAt FROM history
  WHERE itemRank = 1 OR id IN (
    SELECT id FROM history WHERE itemRank > 1 ORDER BY occurredAt DESC, sequence DESC LIMIT 50
  )
  ORDER BY occurredAt DESC, sequence DESC`;
}

// Both newly selected and already scheduled returns must respect the current feedback.
const automaticReturnEligibility = `i.user_id = ?1 AND i.status IN ('ready', 'partial')
  AND julianday(i.saved_at) <= julianday('now', '-7 days')
  AND COALESCE((
    SELECT ps.kind FROM personal_signals ps
    WHERE ps.item_id = i.id AND ps.user_id = ?1 AND ps.kind IN ${reflectionKinds}
    ORDER BY ps.occurred_at DESC, ps.rowid DESC LIMIT 1
  ), '') <> 'no_longer_relevant'
  AND COALESCE((
    SELECT ps.value_text = 'not_today' AND julianday(ps.occurred_at) >= julianday('now', '-7 days')
    FROM personal_signals ps
    WHERE ps.item_id = i.id AND ps.user_id = ?1 AND ps.kind = 'resurfacing_rating'
    ORDER BY ps.occurred_at DESC, ps.rowid DESC LIMIT 1
  ), 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM personal_signals ps
    WHERE i.return_cue = 'date' AND ps.item_id = i.id AND ps.user_id = ?1
      AND ps.kind IN ${reflectionKinds} AND julianday(ps.occurred_at) >= julianday(i.return_at)
  )
  AND COALESCE((
    SELECT t.practice_outcome FROM life_tasks t
    WHERE t.user_id = ?1 AND t.source_item_id = i.id AND t.source = 'practice'
      AND t.practice_outcome IS NOT NULL
    ORDER BY COALESCE(t.reflected_at, t.updated_at) DESC, t.rowid DESC LIMIT 1
  ), '') <> 'not_for_me'`;

export class EvolutionService {
  constructor(private readonly db: D1Database) {}

  async overview(userId: string) {
    const [themes, principles, tensions, timeline, reflections, returnFeedback, recentQuestion] = await Promise.all([
      this.db
        .prepare(
          `SELECT t.display_name AS name, COUNT(*) AS count, MAX(i.saved_at) AS lastSeenAt
           FROM item_topics it JOIN topics t ON t.id = it.topic_id JOIN items i ON i.id = it.item_id
           WHERE i.user_id = ?1 AND i.status = 'ready' GROUP BY t.id ORDER BY count DESC, lastSeenAt DESC LIMIT 30`,
        )
        .bind(userId)
        .all(),
      this.db
        .prepare(
          `SELECT cp.id, cp.item_id AS itemId, cp.text, cp.rationale, cp.status, cp.created_at AS createdAt
           FROM candidate_principles cp JOIN items i ON i.id = cp.item_id
           WHERE cp.user_id = ?1 AND i.status = 'ready' ORDER BY cp.created_at DESC LIMIT 50`,
        )
        .bind(userId)
        .all(),
      this.db
        .prepare(
          `SELECT c.id, c.from_item_id AS fromItemId, c.to_item_id AS toItemId, c.explanation, c.confidence
           FROM connections c JOIN items source ON source.id = c.from_item_id JOIN items target ON target.id = c.to_item_id
           WHERE c.user_id = ?1 AND c.type = 'contradicts' AND source.status = 'ready' AND target.status = 'ready'
           ORDER BY c.confidence DESC LIMIT 30`,
        )
        .bind(userId)
        .all(),
      this.db
        .prepare(
          `SELECT substr(i.saved_at, 1, 7) AS month, t.display_name AS theme, COUNT(*) AS count
           FROM items i JOIN item_topics it ON it.item_id = i.id JOIN topics t ON t.id = it.topic_id
           WHERE i.user_id = ?1 AND i.status = 'ready' GROUP BY month, t.id ORDER BY month DESC, count DESC LIMIT 120`,
        )
        .bind(userId)
        .all(),
      this.db
        .prepare(signalHistoryQuery("reflection"))
        .bind(userId)
        .all(),
      this.db
        .prepare(signalHistoryQuery("returnFeedback"))
        .bind(userId)
        .all(),
      this.db
        .prepare(
          `SELECT m.content AS question, m.created_at AS askedAt
           FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
           WHERE t.user_id = ?1 AND m.role = 'user'
           ORDER BY m.created_at DESC LIMIT 1`,
        )
        .bind(userId)
        .first<{ question: string; askedAt: string }>(),
    ]);
    return {
      themes: themes.results,
      principles: principles.results,
      tensions: tensions.results,
      timeline: timeline.results,
      reflections: reflections.results,
      returnFeedback: returnFeedback.results,
      recentQuestion: recentQuestion ?? null,
    };
  }

  async rateContextualReturn(userId: string, itemId: string, response: string) {
    if (!["useful", "not_today"].includes(response)) {
      throw new ApiError(422, "invalid_response", "Choose a supported contextual return response.");
    }
    const item = await this.db
      .prepare("SELECT id FROM items WHERE id = ?1 AND user_id = ?2 AND status IN ('ready', 'partial')")
      .bind(itemId, userId)
      .first<{ id: string }>();
    if (!item) throw new ApiError(404, "item_not_found", "Saved item not found.");

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO personal_signals (id, user_id, item_id, kind, value_text, occurred_at, created_at)
         VALUES (?1, ?2, ?3, 'resurfacing_rating', ?4, ?5, ?5)`,
      )
      .bind(id, userId, itemId, response, now)
      .run();
    return { id, itemId, response, occurredAt: now };
  }

  async resurfaced(userId: string) {
    const existing = await this.db
      .prepare(
        `SELECT r.id AS eventId, r.reason, r.surfaced_at AS surfacedAt, i.id AS itemId,
                s.title, i.canonical_url AS canonicalUrl, a.essence, a.analysis_json AS analysisJson
         FROM resurfacing_events r JOIN items i ON i.id = r.item_id JOIN sources s ON s.id = i.source_id
         LEFT JOIN analyses a ON a.item_id = i.id
         WHERE r.user_id = ?1 AND julianday(r.surfaced_at) >= julianday('now', '-1 day')
           AND r.response IS NULL
           AND ${automaticReturnEligibility}
         ORDER BY r.surfaced_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first();
    if (existing) return existing;
    return this.createResurfacing(userId);
  }

  async createResurfacing(userId: string) {
    const candidate = await this.db
      .prepare(
        `SELECT i.id AS itemId, s.title, i.canonical_url AS canonicalUrl, a.essence, a.analysis_json AS analysisJson
         FROM items i JOIN sources s ON s.id = i.source_id LEFT JOIN analyses a ON a.item_id = i.id
         WHERE ${automaticReturnEligibility}
           AND NOT EXISTS (
             SELECT 1 FROM resurfacing_events r
             WHERE r.item_id = i.id AND r.user_id = ?1 AND julianday(r.surfaced_at) >= julianday('now', '-30 days')
           )
         ORDER BY CASE WHEN i.personal_reaction IS NOT NULL THEN 0 ELSE 1 END, i.saved_at ASC LIMIT 1`,
      )
      .bind(userId)
      .first<Record<string, unknown>>();
    if (!candidate) return null;
    const eventId = crypto.randomUUID();
    const surfacedAt = new Date().toISOString();
    const reason = "Saved at least a week ago and not resurfaced in the last 30 days.";
    await this.db
      .prepare("INSERT INTO resurfacing_events (id, user_id, item_id, reason, surfaced_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(eventId, userId, candidate.itemId, reason, surfacedAt)
      .run();
    return { ...candidate, eventId, reason, surfacedAt };
  }

  async respond(userId: string, eventId: string, response: string): Promise<void> {
    if (!["still_true", "changed_mind", "not_sure", "no_longer_relevant"].includes(response)) {
      throw new ApiError(422, "invalid_response", "Choose a supported reflection response.");
    }
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(
        `UPDATE resurfacing_events SET response = ?3, responded_at = ?4
         WHERE id = ?1 AND user_id = ?2
           AND item_id IN (SELECT id FROM items WHERE user_id = ?2 AND status IN ('ready', 'partial'))
         RETURNING item_id`,
      )
      .bind(eventId, userId, response, now)
      .first<{ item_id: string }>();
    if (!result) throw new ApiError(404, "resurfacing_not_found", "Resurfaced memory not found.");
    await this.db
      .prepare(
        `INSERT INTO personal_signals (id, user_id, item_id, kind, value_text, occurred_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?5)`,
      )
      .bind(crypto.randomUUID(), userId, result.item_id, response, now)
      .run();
  }

  async reflect(userId: string, itemId: string, response: string) {
    if (!["still_true", "changed_mind", "not_sure", "no_longer_relevant"].includes(response)) {
      throw new ApiError(422, "invalid_response", "Choose a supported reflection response.");
    }
    const item = await this.db
      .prepare("SELECT id FROM items WHERE id = ?1 AND user_id = ?2 AND status IN ('ready', 'partial')")
      .bind(itemId, userId)
      .first<{ id: string }>();
    if (!item) throw new ApiError(404, "item_not_found", "Saved item not found.");

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO personal_signals (id, user_id, item_id, kind, value_text, occurred_at, created_at)
           VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?5)`,
        )
        .bind(id, userId, itemId, response, now),
      this.db
        .prepare(
          `UPDATE resurfacing_events SET response = ?3, responded_at = ?4
           WHERE id = (
             SELECT id FROM resurfacing_events
             WHERE user_id = ?1 AND item_id = ?2 AND response IS NULL
             ORDER BY surfaced_at DESC LIMIT 1
           )`,
        )
        .bind(userId, itemId, response, now),
    ]);
    return { id, itemId, response, occurredAt: now };
  }
}
