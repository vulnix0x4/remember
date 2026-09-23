import type { CalendarEvent, LifeArea, LifeSnapshot, LifeTask } from "../life/types";
import type { Imprint } from "../types";
import { carryForwardArea, lifeAreaForMaterial } from "./carryForward";
import { createReturnEligibility, latestByItem, type ReturnHistory } from "./returnEligibility";

export type ContextualReturnKind = "task" | "goal" | "event" | "question";

export interface ContextualReturnAction {
  title: string;
  firstStep: string;
  durationMinutes: number;
}

export interface ContextualReturn {
  imprint: Imprint;
  contextKind: ContextualReturnKind;
  contextTitle: string;
  contextArea: LifeArea;
  contextDetail: string | null;
  connection: string;
  reason: string;
  question: string;
  livedResult: "helped" | "mixed" | null;
  suggestedAction: ContextualReturnAction | null;
}

export interface ContextualReturnOptions extends ReturnHistory {
  recentQuestion?: { question: string; askedAt: string } | null;
  excludingItemIds?: Iterable<string>;
  now?: Date;
}

interface CurrentContext {
  kind: ContextualReturnKind;
  title: string;
  area: LifeArea;
  material: string;
  detail: string | null;
  priority: number;
}

const ignoredWords = new Set(["about", "after", "again", "also", "been", "before", "being", "could", "from", "have", "into", "just", "more", "only", "other", "should", "that", "their", "there", "these", "thing", "this", "through", "today", "what", "when", "where", "which", "with", "would", "your"]);
const dayMs = 86_400_000;

function tokens(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase("en-US").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4 && !ignoredWords.has(word)));
}

function resolvedArea(area: LifeArea, material: string): LifeArea {
  return area === "direction" ? lifeAreaForMaterial(material) : area;
}

function eventContext(snapshot: LifeSnapshot, now: Date): CalendarEvent | null {
  const horizon = now.getTime() + 36 * 60 * 60 * 1_000;
  return [...snapshot.events]
    .filter((event) => event.status !== "cancelled" && Date.parse(event.endAt) > now.getTime() && Date.parse(event.startAt) <= horizon)
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))[0] ?? null;
}

function currentContexts(snapshot: LifeSnapshot, options: ContextualReturnOptions): CurrentContext[] {
  const now = options.now ?? new Date();
  const contexts: CurrentContext[] = [];
  const task = snapshot.tasks.find((item) => item.status === "active");
  if (task) {
    const material = `${task.title} ${task.firstStep} ${task.notes}`;
    contexts.push({ kind: "task", title: task.title, area: resolvedArea(task.area, material), material, detail: task.firstStep || null, priority: 7 });
  }
  const event = eventContext(snapshot, now);
  if (event) {
    const material = `${event.title} ${event.notes} ${event.location} ${event.calendarName}`;
    const sameDay = new Date(event.startAt).toDateString() === now.toDateString();
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.startAt));
    const day = sameDay ? "Today" : "Tomorrow";
    contexts.push({ kind: "event", title: event.title, area: lifeAreaForMaterial(material), material, detail: event.allDay ? `${day}, all day` : `${day} at ${time}`, priority: 6 });
  }
  const recentQuestion = options.recentQuestion;
  if (recentQuestion && Date.parse(recentQuestion.askedAt) >= now.getTime() - 14 * dayMs) {
    contexts.push({ kind: "question", title: recentQuestion.question, area: lifeAreaForMaterial(recentQuestion.question), material: recentQuestion.question, detail: "From your recent Ask conversation", priority: 8 });
  }
  const goal = snapshot.goals.find((item) => item.status === "active");
  if (goal) {
    const material = `${goal.title} ${goal.vision} ${goal.why}`;
    contexts.push({ kind: "goal", title: goal.title, area: resolvedArea(goal.area, material), material, detail: goal.why || goal.vision || null, priority: 4 });
  }
  return contexts;
}

export function contextualReturnLabel(kind: ContextualReturnKind): string {
  if (kind === "task") return "current task";
  if (kind === "goal") return "active goal";
  if (kind === "event") return "next event";
  return "recent question";
}

