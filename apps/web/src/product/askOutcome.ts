import type { AskMessage, Imprint } from "../types";

export interface AskOutcome {
  imprint: Imprint;
  experiment?: Imprint["experiments"][number];
  principle?: string;
}

export function buildAskOutcome(message: AskMessage, imprints: Imprint[]): AskOutcome | null {
  if (message.role !== "assistant" || message.grounded !== true) return null;
  for (const citation of message.citations ?? []) {
    const imprint = imprints.find((item) => item.id === citation.imprintId);
    if (!imprint) continue;
    const experiment = imprint.experiments[0];
    const principle = imprint.principle?.trim();
    if (experiment || principle) return { imprint, ...(experiment ? { experiment } : {}), ...(principle ? { principle } : {}) };
  }
  return null;
}
