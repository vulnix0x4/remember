import type { Imprint } from "../types";

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|app|dev|me|tv|be|ly|so|ai|edu|gov)(?:\/\S*)?/i;

export type CaptureDraft = { kind: "link" | "thought"; draft: Imprint } | { kind: "error"; message: string };

/**
 * Turns one line from the Library add bar into something to save.
 * A line with a link becomes a link (any other words become your note); anything else is a thought.
 */
export function buildCaptureDraft(text: string, imprints: Imprint[], id: string = crypto.randomUUID()): CaptureDraft {
  const words = text.trim();
  if (!words) return { kind: "error", message: "Type a link or a thought." };
  const found = URL_PATTERN.exec(words);
  if (!found) {
    const firstLine = words.split(/\n+/).find(Boolean) ?? words;
    const title = firstLine.length > 96 ? `${firstLine.slice(0, 93).trimEnd()}…` : firstLine;
    return { kind: "thought", draft: {
      id, title, creator: "You", sourceType: "Thought", url: `remember://thought/${id}`, savedAt: "Just now", lifePeriod: "Current chapter",
      essence: "Remember is finding what this connects to.", summary: "Remember is connecting this thought to what you have saved and said before.",
      themes: [], keyIdeas: [], moments: [], experiments: [], noteText: words, status: "processing", color: "violet", connectionIds: [], analysisScope: "pending",
    } };
  }
  const raw = found[0].replace(/[),.;!?]+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw.replace(/^http:\/\//i, "https://") : `https://${raw}`);
    if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) throw new Error();
  } catch { return { kind: "error", message: "That link doesn’t look complete. Try pasting it again." }; }
  const url = parsed.toString();
  if (imprints.some((item) => item.url === url || item.url === raw)) return { kind: "error", message: "You already saved this. It’s in your library." };
  const note = words.replace(found[0], " ").replace(/\s+/g, " ").trim();
  const host = parsed.hostname.replace(/^www\./, "");
  const isYoutube = host.includes("youtube.com") || host.includes("youtu.be");
  const isTikTok = host === "tiktok.com" || host.endsWith(".tiktok.com");
  return { kind: "link", draft: {
    id, title: isYoutube ? "New YouTube save" : isTikTok ? "New TikTok save" : host, creator: isTikTok ? "TikTok" : parsed.hostname,
    sourceType: isYoutube ? "YouTube" : "Article", url, savedAt: "Just now", lifePeriod: "Current chapter",
    essence: note || "Saved safely. Details are on the way.", summary: "Waiting to process this saved item.",
    themes: [], keyIdeas: [], moments: [], experiments: [], personalReaction: note || undefined,
    status: "processing", color: "sage", connectionIds: [], analysisScope: "pending",
  } };
}
