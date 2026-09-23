import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { exportImprintsJson, exportImprintsMarkdown } from "./export";
import { emptyLifeSnapshot } from "../life/types";

describe("portable exports", () => {
  it("preserves the complete Imprint in JSON", () => {
    const parsed = JSON.parse(exportImprintsJson(imprints, emptyLifeSnapshot())) as { formatVersion: number; imprints: typeof imprints; life: ReturnType<typeof emptyLifeSnapshot> };
    expect(parsed.formatVersion).toBe(2);
    expect(parsed.imprints[0]).toEqual(imprints[0]);
    expect(parsed.life.tasks).toEqual([]);
  });

  it("includes source-backed fields and clearly labels tentative interpretation in Markdown", () => {
    const output = exportImprintsMarkdown(imprints, emptyLifeSnapshot());
    expect(output).toContain("## Ideas");
    expect(output).toContain("03:18: Pain is not a lesson by default");
    expect(output).toContain("t=198s");
    expect(output).toContain("## Candidate principle");
    expect(output).toContain("## Possible personal relevance");
    expect(output).toContain("## Uncertainty");
    expect(output).toContain("## Connections");
    expect(output).toContain("- Status: ready");
    expect(output).toContain("- Life period: A season of rebuilding");
    expect(output).toContain("# Remember data");
    expect(output).toContain("Saved items and personal records");
  });
});
