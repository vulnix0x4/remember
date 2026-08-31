import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { analysisSchema, canonicalizeSourceUrl } from "@remember/domain";
import { ensureUser } from "../src/auth";
import { EvolutionService } from "../src/evolution";
import { ExportService } from "../src/exports";
import { runIngestion } from "../src/processing";
import { Repository } from "../src/repository";
import { SearchService } from "../src/search";

describe("local vertical slice", () => {
  it("processes, searches, answers, resurfaces, and exports an Imprint", async () => {
    const userId = "40000000-0000-4000-8000-000000000004";
    await ensureUser(env.DB, userId);
    const repository = new Repository(env.DB);
    const captured = await repository.capture(
      userId,
      canonicalizeSourceUrl("https://youtu.be/M7lc1UVf-VE?si=tracking"),
      "This connected to rebuilding after a difficult year.",
      "2025-08-21T12:00:00.000Z",
      "pipeline-capture",
    );

    await runIngestion(env, { itemId: captured.row.id, userId });
    const ready = await repository.requireItem(userId, captured.row.id);
    expect(ready.status).toBe("ready");

    const analyzed = analysisSchema.parse(JSON.parse(ready.analysis_json ?? "{}"));
    await repository.persistAnalysis(
      ready,
      {
        ...analyzed,
        keyMoments: [
          { seconds: 95, label: "Rebuilding after loss", context: "The source connects rebuilding to deliberate attention.", sourceVerified: true },
        ],
      },
      { name: "test", model: "citation-fixture" },
    );

    const search = new SearchService(env);
    const matches = await search.search(userId, "return central idea", 10);
    expect(matches.map((item) => item.id)).toContain(captured.row.id);

    const answer = await search.ask(userId, "What did I save about rebuilding?");
    expect(answer.grounded).toBe(true);
    expect(answer.citations[0]?.itemId).toBe(captured.row.id);
    expect(answer.citations[0]?.timestampSeconds).toBe(95);
    expect(answer.citations[0]?.url).toContain("t=95s");

    const resurfaced = await new EvolutionService(env.DB).resurfaced(userId);
    expect(resurfaced).toMatchObject({ itemId: captured.row.id });

    const createdExport = await new ExportService(env).create(userId, "json");
    const response = await new ExportService(env).download(userId, createdExport.id);
    const payload = (await response.json()) as { schemaVersion: number; items: Array<{ id: string }>; life: { tasks: unknown[]; health: unknown[] } };
    expect(payload.schemaVersion).toBe(2);
    expect(payload.items.map((item) => item.id)).toContain(captured.row.id);
    expect(payload.life).toMatchObject({ tasks: [], health: [] });

    const markdownExport = await new ExportService(env).create(userId, "markdown");
    const markdownResponse = await new ExportService(env).download(userId, markdownExport.id);
    const markdown = await markdownResponse.text();
    expect(markdown).toContain("## Key ideas");
    expect(markdown).toContain("## Claims");
    expect(markdown).toContain("## Candidate principles");
    expect(markdown).toContain("## Actionable experiments");
    expect(markdown).toContain("## Personal-relevance hypotheses");
    expect(markdown).toContain("**Hypothesis**");
    expect(markdown).toContain("## Uncertainties");
    expect(markdown).toContain("captured_timestamp_seconds:");
    expect(markdown).toContain("## Processing provenance");
    expect(markdown).toContain("# Personal Life OS data");
  });

  it("does not call a recent Ready item a resurfaced memory", async () => {
    const userId = "40000000-0000-4000-8000-000000000005";
    await ensureUser(env.DB, userId);
    const repository = new Repository(env.DB);
    const captured = await repository.capture(
      userId,
      canonicalizeSourceUrl("https://youtu.be/M7lc1UVf-VE?si=recent"),
      null,
      new Date().toISOString(),
      "recent-resurfacing-check",
    );
    await runIngestion(env, { itemId: captured.row.id, userId });
    expect((await repository.requireItem(userId, captured.row.id)).status).toBe("ready");

    expect(await new EvolutionService(env.DB).resurfaced(userId)).toBeNull();
  });
});
