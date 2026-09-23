import type { DecisionBrief, Imprint } from "../types";

function words(value: string) {
  return new Set(value.toLocaleLowerCase("en-US").match(/[a-z0-9]{3,}/g) ?? []);
}

function score(imprint: Imprint, query: Set<string>) {
  const text = [imprint.title, imprint.essence, imprint.summary, ...imprint.themes, ...imprint.keyIdeas].join(" ").toLocaleLowerCase("en-US");
  return [...query].reduce((total, word) => total + (text.includes(word) ? 2 : 0), 0);
}

export function buildLocalDecisionBrief(decision: string, context: string, imprints: Imprint[]): DecisionBrief {
  const query = words(`${decision} ${context}`);
  const candidates = imprints
    .filter((imprint) => imprint.status === "ready" || imprint.status === "partial")
    .map((imprint, index) => ({ imprint, index, score: score(imprint, query) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 4)
    .map(({ imprint }) => imprint);
  const first = candidates[0];
  const second = candidates[1];
  return {
    decision,
    perspective: first?.summary || "Your library does not yet contain enough material to frame this decision.",
    whatMatters: first?.principle || first?.hypothesis || first?.keyIdeas[0] || "Name what you want this decision to protect.",
    pullToward: first?.keyIdeas[0] || first?.essence || "Your saves do not yet show a clear pull in this direction.",
    pullAgainst: second?.uncertainty || first?.uncertainty || second?.keyIdeas[0] || "Your saves do not yet show what might be lost or made harder by this choice.",
    smallTest: first?.experiments[0]?.text || "Try the smallest reversible version of the choice before committing further.",
    nextQuestion: "What would I need to learn for this choice to become clearer?",
    citations: candidates.slice(0, 3).map((imprint) => ({ imprintId: imprint.id, label: imprint.title, url: imprint.url })),
    grounded: candidates.length > 0,
    limitations: candidates.length ? ["This preview uses the closest material already in your library."] : ["No supporting saves were found for this decision yet."],
  };
}
