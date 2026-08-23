import { ApiError } from "./http";

export class EvolutionService {
  constructor(private readonly db: D1Database) {}

  async overview(userId: string) {
    const [themes, principles, tensions, timeline] = await Promise.all([
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
    ]);
    return { themes: themes.results, principles: principles.results, tensions: tensions.results, timeline: timeline.results };
  }

  async resurfaced(userId: string) {
    const existing = await this.db
      .prepare(
        `SELECT r.id AS eventId, r.reason, r.surfaced_at AS surfacedAt, i.id AS itemId,
                s.title, i.canonical_url AS canonicalUrl, a.essence, a.analysis_json AS analysisJson
         FROM resurfacing_events r JOIN items i ON i.id = r.item_id JOIN sources s ON s.id = i.source_id
         LEFT JOIN analyses a ON a.item_id = i.id
         WHERE r.user_id = ?1 AND r.surfaced_at >= datetime('now', '-1 day')
           AND i.saved_at <= datetime('now', '-7 days')
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
         WHERE i.user_id = ?1 AND i.status = 'ready'
           AND i.saved_at <= datetime('now', '-7 days')
           AND NOT EXISTS (
             SELECT 1 FROM resurfacing_events r WHERE r.item_id = i.id AND r.surfaced_at >= datetime('now', '-30 days')
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
         WHERE id = ?1 AND user_id = ?2 RETURNING item_id`,
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
}
