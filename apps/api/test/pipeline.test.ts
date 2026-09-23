import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { analysisSchema, canonicalizeSourceUrl } from "@remember/domain";
import { ensureUser } from "../src/auth";
import { EvolutionService } from "../src/evolution";
import { ExportService } from "../src/exports";
import { runIngestion } from "../src/processing";
import { Repository } from "../src/repository";
import { ASK_SYNTHESIS_TIMEOUT_MS, OPENROUTER_ASK_FALLBACK_MODELS, SearchService, cleanGroundedAnswer, normalizeGroundedCitations } from "../src/search";

describe("local vertical slice", () => {
  it("keeps grounding metadata while removing citation clutter from the answer", () => {
    expect(normalizeGroundedCitations(
      "Discipline keeps appearing [7], alongside rebuilding after hard moments [2][3].",
      [7, 2, 3, 6],
      8,
    )).toEqual({
      indices: [7, 2, 3],
      answer: "Discipline keeps appearing, alongside rebuilding after hard moments.",
    });
    expect(cleanGroundedAnswer("A natural answer [1][2] — without citation noise."))
      .toBe("A natural answer - without citation noise.");
  });

  it("uses fast, structured GLM synthesis with a resilient model fallback", async () => {
    const userId = "40000000-0000-4000-8000-000000000006";
    await ensureUser(env.DB, userId);
    const repository = new Repository(env.DB);
    const captured = await repository.capture(
      userId,
      canonicalizeSourceUrl("https://example.com/attention-practice"),
      "This felt useful for rebuilding focus.",
      "2026-08-31T12:00:00.000Z",
      "ask-synthesis-contract",
    );
    const analysis = analysisSchema.parse({
      essence: "Attention becomes steadier through small deliberate repetitions.",
      summary: "A source-grounded practice for rebuilding focus.",
      keyIdeas: [{ text: "Repeat one small focus practice.", explanation: "Consistency matters more than intensity." }],
      keyMoments: [],
      themes: ["attention", "rebuilding"],
      claims: [],
      candidatePrinciples: [],
      actionableExperiments: [],
      personalRelevanceHypotheses: [],
      uncertainties: [],
    });
    await repository.persistAnalysis(captured.row, analysis, { name: "test", model: "ask-contract" });

    const requests: Request[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const beforePersistence = await env.DB.prepare("SELECT COUNT(*) AS count FROM chat_threads WHERE user_id = ?1")
        .bind(userId)
        .first<{ count: number }>();
      expect(beforePersistence?.count).toBe(0);
      requests.push(new Request(input, init));
      return Response.json({
        model: "z-ai/glm-5.3-flash",
        provider: "test-provider",
        choices: [{
          finish_reason: "stop",
          message: { content: JSON.stringify({
            answer: "Your saves connect rebuilding focus with one small repeated practice [1].",
            citationIndices: [1, 2, 3, 4, 5, 6],
            limitations: "This is supported by one saved source.",
          }) },
        }],
      });
    };
    const openRouterEnv = {
      ...env,
      ANALYSIS_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "test-secret",
      OPENROUTER_MODEL: "z-ai/glm-5.3-flash",
      OPENROUTER_SITE_URL: "https://memory.example.test",
      AI: { run: async () => ({ data: [[0]] }) },
      VECTOR_INDEX: { query: async () => ({ matches: [] }) },
    } as unknown as Env;

    const answer = await new SearchService(openRouterEnv, fetcher).ask(userId, "How can I rebuild my attention?");

    expect(answer.answer).toBe("Your saves connect rebuilding focus with one small repeated practice.");
    expect(answer.citations).toHaveLength(1);
    expect(answer.limitations).toEqual(["This is supported by one saved source."]);
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    const body = await request.json() as {
      models: string[];
      messages: Array<{ content: string }>;
      max_tokens: number;
      reasoning: { effort: string; exclude: boolean };
      response_format: { type: string };
      provider: { require_parameters: boolean; data_collection: string; sort: string };
    };
    expect(body.models).toEqual(["z-ai/glm-5.3-flash", ...OPENROUTER_ASK_FALLBACK_MODELS]);
    expect(body.max_tokens).toBe(2_500);
    expect(body.reasoning).toEqual({ effort: "low", exclude: true });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.provider).toEqual({ require_parameters: true, data_collection: "deny", sort: "throughput" });
    expect(body.messages[1]?.content).toContain("Do not use numbered lists, citation markers, source numbers");
    expect(body.messages[1]?.content).toContain("Include at most 3 source numbers");
    expect(ASK_SYNTHESIS_TIMEOUT_MS).toBe(40_000);
    const persisted = await env.DB.prepare(
      `SELECT COUNT(DISTINCT t.id) AS threads, COUNT(m.id) AS messages
       FROM chat_threads t LEFT JOIN chat_messages m ON m.thread_id = t.id WHERE t.user_id = ?1`,
    ).bind(userId).first<{ threads: number; messages: number }>();
    expect(persisted).toEqual({ threads: 1, messages: 2 });
  });

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
    expect(markdown).toContain("## Possible takeaways");
    expect(markdown).toContain("## Things to try");
    expect(markdown).toContain("## Possible relevance");
    expect(markdown).toContain("**Possibility**");
    expect(markdown).toContain("## What is uncertain");
    expect(markdown).toContain("captured_timestamp_seconds:");
    expect(markdown).toContain("## Analysis details");
    expect(markdown).toContain("# Plans and personal records");
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
