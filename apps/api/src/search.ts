import { askAnswerSchema, searchRequestSchema, youtubeTimestampUrl, type Citation } from "@remember/domain";
import { z } from "zod";
import { ApiError } from "./http";
import { ITEM_SELECT, publicItem, Repository } from "./repository";
import type { ItemRow } from "./types";

const embeddingsSchema = z.object({ data: z.array(z.array(z.number())) });

function ftsExpression(query: string): string {
  const tokens = query.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]{2,}/gu)?.slice(0, 12) ?? [];
  if (!tokens.length) throw new ApiError(422, "query_too_broad", "Use at least one word or number in your search.");
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(" OR ");
}

export class SearchService {
  constructor(private readonly env: Env) {}

  async search(userId: string, query: string, limit: number): Promise<ReturnType<typeof publicItem>[]> {
    const ids: string[] = [];
    if (String(this.env.ANALYSIS_PROVIDER) !== "mock") {
      try {
        const output = embeddingsSchema.parse(
          await this.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [query.slice(0, 2_000)] }),
        );
        const vector = output.data[0];
        if (vector) {
          const matches = await this.env.VECTOR_INDEX.query(vector, {
            topK: Math.min(limit, 20),
            namespace: userId,
            returnMetadata: "indexed",
          });
          ids.push(...matches.matches.map((match) => match.id));
        }
      } catch (error) {
        console.error(
          JSON.stringify({ message: "semantic search unavailable; using lexical fallback", error: error instanceof Error ? error.message : "unknown" }),
        );
      }
    }

    const lexical = await this.env.DB.prepare(
      `SELECT item_id FROM item_search
       WHERE item_search MATCH ?1 AND user_id = ?2
       ORDER BY bm25(item_search) LIMIT ?3`,
    )
      .bind(ftsExpression(query), userId, limit)
      .all<{ item_id: string }>();
    ids.push(...lexical.results.map((row) => row.item_id));

    if (ids.length < limit) {
      const like = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      const fallback = await this.env.DB.prepare(
        `SELECT i.id FROM items i LEFT JOIN sources s ON s.id = i.source_id LEFT JOIN analyses a ON a.item_id = i.id
         WHERE i.user_id = ?1 AND (s.title LIKE ?2 ESCAPE '\\' OR a.essence LIKE ?2 ESCAPE '\\' OR a.summary LIKE ?2 ESCAPE '\\')
         ORDER BY i.saved_at DESC LIMIT ?3`,
      )
        .bind(userId, like, limit)
        .all<{ id: string }>();
      ids.push(...fallback.results.map((row) => row.id));
    }

    const uniqueIds = [...new Set(ids)].slice(0, limit);
    if (!uniqueIds.length) return [];
    const placeholders = uniqueIds.map((_, index) => `?${index + 2}`).join(", ");
    const rows = await this.env.DB.prepare(`${ITEM_SELECT} WHERE i.user_id = ?1 AND i.id IN (${placeholders})`)
      .bind(userId, ...uniqueIds)
      .all<ItemRow>();
    const byId = new Map(rows.results.map((row) => [row.id, row]));
    return uniqueIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [publicItem(row)] : [];
    });
  }

  async ask(userId: string, question: string, requestedThreadId?: string) {
    const items = await this.search(userId, question, 8);
    const threadId = requestedThreadId ?? crypto.randomUUID();
    if (requestedThreadId) {
      const existing = await this.env.DB.prepare("SELECT id FROM chat_threads WHERE id = ?1 AND user_id = ?2")
        .bind(requestedThreadId, userId)
        .first<{ id: string }>();
      if (!existing) throw new ApiError(404, "thread_not_found", "Conversation not found.");
    } else {
      const now = new Date().toISOString();
      await this.env.DB.prepare("INSERT INTO chat_threads (id, user_id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)")
        .bind(threadId, userId, question.slice(0, 120), now)
        .run();
    }

    const citations: Citation[] = items.slice(0, 5).map((item) => {
      const queryTerms = question.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]{3,}/gu) ?? [];
      const relevantMoment = item.analysis?.keyMoments.find(
        (moment) =>
          moment.sourceVerified &&
          queryTerms.some((term) => `${moment.label} ${moment.context}`.toLocaleLowerCase("en-US").includes(term)),
      );
      const timestampSeconds = relevantMoment?.seconds;
      return {
        itemId: item.id,
        title: item.title ?? item.analysis?.essence ?? "Untitled Imprint",
        url: item.sourceType === "youtube" ? youtubeTimestampUrl(item.canonicalUrl, timestampSeconds) : item.canonicalUrl,
        ...(timestampSeconds === undefined ? {} : { timestampSeconds }),
        excerpt: relevantMoment?.context || item.analysis?.essence || "Saved source",
      };
    });
    const answer = citations.length
      ? `Based only on your saved material, the strongest matches are:\n\n${items
          .slice(0, citations.length)
          .map((item, index) => `${index + 1}. ${item.analysis?.essence ?? item.title ?? "Saved source"} [${index + 1}]`)
          .join("\n")}\n\nOpen the citations to revisit the original context.`
      : "I couldn’t find enough saved material to answer that yet. Save an Imprint related to this question and try again.";
    const result = askAnswerSchema.parse({
      answer,
      citations,
      grounded: citations.length > 0,
      limitations: citations.length ? ["This answer is an extractive synthesis of saved Imprints, not outside knowledge."] : ["No supporting Imprints were found."],
    });
    const now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare("INSERT INTO chat_messages (id, thread_id, role, content, created_at) VALUES (?1, ?2, 'user', ?3, ?4)")
        .bind(crypto.randomUUID(), threadId, question, now),
      this.env.DB.prepare("INSERT INTO chat_messages (id, thread_id, role, content, citations_json, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4, ?5)")
        .bind(crypto.randomUUID(), threadId, result.answer, JSON.stringify(result.citations), now),
      this.env.DB.prepare("UPDATE chat_threads SET updated_at = ?2 WHERE id = ?1").bind(threadId, now),
    ]);
    return { threadId, ...result };
  }
}

export function parseSearch(url: URL) {
  return searchRequestSchema.parse({ query: url.searchParams.get("q") ?? "", limit: url.searchParams.get("limit") ?? undefined });
}
