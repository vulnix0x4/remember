import type { Imprint } from "../types";

function momentUrl(imprint: Imprint, seconds: number): string {
  if (imprint.sourceType !== "YouTube") return imprint.url;
  const url = new URL(imprint.url);
  url.searchParams.set("t", `${seconds}s`);
  return url.toString();
}

function section(title: string, values: Array<string | undefined>): string {
  const content = values.filter((value): value is string => Boolean(value));
  return content.length ? `## ${title}\n\n${content.join("\n")}` : "";
}

export function exportImprintsJson(imprints: Imprint[]): string {
  return JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), imprints }, null, 2);
}

export function exportImprintsMarkdown(imprints: Imprint[]): string {
  return imprints.map((item) => [
    `# ${item.title}`,
    [
      `- Status: ${item.status}`,
      `- Source type: ${item.sourceType}`,
      `- Creator: ${item.creator}`,
      `- Source: ${item.url}`,
      `- Saved: ${item.savedAt}`,
      `- Life period: ${item.lifePeriod}`,
      item.duration ? `- Duration: ${item.duration}` : undefined,
      item.themes.length ? `- Themes: ${item.themes.join(", ")}` : undefined,
    ].filter(Boolean).join("\n"),
    section("Essence", [item.essence]),
    section("Summary", [item.summary]),
    section("Your reaction", item.personalReaction ? [item.personalReaction] : []),
    section("Ideas", item.keyIdeas.map((idea) => `- ${idea}`)),
    section("Moments", item.moments.map((moment) => `- [${moment.time}: ${moment.title}](${momentUrl(item, moment.seconds)})${moment.note ? `: ${moment.note}` : ""}`)),
    section("Candidate principle", item.principle ? [`> ${item.principle}`] : []),
    section("Possible personal relevance", item.hypothesis ? [item.hypothesis] : []),
    section("Uncertainty", item.uncertainty ? [item.uncertainty] : []),
    section("Connections", item.connectionIds.map((id) => `- ${id}`)),
  ].filter(Boolean).join("\n\n")).join("\n\n---\n\n");
}
