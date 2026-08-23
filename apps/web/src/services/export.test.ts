import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { exportImprintsJson, exportImprintsMarkdown } from "./export";

describe("portable exports", () => {
  it("preserves the complete Imprint in JSON", () => {
    const parsed = JSON.parse(exportImprintsJson(imprints)) as { formatVersion: number; imprints: typeof imprints };
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.imprints[0]).toEqual(imprints[0]);
  });

  it("includes source-backed fields and clearly labels AI interpretation in Markdown", () => {
    const output = exportImprintsMarkdown(imprints);
    expect(output).toContain("## Ideas");
    expect(output).toContain("03:18: Pain is not a lesson by default");
    expect(output).toContain("t=198s");
    expect(output).toContain("## Candidate principle");
    expect(output).toContain("AI hypothesis:");
    expect(output).toContain("## Uncertainty");
    expect(output).toContain("## Connections");
    expect(output).toContain("- Status: ready");
    expect(output).toContain("- Life period: A season of rebuilding");
  });
});
