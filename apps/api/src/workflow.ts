import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { analysisSchema, type ImprintAnalysis } from "@remember/domain";
import { analysisProvider } from "./providers";
import { fetchAndStoreMetadata, indexAnalysis } from "./processing";
import { Repository } from "./repository";
import type { ItemRow, ProcessingInput, SourceMetadata } from "./types";
import { publicProcessingError, safeErrorMessage } from "./http";

interface SerializableItem {
  id: string;
  userId: string;
}

export class IngestionWorkflow extends WorkflowEntrypoint<Env, ProcessingInput> {
  async run(event: WorkflowEvent<ProcessingInput>, step: WorkflowStep): Promise<{ itemId: string; status: string }> {
    const input = event.payload;
    try {
      await step.do("mark item processing", async () => {
        await new Repository(this.env.DB).markProcessing(input.itemId);
        return { itemId: input.itemId };
      });

      const item = await step.do<SerializableItem>("load authorized item", async () => {
        const row = await new Repository(this.env.DB).itemForProcessing(input.userId, input.itemId);
        return { id: row.id, userId: row.user_id };
      });

      const metadata = await step.do<SourceMetadata>(
        "fetch source metadata",
        { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" },
        async () => {
          const row = await new Repository(this.env.DB).itemForProcessing(item.userId, item.id);
          return fetchAndStoreMetadata(this.env, row, input.sourceText);
        },
      );

      const analysis = await step.do<ImprintAnalysis>(
        "analyze source",
        { retries: { limit: 3, delay: "15 seconds", backoff: "exponential" }, timeout: "10 minutes" },
        async () => {
          const row = await new Repository(this.env.DB).itemForProcessing(item.userId, item.id);
          const provider = analysisProvider(this.env);
          return provider.analyze({
            canonicalUrl: row.canonical_url,
            sourceType: row.source_type === "youtube" ? "youtube" : "web",
            title: metadata.title ?? row.title,
            author: metadata.author ?? row.author,
            personalReaction: row.personal_reaction,
            sourceText: metadata.transcript,
          });
        },
      );

      await step.do("persist validated imprint", async () => {
        const row = await new Repository(this.env.DB).itemForProcessing(item.userId, item.id);
        const provider = analysisProvider(this.env);
        await new Repository(this.env.DB).persistAnalysis(row, analysisSchema.parse(analysis), provider);
        return { persisted: true };
      });

      await step.do("index and connect imprint", async () => {
        const repository = new Repository(this.env.DB);
        const row: ItemRow = await repository.itemForProcessing(item.userId, item.id);
        const [indexed, connections] = await Promise.all([
          indexAnalysis(this.env, row, analysis),
          repository.createConnections(row, analysis),
        ]);
        return { indexed, connections };
      });
      return { itemId: item.id, status: "ready" };
    } catch (error) {
      console.error(JSON.stringify({ message: "ingestion workflow failed", itemId: input.itemId, error: safeErrorMessage(error) }));
      await new Repository(this.env.DB).markFailed(input.itemId, publicProcessingError(error));
      throw error;
    }
  }
}