function conciseAction(value: string): string {
  const clean = value.trim().replace(/[.!?]+$/, "");
  if (clean.length <= 84) return clean;
  const candidate = clean.slice(0, 81);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > 48 ? boundary : 81).trim()}…`;
}

function suggestedAction(imprint: Imprint): ContextualReturnAction | null {
  const experiment = imprint.experiments[0];
  if (!experiment) return null;
  return { title: conciseAction(experiment.text), firstStep: experiment.text, durationMinutes: 15 };
}

export function findContextualReturn(imprints: Imprint[], snapshot: LifeSnapshot, options: ContextualReturnOptions = {}): ContextualReturn | null {
  const contexts = currentContexts(snapshot, options);
  if (!contexts.length) return null;
  const now = options.now ?? new Date();
  const excluded = new Set(options.excludingItemIds ?? []);
  const canReturn = createReturnEligibility(options, now);
  const reflections = latestByItem(options.reflections ?? []);
  const feedback = latestByItem(options.returnFeedback ?? []);
  const resultBySource = new Map<string, LifeTask>();
  for (const task of [...snapshot.tasks]
    .filter((item) => item.source === "practice" && item.sourceItemId && item.practiceOutcome)
    .sort((left, right) => Date.parse(right.reflectedAt ?? right.updatedAt) - Date.parse(left.reflectedAt ?? left.updatedAt))) {
    if (!resultBySource.has(task.sourceItemId!)) resultBySource.set(task.sourceItemId!, task);
  }

  const scored = imprints.flatMap((imprint) => {
    if (excluded.has(imprint.id) || !canReturn(imprint)) return [];
    const livedResult = resultBySource.get(imprint.id)?.practiceOutcome ?? null;
    const reflection = reflections.get(imprint.id);
    const priorFeedback = feedback.get(imprint.id);
    if (livedResult === "not_for_me") return [];

    const imprintTokens = tokens(`${imprint.title} ${imprint.essence} ${imprint.summary} ${imprint.themes.join(" ")} ${imprint.keyIdeas.join(" ")}`);
    return contexts.flatMap((context) => {
      const contextTokens = tokens(context.material);
      const overlap = [...contextTokens].filter((word) => imprintTokens.has(word));
      const sameArea = carryForwardArea(imprint) === context.area;
      const relevance = overlap.length * 3 + (sameArea && context.area !== "direction" ? 5 : 0) + (imprint.personalReaction ? 1 : 0);
      if (relevance <= 0) return [];
      const reflectionBoost = reflection?.response === "still_true" ? 4 : reflection?.response === "changed_mind" ? 2 : reflection?.response === "not_sure" ? 1 : 0;
      const usefulBoost = priorFeedback?.response === "useful" ? 4 : 0;
      const resultBoost = livedResult === "helped" ? 7 : livedResult === "mixed" ? 2 : 0;
      const matchedTheme = imprint.themes.find((theme) => [...tokens(theme)].some((word) => contextTokens.has(word)));
      return [{ imprint, context, overlap, sameArea, score: relevance + context.priority + reflectionBoost + usefulBoost + resultBoost, matchedTheme, livedResult, reflection }];
    });
  }).sort((left, right) => right.score - left.score || Date.parse(right.imprint.savedAt) - Date.parse(left.imprint.savedAt));

  const best = scored[0];
  if (!best) return null;
  const connection = best.matchedTheme ?? (best.sameArea ? best.context.area : best.overlap[0] ?? "a shared idea");
  const label = contextualReturnLabel(best.context.kind);
  const reason = best.livedResult === "helped"
    ? `You tried this before and said it helped. It connects to your ${label}, “${best.context.title},” through ${connection}.`
    : best.livedResult === "mixed"
      ? `Part of this helped before. It connects to your ${label}, “${best.context.title},” through ${connection}.`
      : best.reflection?.response === "still_true"
        ? `You said this still feels true. Remember brought it back because it connects to your ${label}, “${best.context.title}.”`
        : best.reflection?.response === "changed_mind"
          ? `Your view of this has changed. That makes it useful to reconsider beside your ${label}, “${best.context.title}.”`
          : `Remember connected this save to your ${label}, “${best.context.title},” through ${connection}.`;
  const question = best.context.kind === "question"
    ? `How does “${best.imprint.title}” change how I might answer “${best.context.title}” now?`
    : best.context.kind === "event"
      ? `What from “${best.imprint.title}” do I want to carry into “${best.context.title}”?`
      : `What from “${best.imprint.title}” could help me with “${best.context.title}” today?`;
  return {
    imprint: best.imprint,
    contextKind: best.context.kind,
    contextTitle: best.context.title,
    contextArea: best.context.area,
    contextDetail: best.context.detail,
    connection,
    reason,
    question,
    livedResult: best.livedResult === "helped" || best.livedResult === "mixed" ? best.livedResult : null,
    suggestedAction: suggestedAction(best.imprint),
  };
}
