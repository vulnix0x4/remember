import { z } from "zod";
import { ApiError } from "./http";
import { ITEM_SELECT, publicItem } from "./repository";
import { LifeRepository } from "./life-repository";
import type { LifeSnapshot } from "@remember/domain";
import type { ItemRow } from "./types";

export const exportRequestSchema = z.object({ format: z.enum(["json", "markdown"]) });

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function markdownText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/([`*_[\]<>#])/g, "\\$1")
    .replace(/^(\s*)([-+>])/gm, "$1\\$2");
}

function markdownList(values: string[]): string {
  return values.length ? values.map((value) => `- ${markdownText(value)}`).join("\n") : "_None._";
}

interface ExportDataset {
  schemaVersion: 2;
  exportedAt: string;
  items: ReturnType<typeof publicItem>[];
  connections: Record<string, unknown>[];
  personalSignals: Record<string, unknown>[];
  candidatePrinciples: Record<string, unknown>[];
  resurfacingEvents: Record<string, unknown>[];
  chatThreads: Record<string, unknown>[];
  chatMessages: Record<string, unknown>[];
  life: LifeSnapshot;
}

function markdownFor(dataset: ExportDataset): string {
  const sections = dataset.items.map((item) => {
    const analysis = item.analysis;
    const moments =
      analysis?.keyMoments.map(
        (moment) =>
          `- ${Math.floor(moment.seconds / 60)}:${String(moment.seconds % 60).padStart(2, "0")}: ${markdownText(moment.label)}\n  ${markdownText(moment.context)}\n  Source timestamp verified: ${moment.sourceVerified ? "yes" : "no"}`,
      ) ?? [];
    const ideas =
      analysis?.keyIdeas.map((idea) => `- ${markdownText(idea.text)}${idea.explanation ? `\n  ${markdownText(idea.explanation)}` : ""}`) ?? [];
    const claims = analysis?.claims.map((claim) => `- ${markdownText(claim.text)} (confidence: ${claim.confidence})`) ?? [];
    const principles =
      analysis?.candidatePrinciples.map(
        (principle) => `- ${markdownText(principle.text)}${principle.rationale ? `\n  Rationale: ${markdownText(principle.rationale)}` : ""}`,
      ) ?? [];
    const experiments =
      analysis?.actionableExperiments.map(
        (experiment) => `- ${markdownText(experiment.text)}${experiment.duration ? ` (duration: ${markdownText(experiment.duration)})` : ""}`,
      ) ?? [];
    const hypotheses =
      analysis?.personalRelevanceHypotheses.map(
        (hypothesis) =>
          `- **Hypothesis** (confidence: ${hypothesis.confidence}): ${markdownText(hypothesis.text)}\n  Evidence: ${hypothesis.evidence.length ? hypothesis.evidence.map(markdownText).join("; ") : "None supplied"}`,
      ) ?? [];
    const uncertainties =
      analysis?.uncertainties.map(
        (uncertainty) => `- ${markdownText(uncertainty.text)}${uncertainty.field ? ` (field: ${markdownText(uncertainty.field)})` : ""}`,
      ) ?? [];
    return [
      "---",
      `id: ${yamlString(item.id)}`,
      `source_type: ${yamlString(item.sourceType)}`,
      `original_url: ${yamlString(item.originalUrl)}`,
      `canonical_url: ${yamlString(item.canonicalUrl)}`,
      `external_id: ${item.externalId ? yamlString(item.externalId) : "null"}`,
      `saved_at: ${yamlString(item.savedAt)}`,
      `status: ${yamlString(item.status)}`,
      `captured_timestamp_seconds: ${item.capturedTimestampSeconds ?? "null"}`,
      `duration_seconds: ${item.durationSeconds ?? "null"}`,
      `thumbnail_url: ${item.thumbnailUrl ? yamlString(item.thumbnailUrl) : "null"}`,
      `author: ${item.author ? yamlString(item.author) : "null"}`,
      `processing_error: ${item.processingError ? yamlString(item.processingError) : "null"}`,
      `provenance: ${JSON.stringify(item.provenance)}`,
      "---",
      "",
      `# ${markdownText(item.title ?? analysis?.essence ?? "Untitled Imprint")}`,
      "",
      "## Essence",
      "",
      markdownText(analysis?.essence ?? "This source has not been analyzed."),
      "",
      "## Summary",
      "",
      markdownText(analysis?.summary ?? "Not available."),
      "",
      "## Key ideas",
      "",
      ideas.length ? ideas.join("\n") : "_None._",
      "",
      "## Key moments",
      "",
      moments.length ? moments.join("\n") : "_None._",
      "",
      "## Themes",
      "",
      markdownList(analysis?.themes ?? []),
      "",
      "## Claims",
      "",
      claims.length ? claims.join("\n") : "_None._",
      "",
      "## Candidate principles",
      "",
      principles.length ? principles.join("\n") : "_None._",
      "",
      "## Actionable experiments",
      "",
      experiments.length ? experiments.join("\n") : "_None._",
      "",
      "## Personal-relevance hypotheses",
      "",
      hypotheses.length ? hypotheses.join("\n") : "_None._",
      "",
      "## Uncertainties",
      "",
      uncertainties.length ? uncertainties.join("\n") : "_None._",
      "",
      "## Your reaction",
      "",
      item.personalReaction ? markdownText(item.personalReaction) : "_None recorded._",
      "",
      "## Processing provenance",
      "",
      `\`\`\`json\n${JSON.stringify(item.provenance, null, 2)}\n\`\`\``,
    ]
      .join("\n");
  });
  const recordList = (title: string, rows: unknown[]) =>
    rows.length ? `## ${title}\n\n\`\`\`json\n${JSON.stringify(rows, null, 2)}\n\`\`\`` : "";
  return [
    "# Remember export",
    `Generated ${dataset.exportedAt}`,
    sections.join("\n\n"),
    "# Personal evolution data",
    recordList("Connections", dataset.connections),
    recordList("Personal signals", dataset.personalSignals),
    recordList("Candidate principles", dataset.candidatePrinciples),
    recordList("Resurfacing history", dataset.resurfacingEvents),
    recordList("Ask conversations", [...dataset.chatThreads, ...dataset.chatMessages]),
    "# Personal Life OS data",
    recordList("Goals", dataset.life.goals),
    recordList("Tasks and blocker history", [...dataset.life.tasks, ...dataset.life.blockers]),
    recordList("Life Floor", dataset.life.floor),
    recordList("Calendar", dataset.life.events),
    recordList("Health", dataset.life.health),
    recordList("Finances", [...dataset.life.accounts, ...dataset.life.transactions]),
    recordList("Private vault metadata", dataset.life.files),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export class ExportService {
  constructor(private readonly env: Env) {}

  private async allItems(userId: string) {
    const rows = await this.env.DB.prepare(`${ITEM_SELECT} WHERE i.user_id = ?1 ORDER BY i.saved_at DESC`)
      .bind(userId)
      .all<ItemRow>();
    return rows.results.map(publicItem);
  }

  private async dataset(userId: string, exportedAt: string): Promise<ExportDataset> {
    const [items, connections, personalSignals, candidatePrinciples, resurfacingEvents, chatThreads, chatMessages, life] = await Promise.all([
      this.allItems(userId),
      this.env.DB.prepare("SELECT * FROM connections WHERE user_id = ?1 ORDER BY created_at").bind(userId).all(),
      this.env.DB.prepare("SELECT * FROM personal_signals WHERE user_id = ?1 ORDER BY occurred_at").bind(userId).all(),
      this.env.DB.prepare("SELECT * FROM candidate_principles WHERE user_id = ?1 ORDER BY created_at").bind(userId).all(),
      this.env.DB.prepare("SELECT * FROM resurfacing_events WHERE user_id = ?1 ORDER BY surfaced_at").bind(userId).all(),
      this.env.DB.prepare("SELECT * FROM chat_threads WHERE user_id = ?1 ORDER BY created_at").bind(userId).all(),
      this.env.DB.prepare(
        `SELECT m.* FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
         WHERE t.user_id = ?1 ORDER BY m.created_at`,
      )
        .bind(userId)
        .all(),
      new LifeRepository(this.env.DB).snapshot(userId, { allHistory: true }),
    ]);
    return {
      schemaVersion: 2,
      exportedAt,
      items,
      connections: connections.results,
      personalSignals: personalSignals.results,
      candidatePrinciples: candidatePrinciples.results,
      resurfacingEvents: resurfacingEvents.results,
      chatThreads: chatThreads.results,
      chatMessages: chatMessages.results,
      life,
    };
  }

  async create(userId: string, format: "json" | "markdown") {
    const exportId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const key = `exports/${userId}/${exportId}.${format === "json" ? "json" : "md"}`;
    await this.env.DB.prepare("INSERT INTO exports (id, user_id, format, status, created_at) VALUES (?1, ?2, ?3, 'pending', ?4)")
      .bind(exportId, userId, format, createdAt)
      .run();
    try {
      const dataset = await this.dataset(userId, createdAt);
      const content = format === "json" ? JSON.stringify(dataset, null, 2) : markdownFor(dataset);
      const contentType = format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8";
      await this.env.MEDIA.put(key, content, {
        httpMetadata: { contentType, contentDisposition: `attachment; filename="remember-export.${format === "json" ? "json" : "md"}"` },
        customMetadata: { userId, exportId, schemaVersion: "2" },
      });
      await this.env.DB.prepare("UPDATE exports SET status = 'ready', r2_key = ?2, completed_at = ?3 WHERE id = ?1")
        .bind(exportId, key, new Date().toISOString())
        .run();
      return { id: exportId, format, status: "ready", downloadUrl: `/api/exports/${exportId}` };
    } catch (error) {
      await this.env.DB.prepare("UPDATE exports SET status = 'failed', error = ?2, completed_at = ?3 WHERE id = ?1")
        .bind(exportId, error instanceof Error ? error.message.slice(0, 500) : "Unknown error", new Date().toISOString())
        .run();
      throw error;
    }
  }

  async download(userId: string, exportId: string): Promise<Response> {
    const row = await this.env.DB.prepare("SELECT format, status, r2_key FROM exports WHERE id = ?1 AND user_id = ?2")
      .bind(exportId, userId)
      .first<{ format: "json" | "markdown"; status: string; r2_key: string | null }>();
    if (!row) throw new ApiError(404, "export_not_found", "Export not found.");
    if (row.status !== "ready" || !row.r2_key) throw new ApiError(409, "export_not_ready", "Export is not ready yet.");
    const object = await this.env.MEDIA.get(row.r2_key);
    if (!object) throw new ApiError(503, "export_unavailable", "Export data is temporarily unavailable.");
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, no-store");
    return new Response(object.body, { headers });
  }
}
