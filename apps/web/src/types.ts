export type PrimaryPage = "home" | "plan" | "library" | "ask" | "you";

// Legacy section routes stay valid so bookmarks, installed-PWA shortcuts, and
// browser history continue to open the same data after the five-destination
// navigation redesign.
export type Page = PrimaryPage | "tasks" | "goals" | "calendar" | "health" | "money" | "files" | "evolution" | "settings";
export type ImprintStatus = "ready" | "processing" | "partial" | "failed";
export type ReturnCue = "stuck" | "focus" | "decision" | "date";

export interface Moment {
  time: string;
  seconds: number;
  title: string;
  note: string;
}

export interface Imprint {
  id: string;
  title: string;
  creator: string;
  sourceType: "YouTube" | "Article" | "Podcast" | "Thought";
  url: string;
  thumbnailUrl?: string;
  savedAt: string;
  lifePeriod: string;
  duration?: string;
  essence: string;
  summary: string;
  themes: string[];
  keyIdeas: string[];
  moments: Moment[];
  experiments: Array<{ text: string; duration?: string }>;
  principle?: string;
  hypothesis?: string;
  personalReaction?: string;
  noteText?: string;
  returnCue?: ReturnCue;
  returnAt?: string;
  uncertainty?: string;
  status: ImprintStatus;
  color: string;
  connectionIds: string[];
  analysisScope?: "transcript" | "caption" | "post" | "article" | "thought" | "pending";
  processingError?: string;
  principleId?: string;
  principleStatus?: "candidate" | "active" | "dismissed";
  syncState?: "synced" | "local";
}

export interface AskMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: { imprintId: string; label: string; seconds?: number; url?: string }[];
  grounded?: boolean;
  limitations?: string[];
  threadId?: string;
}

export interface DecisionBrief {
  decision: string;
  perspective: string;
  whatMatters: string;
  pullToward: string;
  pullAgainst: string;
  smallTest: string;
  nextQuestion: string;
  citations: { imprintId: string; label: string; url?: string }[];
  grounded: boolean;
  limitations: string[];
}
