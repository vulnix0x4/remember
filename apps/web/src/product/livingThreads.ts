import type { Imprint } from "../types";

export interface LivingThread {
  id: string;
  name: string;
  saves: Imprint[];
  earliest: Imprint;
  latest: Imprint;
  turningPoints: ThreadTurningPoint[];
  pulse: ThreadPulse;
  question: string;
}

export type ThreadReflectionResponse = "still_true" | "changed_mind" | "not_sure" | "no_longer_relevant";

export interface ThreadReflection {
  id: string;
  itemId: string;
  response: ThreadReflectionResponse;
  occurredAt: string;
}

export interface ThreadTurningPoint {
  id: string;
  imprint: Imprint;
  response: ThreadReflectionResponse;
  occurredAt: string;
  label: string;
  detail: string;
}

export interface ThreadPulse {
  kind: "unread" | "held" | "shifting" | "open" | "released";
  label: string;
  detail: string;
}

function savedAtValue(imprint: Imprint): number {
  const parsed = Date.parse(imprint.savedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function canonicalTheme(theme: string): string {
  return theme.trim().toLocaleLowerCase("en-US");
}

function reflectionCopy(response: ThreadReflectionResponse): Pick<ThreadTurningPoint, "label" | "detail"> {
  switch (response) {
    case "still_true": return { label: "You reaffirmed this", detail: "It still felt true when it came back." };
    case "changed_mind": return { label: "Your view shifted here", detail: "You saw this differently when it returned." };
    case "not_sure": return { label: "You left this open", detail: "You were not ready to settle it yet." };
    case "no_longer_relevant": return { label: "You let this go", detail: "You decided this no longer belongs." };
  }
}

function pulseFor(response?: ThreadReflectionResponse): ThreadPulse {
  switch (response) {
    case "still_true": return { kind: "held", label: "Still part of your compass", detail: "You have come back to this and chosen to keep it." };
    case "changed_mind": return { kind: "shifting", label: "Your thinking is changing", detail: "This thread contains a real change of mind, not just another related save." };
    case "not_sure": return { kind: "open", label: "Still unresolved", detail: "You left this open. Remember can help you stay with the question without forcing an answer." };
    case "no_longer_relevant": return { kind: "released", label: "You are carrying this differently", detail: "Part of this thread no longer belongs, which is also part of how your thinking changed." };
    default: return { kind: "unread", label: "Ready for your take", detail: "The pattern is here. The next useful signal is what it means to you now." };
  }
}

function questionFor(name: string, response?: ThreadReflectionResponse): string {
  const subject = name.toLocaleLowerCase("en-US");
  switch (response) {
    case "still_true": return `What makes my thinking about ${subject} still feel true now, and where does it matter in my life?`;
    case "changed_mind": return `What changed my mind about ${subject}, and what do I seem to believe instead?`;
    case "not_sure": return `What would help me know what I think about ${subject}, without forcing an answer too early?`;
    case "no_longer_relevant": return `What am I carrying now instead of the part of ${subject} I let go?`;
    default: return `How has my thinking about ${subject} changed across these saves? What still feels unresolved?`;
  }
}

export function buildLivingThreads(imprints: Imprint[], reflections: ThreadReflection[] = []): LivingThread[] {
  const groups = new Map<string, { name: string; saves: Imprint[] }>();
  const imprintsByID = new Map(imprints.map((imprint) => [imprint.id, imprint]));

  for (const imprint of imprints) {
    if (imprint.status !== "ready" && imprint.status !== "partial") continue;
    const seen = new Set<string>();
    for (const theme of imprint.themes) {
      const key = canonicalTheme(theme);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) ?? { name: theme.trim(), saves: [] };
      group.saves.push(imprint);
      groups.set(key, group);
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.saves.length >= 2)
    .map(([id, group]) => {
      const saves = [...group.saves].sort((left, right) => savedAtValue(left) - savedAtValue(right));
      const saveIDs = new Set(saves.map((save) => save.id));
      const turningPoints = reflections
        .filter((reflection) => saveIDs.has(reflection.itemId))
        .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
        .flatMap((reflection): ThreadTurningPoint[] => {
          const imprint = imprintsByID.get(reflection.itemId);
          if (!imprint) return [];
          return [{ ...reflection, imprint, ...reflectionCopy(reflection.response) }];
        });
      const latestResponse = turningPoints.at(-1)?.response;
      return {
        id,
        name: group.name,
        saves,
        earliest: saves[0]!,
        latest: saves[saves.length - 1]!,
        turningPoints,
        pulse: pulseFor(latestResponse),
        question: questionFor(group.name, latestResponse),
      };
    })
    .sort((left, right) => right.saves.length - left.saves.length
      || savedAtValue(right.latest) - savedAtValue(left.latest)
      || left.name.localeCompare(right.name));
}
