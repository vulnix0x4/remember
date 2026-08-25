export type Page = "home" | "library" | "ask" | "evolution" | "settings";
export type ImprintStatus = "ready" | "processing" | "partial" | "failed";

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
  sourceType: "YouTube" | "Article" | "Podcast";
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
  principle?: string;
  hypothesis?: string;
  personalReaction?: string;
  uncertainty?: string;
  status: ImprintStatus;
  color: string;
  connectionIds: string[];
  analysisScope?: "transcript" | "caption" | "post" | "article" | "pending";
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
