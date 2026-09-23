import type { LifeArea } from "../life/types";
import type { Imprint } from "../types";

export interface CarryForwardTask {
  title: string;
  firstStep: string;
  notes: string;
  area: LifeArea;
  durationMinutes: number;
  priority: "normal";
  status: "queued";
  source: "practice";
  sourceItemId: string;
}

const areaSignals: Array<{ area: LifeArea; words: string[] }> = [
  { area: "health", words: ["health", "sleep", "recovery", "fitness", "body", "exercise", "nutrition"] },
  { area: "work", words: ["work", "career", "creative", "building", "business", "craft", "focus"] },
  { area: "relationships", words: ["relationship", "relationships", "love", "friendship", "family", "grief"] },
  { area: "money", words: ["money", "finance", "financial", "spending", "saving", "wealth"] },
  { area: "environment", words: ["environment", "home", "space", "place"] },
  { area: "growth", words: ["growth", "learning", "identity", "confidence", "mindset", "attention"] },
];

export function carryForwardArea(imprint: Pick<Imprint, "themes" | "title" | "essence">): LifeArea {
  return lifeAreaForMaterial(`${imprint.themes.join(" ")} ${imprint.title} ${imprint.essence}`);
}

export function lifeAreaForMaterial(value: string): LifeArea {
  const material = value.toLocaleLowerCase("en-US");
  const tokens = new Set(material.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return areaSignals.find(({ words }) => words.some((word) => tokens.has(word)))?.area ?? "direction";
}

function conciseTaskTitle(experiment: string) {
  const clean = experiment.trim().replace(/[.!?]+$/, "");
  if (clean.length <= 86) return clean;
  const shortened = clean.slice(0, 83);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > 52 ? boundary : 83).trim()}…`;
}

export function carryForwardTask(imprint: Imprint, experiment: Imprint["experiments"][number]): CarryForwardTask {
  const timeframe = experiment.duration?.trim();
  return {
    title: conciseTaskTitle(experiment.text),
    firstStep: experiment.text,
    notes: [
      `Carried forward from “${imprint.title}”.`,
      timeframe ? `Suggested timeframe: ${timeframe}.` : "",
      imprint.url,
    ].filter(Boolean).join("\n"),
    area: carryForwardArea(imprint),
    durationMinutes: 15,
    priority: "normal",
    status: "queued",
    source: "practice",
    sourceItemId: imprint.id,
  };
}
