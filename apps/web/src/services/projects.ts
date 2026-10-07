import type { Goal, LifeTask } from "../life/types";

/**
 * Projects are goals on the server. Tasks file themselves into them, so nobody has to sort anything.
 * Mirrors docs/REDESIGN.md (Projects) and the iOS ProjectFiler.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "to", "of", "for", "in", "on", "at", "by", "with", "my", "me", "i", "it", "is", "be",
  "do", "get", "got", "go", "make", "need", "have", "gotta", "should", "want", "some", "this", "that", "up", "out",
  "about", "from", "task", "tasks", "thing", "things", "stuff", "work", "finish", "start",
]);

interface Kit { name: RegExp; words: RegExp }

const KITS: Kit[] = [
  {
    name: /\b(?:college|school|class|course|uni|university|wgu|study|degree|semester)\b/i,
    words: /\b(?:wgu|college|class|course|study|studying|exam|quiz|essay|paper|chapter|lecture|homework|assignment|mentor|professor|syllabus|rubric|midterm|semester|submit|submission|[a-z]\d{3,4})\b/i,
  },
  {
    name: /\b(?:app|ios|code|coding|dev|software|website|startup)\b/i,
    words: /\b(?:app|ios|swift|swiftui|xcode|testflight|app\s+store|bug|crash|build|deploy|release|ship|feature|screen|ui|ux|api|backend|frontend|code|refactor|commit|pr|merge|onboarding|paywall|simulator)\b/i,
  },
  {
    name: /\b(?:gym|fitness|workout|training|health)\b/i,
    words: /\b(?:gym|workout|lift|lifting|run|cardio|protein|stretch|mobility|legs|push|pull)\b/i,
  },
];

export function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word && !STOP_WORDS.has(word));
}

/** Projects that new tasks can go into, oldest first so the order never jumps around. */
export function activeProjects(goals: Goal[]): Goal[] {
  return goals.filter((goal) => goal.status === "active").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function score(title: string, titleWords: string[], project: Goal, tasks: LifeTask[]): number {
  let total = 0;
  const nameWords = words(project.title).filter((word) => word.length >= 3);
  if (nameWords.some((word) => titleWords.includes(word))) total += 3;
  const kit = KITS.find((candidate) => candidate.name.test(project.title));
  if (kit?.words.test(title)) total += 2;
  const earlier = tasks.filter((task) => task.goalId === project.id && task.status !== "removed").map((task) => new Set(words(task.title)));
  for (const word of new Set(titleWords)) total += Math.min(2, earlier.filter((set) => set.has(word)).length);
  return total;
}

/**
 * Where a new task belongs: the project in focus, else the clear best match by its words, else
 * nowhere (null). A tie or a weak match stays loose, because loose is never wrong.
 */
export function fileTask(title: string, goals: Goal[], tasks: LifeTask[], focusProjectId?: string | null): string | null {
  const projects = activeProjects(goals);
  if (focusProjectId && projects.some((project) => project.id === focusProjectId)) return focusProjectId;
  const titleWords = words(title);
  if (!titleWords.length) return null;
  const scored = projects.map((project) => ({ id: project.id, score: score(title, titleWords, project, tasks) })).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 2 || (second && second.score === best.score)) return null;
  return best.id;
}

/** Tapping the project chip: the next active project, then no project, and around again. */
export function nextProjectChoice(current: string | null, goals: Goal[]): string | null {
  const ids = activeProjects(goals).map((project) => project.id);
  if (!ids.length) return null;
  if (current === null) return ids[0];
  const index = ids.indexOf(current);
  return index < 0 || index === ids.length - 1 ? null : ids[index + 1];
}

/* ---------- Brain dump ---------- */

const FILLER = /^(?:ok|okay|so|also|and|then|plus|oh|um|uh|like)\b[\s,]*/i;
const LEAD_IN = /^(?:i\s+need\s+to|i\s+have\s+to|i'?ve\s+got\s+to|i\s+gotta|i\s+should|i\s+want\s+to|need\s+to|have\s+to|gotta|remember\s+to|don'?t\s+forget\s+to)\s+/i;
/** Words that only say when, how long, or how important. A piece made only of these isn't a task. */
const DETAIL_WORDS = new Set([
  "m", "min", "mins", "minute", "minutes", "h", "hr", "hrs", "hour", "hours", "half", "an", "a", "today", "tonight", "tomorrow",
  "tmrw", "tmr", "this", "weekend", "next", "week", "by", "on", "at", "every", "day", "days", "daily", "weekly", "monthly", "other",
  "urgent", "asap", "important", "once", "monday", "mon", "tuesday", "tue", "tues", "wednesday", "wed", "thursday", "thu", "thur",
  "thurs", "friday", "fri", "saturday", "sat", "sunday", "sun",
]);

function wordCount(text: string) { return text.split(/\s+/).filter(Boolean).length; }
function realWordCount(text: string) {
  return text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((word) => word && !/^\d+$/.test(word) && !DETAIL_WORDS.has(word)).length;
}

function clean(piece: string): string {
  let text = piece.trim();
  let previous = "";
  while (previous !== text) {
    previous = text;
    text = text.replace(FILLER, "").replace(LEAD_IN, "").trim();
  }
  return text.replace(/[.?\s]+$/, "").trim();
}

/**
 * Turns a messy paragraph into separate tasks. Returns the pieces when it found two or more,
 * otherwise an empty array: the text is one ordinary task.
 */
export function splitDump(text: string): string[] {
  let pieces = text.split(/\n|;|(?<=[.?])\s+/).map((piece) => piece.trim()).filter(Boolean);
  pieces = pieces.flatMap((piece) => {
    const parts = piece.split(",").map((part) => clean(part)).filter(Boolean);
    return parts.length > 1 && parts.every((part) => wordCount(part) >= 2) ? parts : [piece];
  });
  if (pieces.length >= 2) {
    pieces = pieces.flatMap((piece) => {
      const parts = clean(piece).split(/\s+(?:and\s+then|and|then)\s+/i).map((part) => clean(part));
      return parts.length > 1 && parts.every((part) => wordCount(part) >= 2) ? parts : [piece];
    });
  }
  const merged: string[] = [];
  for (const piece of pieces.map(clean).filter(Boolean)) {
    if (merged.length && realWordCount(piece) < 1) merged[merged.length - 1] = `${merged[merged.length - 1]} ${piece}`;
    else merged.push(piece);
  }
  return merged.length >= 2 ? merged : [];
}
