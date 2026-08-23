import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        additionalExports: { IngestionWorkflow: "WorkflowEntrypoint" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, PROCESSING_MODE: "direct" } },
      }),
    ],
    test: { setupFiles: ["./test/setup.ts"], fileParallelism: false, sequence: { concurrent: false } },
  };
});
