import type { LifeSnapshot, LifeTask } from "../life/types";
import type { EvolutionOverview } from "../services/api";
import type { Imprint } from "../types";

export type CompassPrinciple = EvolutionOverview["principles"][number];
export type CompassReflection = EvolutionOverview["reflections"][number] & {
  imprint?: Imprint;
  statement: string;
};

export interface CompassExperiment {
  task: LifeTask;
  imprint?: Imprint;
}

export type CompassGuidanceKind = "keep" | "adjust" | "release";

export interface CompassGuidance {
  kind: CompassGuidanceKind;
  experiment: CompassExperiment;
  principle?: CompassPrinciple;
}

export interface PersonalCompass {
  guidance: CompassGuidance[];
  truths: CompassPrinciple[];
  suggestions: CompassPrinciple[];
  activeExperiments: CompassExperiment[];
  completedExperiments: CompassExperiment[];
  changes: CompassReflection[];
  tension?: EvolutionOverview["tensions"][number];
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const result = new Date(value).getTime();
  return Number.isNaN(result) ? 0 : result;
}

function sourceForTask(task: LifeTask, imprints: Imprint[]): Imprint | undefined {
  return imprints.find((imprint) => task.sourceItemId === imprint.id)
    ?? imprints.find((imprint) => task.notes.includes(imprint.url) || task.notes.includes(`“${imprint.title}”`));
}

function reflectionStatement(response: EvolutionOverview["reflections"][number]["response"]): string {
  switch (response) {
    case "changed_mind": return "You said this no longer feels the same.";
    case "no_longer_relevant": return "You decided this no longer belongs in your life now.";
    case "not_sure": return "You are leaving this open instead of forcing an answer.";
    case "still_true": return "You came back to this and confirmed it still feels true.";
  }
}

export function buildPersonalCompass(
  overview: EvolutionOverview,
  life: LifeSnapshot,
  imprints: Imprint[],
): PersonalCompass {
  const practiceTasks = life.tasks
    .filter((task) => task.source === "practice" && task.status !== "removed")
    .sort((left, right) => timestamp(right.completedAt ?? right.updatedAt) - timestamp(left.completedAt ?? left.updatedAt));
  const experiments = practiceTasks.map((task) => ({ task, imprint: sourceForTask(task, imprints) }));
  const completedExperiments = experiments.filter(({ task }) => task.status === "done");
  const imprintByID = new Map(imprints.map((imprint) => [imprint.id, imprint]));
  const seenGuidanceSources = new Set<string>();
  const guidance: CompassGuidance[] = [];

  for (const experiment of completedExperiments) {
    const outcome = experiment.task.practiceOutcome;
    if (!outcome) continue;
    const sourceID = experiment.imprint?.id ?? experiment.task.sourceItemId ?? experiment.task.id;
    if (seenGuidanceSources.has(sourceID)) continue;
    seenGuidanceSources.add(sourceID);
    guidance.push({
      kind: outcome === "helped" ? "keep" : outcome === "mixed" ? "adjust" : "release",
      experiment,
      principle: overview.principles.find((principle) => principle.itemId === sourceID),
    });
    if (guidance.length === 3) break;
  }

  return {
    guidance,
    truths: overview.principles.filter((principle) => principle.status === "active"),
    suggestions: overview.principles.filter((principle) => !principle.status || principle.status === "candidate").slice(0, 3),
    activeExperiments: experiments.filter(({ task }) => task.status !== "done"),
    completedExperiments,
    changes: overview.reflections
      .filter((reflection) => reflection.response !== "still_true")
      .map((reflection) => ({
        ...reflection,
        imprint: imprintByID.get(reflection.itemId),
        statement: reflectionStatement(reflection.response),
      })),
    tension: overview.tensions[0],
  };
}
