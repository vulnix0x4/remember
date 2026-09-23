import type { LifeSnapshot, LifeTask, PracticeOutcome } from "../life/types";
import type { Imprint } from "../types";
import type { CompassExperiment } from "./personalCompass";

export interface WeeklySynthesis {
  headline: string;
  story: string;
  reflection: string | null;
  theme: string | null;
  experiment: CompassExperiment | null;
  outcome: PracticeOutcome | null;
  canCarryForward: boolean;
}

const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sourceForTask(task: LifeTask, imprints: Imprint[]): Imprint | undefined {
  return imprints.find((imprint) => task.sourceItemId === imprint.id)
    ?? imprints.find((imprint) => task.notes.includes(imprint.url) || task.notes.includes(`“${imprint.title}”`));
}

function dominantTheme(imprints: Imprint[]): string | null {
  const counts = new Map<string, { count: number; first: number }>();
  let order = 0;
  for (const imprint of [...imprints].sort((left, right) => timestamp(right.savedAt) - timestamp(left.savedAt))) {
    for (const theme of imprint.themes) {
      const key = theme.trim();
      if (!key) continue;
      const current = counts.get(key);
      counts.set(key, { count: (current?.count ?? 0) + 1, first: current?.first ?? order++ });
    }
  }
  return [...counts.entries()].sort((left, right) => right[1].count - left[1].count || left[1].first - right[1].first)[0]?.[0] ?? null;
}

export function buildWeeklySynthesis(imprints: Imprint[], life: LifeSnapshot, now = new Date()): WeeklySynthesis | null {
  const start = now.getTime() - weekInMilliseconds;
  const recentImprints = imprints.filter((imprint) => timestamp(imprint.savedAt) >= start && timestamp(imprint.savedAt) <= now.getTime());
  const recentExperiments = life.tasks
    .filter((task) => task.source === "practice" && task.status === "done")
    .filter((task) => {
      const occurredAt = timestamp(task.reflectedAt ?? task.completedAt ?? task.updatedAt);
      return occurredAt >= start && occurredAt <= now.getTime();
    })
    .sort((left, right) => timestamp(right.reflectedAt ?? right.completedAt ?? right.updatedAt) - timestamp(left.reflectedAt ?? left.completedAt ?? left.updatedAt));

  if (recentImprints.length === 0 && recentExperiments.length === 0) return null;

  const task = recentExperiments[0] ?? null;
  const experiment = task ? { task, imprint: sourceForTask(task, imprints) } : null;
  const outcome = task?.practiceOutcome ?? null;
  const theme = dominantTheme(recentImprints);
  const headline = outcome === "helped"
    ? "Something worked."
    : outcome === "mixed"
      ? "Something is worth adjusting."
      : outcome === "not_for_me"
        ? "You found something not worth carrying."
        : theme ? `${theme} kept coming back.` : "You put an idea into real life.";
  const experimentSource = experiment?.imprint;
  const experimentSourceIsRecent = Boolean(experimentSource && recentImprints.some((imprint) => imprint.id === experimentSource.id));
  const experimentTheme = experimentSource?.themes.find((value) => value.trim())?.trim() ?? null;
  const normalizedTheme = theme?.toLocaleLowerCase("en-US") ?? null;
  const normalizedExperimentTheme = experimentTheme?.toLocaleLowerCase("en-US") ?? null;
  const story = task
    ? experimentSourceIsRecent && normalizedTheme
      ? `Your attention kept returning to ${normalizedTheme}. You put that attention into real life when you tried “${task.title}.”`
      : [
          experimentSource
            ? `An older idea${normalizedExperimentTheme ? ` about ${normalizedExperimentTheme}` : ""} moved into real life when you tried “${task.title}.”`
            : `In real life, you tried “${task.title}.”`,
          normalizedTheme && normalizedTheme !== normalizedExperimentTheme ? `Your newer saves kept circling ${normalizedTheme}.` : null,
        ].filter(Boolean).join(" ")
    : normalizedTheme ? `Your attention kept returning to ${normalizedTheme}.` : "You gave something your attention this week.";
  const sourceID = task?.sourceItemId ?? null;
  const alreadyContinued = task ? life.tasks.some((candidate) =>
    candidate.id !== task.id
    && candidate.source === "practice"
    && candidate.status !== "done"
    && candidate.status !== "removed"
    && (sourceID ? candidate.sourceItemId === sourceID : candidate.title === task.title)) : false;

  return {
    headline,
    story,
    reflection: task?.practiceReflection?.trim() || null,
    theme,
    experiment,
    outcome,
    canCarryForward: Boolean(task && (outcome === "helped" || outcome === "mixed") && !alreadyContinued),
  };
}
