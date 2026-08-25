import { imprints as fixtures } from "../fixtures";
import type { AskMessage, Imprint } from "../types";

const STORAGE_KEY = "remember-imprints-v2";
const LEGACY_STORAGE_KEY = "remember-imprints-v1";
const TOKEN_KEY = "remember-api-token";
const configuredApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
const apiBase = configuredApiBase || (import.meta.env.PROD ? window.location.origin : undefined);
const previewToken = import.meta.env.VITE_API_TOKEN;
const configuredAuthMode = import.meta.env.VITE_AUTH_MODE;
const authMode: "access" | "password" | "token" = configuredAuthMode === "access" || configuredAuthMode === "password"
  ? configuredAuthMode
  : import.meta.env.PROD ? "password" : "token";
const LOCAL_DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEVELOPMENT_ITEM_IDS = new Set(fixtures.map((item) => item.id));
const DEVELOPMENT_URLS = new Set([
  ...fixtures.map((item) => item.url),
  "https://www.youtube.com/watch?v=jNQXAC9IVRw",
]);

export function getApiToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || previewToken || ""; } catch { return previewToken || ""; }
}

export function setApiToken(value: string): void {
  if (value.trim()) localStorage.setItem(TOKEN_KEY, value.trim());
  else localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(baseUrl: string, token = getApiToken()): Record<string, string> {
  const host = new URL(baseUrl).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return { "x-dev-user-id": LOCAL_DEV_USER_ID };
  return authMode === "token" && token ? { authorization: `Bearer ${token}` } : {};
}

export interface AppSession {
  id: string;
  mode: "access" | "development" | "password" | "token";
  email: string | null;
}

export async function loadSession(baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<AppSession | null> {
  if (!baseUrl || authMode === "token") return null;
  try {
    const response = await fetcher(`${baseUrl}/api/session`, { headers: authHeaders(baseUrl), credentials: "include" });
    if (!response.ok) return null;
    const payload = await response.json() as { user?: AppSession };
    return payload.user ?? null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<AppSession> {
  if (!baseUrl) throw new Error("The Remember service is unavailable.");
  const response = await fetcher(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || "Sign in failed. Please try again.");
  }
  const payload = await response.json() as { user: AppSession };
  return payload.user;
}

export async function logout(baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<void> {
  if (!baseUrl) return;
  await fetcher(`${baseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
}

export interface ApiAnalysis {
  essence: string;
  summary: string;
  keyIdeas: Array<{ text: string; explanation?: string }>;
  keyMoments: Array<{ seconds: number; label: string; context?: string; sourceVerified?: boolean }>;
  themes: string[];
  candidatePrinciples: Array<{ text: string; rationale?: string }>;
  personalRelevanceHypotheses: Array<{ text: string; confidence?: number; label?: "hypothesis" }>;
  uncertainties: Array<{ text: string; field?: string }>;
}

export interface ApiItem {
  id: string;
  sourceType: "youtube" | "web";
  originalUrl: string;
  canonicalUrl: string;
  externalId?: string | null;
  title: string | null;
  author?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  status: "pending" | "processing" | "ready" | "partial" | "failed";
  savedAt: string;
  personalReaction?: string | null;
  processingError?: string | null;
  analysisScope?: "transcript" | "caption" | "post" | "article" | "pending";
  analysis: ApiAnalysis | null;
}

interface ApiConnection {
  fromItemId: string;
  toItemId: string;
}

interface ApiPrinciple {
  id: string;
  status: "candidate" | "active" | "dismissed" | "retired";
}

function hostname(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "Saved source"; }
}

function formatDuration(seconds?: number | null): string | undefined {
  if (!seconds) return undefined;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function formatMoment(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function statusForUi(status: ApiItem["status"]): Imprint["status"] {
  if (status === "pending" || status === "processing") return "processing";
  return status;
}

function failedAnalysisSummary(): string {
  return "Analysis paused before it could finish. Your original source is safe; retry when you are ready.";
}

export function mapApiItem(item: ApiItem): Imprint {
  const analysis = item.analysis;
  const url = item.canonicalUrl || item.originalUrl;
  const host = hostname(url);
  const isTikTok = host === "tiktok.com" || host.endsWith(".tiktok.com");
  const isX = host === "x.com" || host === "twitter.com";
  const sourceType: Imprint["sourceType"] = item.sourceType === "youtube" ? "YouTube" : "Article";
  const analysisScope: Imprint["analysisScope"] = item.analysisScope ?? (item.status === "pending" || item.status === "processing"
    ? "pending"
    : item.sourceType === "youtube"
      ? "transcript"
      : isTikTok
        ? "caption"
        : isX
          ? "post"
          : "article");
  const savedDate = new Date(item.savedAt);
  const hasValidSavedDate = !Number.isNaN(savedDate.getTime());
  return {
    id: item.id,
    title: item.title || analysis?.essence || hostname(url),
    creator: item.author || hostname(url),
    sourceType,
    url,
    thumbnailUrl: item.thumbnailUrl ?? undefined,
    savedAt: formatSavedAt(item.savedAt),
    lifePeriod: hasValidSavedDate ? `Saved in ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(savedDate)}` : "Saved recently",
    duration: formatDuration(item.durationSeconds),
    essence: analysis?.essence || (item.status === "failed" ? "This source could not be analyzed yet." : "Understanding what made this worth keeping."),
    summary: analysis?.summary || (item.status === "failed" ? failedAnalysisSummary() : "This source is queued for analysis."),
    themes: analysis?.themes ?? [],
    keyIdeas: analysis?.keyIdeas.map((idea) => idea.text) ?? [],
    moments: analysis?.keyMoments.map((moment) => ({ time: formatMoment(moment.seconds), seconds: moment.seconds, title: moment.label, note: moment.context || "Open this moment in the source." })) ?? [],
    principle: analysis?.candidatePrinciples[0]?.text,
    hypothesis: analysis?.personalRelevanceHypotheses[0]?.text,
    personalReaction: item.personalReaction ?? undefined,
    uncertainty: analysis?.uncertainties[0]?.text,
    status: statusForUi(item.status),
    color: item.sourceType === "youtube" ? "sage" : "graphite",
    connectionIds: [],
    analysisScope,
    processingError: item.processingError ?? undefined,
    syncState: "synced",
  };
}

function isStoredImprint(value: unknown): value is Imprint {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Imprint>;
  return typeof item.id === "string" && typeof item.url === "string" && typeof item.title === "string" && typeof item.creator === "string";
}

function isDevelopmentItem(item: Imprint): boolean {
  return DEVELOPMENT_ITEM_IDS.has(item.id) || DEVELOPMENT_URLS.has(item.url);
}

function readStored(key: string): Imprint[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isStoredImprint).filter((item) => !isDevelopmentItem(item)) : [];
  } catch {
    return [];
  }
}

function uniqueByUrl(items: Imprint[]): Imprint[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function readLocal(baseUrl = apiBase): Imprint[] {
  const saved = uniqueByUrl([...readStored(STORAGE_KEY), ...readStored(LEGACY_STORAGE_KEY)]);
  return saved.length ? saved : baseUrl ? [] : fixtures;
}

function writeLocal(imprints: Imprint[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueByUrl(imprints.filter((item) => !isDevelopmentItem(item)))));
}

function writeLegacy(imprints: Imprint[]) {
  if (imprints.length) localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(imprints));
  else localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function normalizeItems(payload: unknown): Imprint[] | null {
  if (Array.isArray(payload)) return (payload as ApiItem[]).map(mapApiItem);
  if (payload && typeof payload === "object" && "items" in payload && Array.isArray((payload as { items: unknown }).items)) {
    return (payload as { items: ApiItem[] }).items.map(mapApiItem);
  }
  return null;
}

export async function loadImprints(signal?: AbortSignal, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<{ items: Imprint[]; source: "api" | "local" }> {
  if (!baseUrl) return { items: readLocal(baseUrl), source: "local" };
  const recoverable = uniqueByUrl([...readStored(LEGACY_STORAGE_KEY), ...readStored(STORAGE_KEY)]);
  try {
    const remoteItems: Imprint[] = [];
    let cursor: string | null = null;
    const seenCursors = new Set<string>();
    do {
      const endpoint = new URL(`${baseUrl}/api/items`);
      endpoint.searchParams.set("limit", "100");
      if (cursor) endpoint.searchParams.set("cursor", cursor);
      const response = await fetcher(endpoint, { headers: authHeaders(baseUrl), credentials: "include", signal });
      if (!response.ok) throw new Error(`Library request failed with ${response.status}`);
      const payload = await response.json() as { items?: ApiItem[]; nextCursor?: string | null };
      if (!Array.isArray(payload.items)) throw new Error("Library response did not contain items");
      remoteItems.push(...payload.items.map(mapApiItem));
      const nextCursor = payload.nextCursor ?? null;
      if (nextCursor && seenCursors.has(nextCursor)) throw new Error("Library pagination repeated a cursor");
      if (nextCursor) seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (cursor);
    const recovered: Imprint[] = [];
    const remaining: Imprint[] = [];
    for (const legacyItem of recoverable) {
      if (remoteItems.some((item) => item.url === legacyItem.url)) continue;
      try {
        const result = await saveImprintToApi(legacyItem, baseUrl, fetcher);
        recovered.push(result.item);
      } catch {
        remaining.push(legacyItem);
      }
    }
    const items = uniqueByUrl([...remoteItems, ...recovered, ...remaining]).filter((item) => !isDevelopmentItem(item));
    writeLegacy(remaining);
    writeLocal(items);
    return { items, source: "api" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { items: readLocal(baseUrl), source: "local" };
  }
}

export async function loadImprint(id: string, signal?: AbortSignal, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<{ item: Imprint | null; source: "api" | "local" }> {
  if (!baseUrl) return { item: readLocal().find((item) => item.id === id) ?? null, source: "local" };
  try {
    const response = await fetcher(`${baseUrl}/api/items/${encodeURIComponent(id)}`, { headers: authHeaders(baseUrl), credentials: "include", signal });
    if (!response.ok) throw new Error(`Imprint request failed with ${response.status}`);
    const payload = await response.json() as { item?: ApiItem; connections?: ApiConnection[]; principles?: ApiPrinciple[] };
    if (!payload.item) return { item: null, source: "api" };
    const mapped = mapApiItem(payload.item);
    mapped.connectionIds = (payload.connections ?? []).map((connection) => connection.fromItemId === id ? connection.toItemId : connection.fromItemId);
    const principle = payload.principles?.[0];
    if (principle && principle.status !== "retired") {
      mapped.principleId = principle.id;
      mapped.principleStatus = principle.status;
    }
    return { item: mapped, source: "api" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { item: readLocal().find((item) => item.id === id) ?? null, source: "local" };
  }
}

export async function searchImprints(query: string, localItems: Imprint[], signal?: AbortSignal, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<{ items: Imprint[]; source: "api" | "local" }> {
  const local = () => localItems.filter((item) => `${item.title} ${item.creator} ${item.essence} ${item.summary} ${item.themes.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  if (!baseUrl || !query.trim()) return { items: local(), source: "local" };
  try {
    const endpoint = new URL(`${baseUrl}/api/search`);
    endpoint.searchParams.set("q", query.trim());
    endpoint.searchParams.set("limit", "30");
    const response = await fetcher(endpoint, { headers: authHeaders(baseUrl), credentials: "include", signal });
    if (!response.ok) throw new Error(`Search request failed with ${response.status}`);
    const items = normalizeItems(await response.json());
    if (!items) throw new Error("Search response did not contain items");
    return { items, source: "api" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { items: local(), source: "local" };
  }
}

export async function askLibrary(question: string, signal?: AbortSignal, baseUrl = apiBase, fetcher: typeof fetch = fetch, threadId?: string): Promise<AskMessage | null> {
  if (!baseUrl) return null;
  try {
    const response = await fetcher(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ question, ...(threadId ? { threadId } : {}) }),
      signal,
    });
    if (!response.ok) throw new Error(`Ask request failed with ${response.status}`);
    const payload = await response.json() as { threadId?: string; answer: string; grounded: boolean; limitations?: string[]; citations?: Array<{ itemId: string; title: string; timestampSeconds?: number; url?: string }> };
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      text: payload.answer,
      grounded: payload.grounded,
      limitations: payload.limitations ?? [],
      citations: payload.citations?.map((citation) => ({ imprintId: citation.itemId, label: citation.title, seconds: citation.timestampSeconds, url: citation.url })),
      threadId: payload.threadId,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  }
}

export interface ResurfacedMemory {
  eventId: string;
  itemId: string;
  title?: string | null;
  canonicalUrl: string;
  essence?: string | null;
  reason: string;
  surfacedAt: string;
}

export interface EvolutionOverview {
  themes: Array<{ name: string; count: number; lastSeenAt?: string }>;
  principles: Array<{ id: string; itemId: string; text: string; rationale?: string; status?: string; createdAt?: string }>;
  tensions: Array<{ id: string; fromItemId: string; toItemId: string; explanation: string; confidence?: number }>;
  timeline: Array<{ month: string; theme: string; count: number }>;
}

export async function loadEvolution(signal?: AbortSignal, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<EvolutionOverview | null> {
  if (!baseUrl) return null;
  try {
    const response = await fetcher(`${baseUrl}/api/evolution`, { headers: authHeaders(baseUrl), credentials: "include", signal });
    if (!response.ok) throw new Error(`Evolution request failed with ${response.status}`);
    return await response.json() as EvolutionOverview;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  }
}

export async function loadResurfacedMemory(signal?: AbortSignal, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<ResurfacedMemory | null> {
  if (!baseUrl) return null;
  try {
    const response = await fetcher(`${baseUrl}/api/resurfacing/today`, { headers: authHeaders(baseUrl), credentials: "include", signal });
    if (!response.ok) throw new Error(`Resurfacing request failed with ${response.status}`);
    const payload = await response.json() as { memory?: ResurfacedMemory | null };
    return payload.memory ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  }
}

export async function respondToResurfacing(eventId: string, responseValue: "still_true" | "changed_mind" | "not_sure" | "no_longer_relevant", baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!baseUrl) return false;
  try {
    const response = await fetcher(`${baseUrl}/api/resurfacing/${encodeURIComponent(eventId)}/respond`, {
      method: "POST",
      headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ response: responseValue }),
    });
    return response.ok;
  } catch { return false; }
}

export async function saveImprint(imprint: Imprint): Promise<{ item: Imprint; synced: boolean; deduplicated: boolean }> {
  const local = readLocal();
  if (!local.some((item) => item.url === imprint.url)) writeLocal([imprint, ...local]);
  if (!apiBase) return { item: { ...imprint, syncState: "local" }, synced: false, deduplicated: false };
  try { return await saveImprintToApi(imprint, apiBase);
  } catch {
    return { item: { ...imprint, syncState: "local" }, synced: false, deduplicated: false };
  }
}

async function clientYouTubeTranscript(urlValue: string, fetcher: typeof fetch): Promise<string | undefined> {
  try {
    const url = new URL(urlValue);
    const videoId = url.hostname === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return undefined;
    const response = await fetcher(`https://youtube-transcript.ai/transcript/${videoId}.txt`, {
      headers: { accept: "text/markdown" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return undefined;
    const document = await response.text();
    if (document.length > 512 * 1_024) return undefined;
    const section = document.split("## Transcript")[1]?.split("\n---")[0]?.trim() ?? "";
    return /^\[\d{1,2}:\d{2}(?::\d{2})?\]/m.test(section) ? section.slice(0, 160_000) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveImprintToApi(imprint: Imprint, baseUrl: string, fetcher: typeof fetch = fetch): Promise<{ item: Imprint; synced: true; deduplicated: boolean }> {
    const sourceText = imprint.sourceType === "YouTube" ? await clientYouTubeTranscript(imprint.url, fetcher) : undefined;
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/items`, {
      method: "POST",
      headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url: imprint.url, ...(imprint.personalReaction ? { personalReaction: imprint.personalReaction } : {}), ...(sourceText ? { sourceText } : {}) }),
    });
    if (!response.ok) throw new Error(`Capture request failed with ${response.status}`);
    const payload = await response.json() as { item?: ApiItem; deduplicated?: boolean; duplicate?: boolean };
    return { item: payload.item ? mapApiItem(payload.item) : imprint, synced: true, deduplicated: payload.deduplicated ?? payload.duplicate ?? false };
}

export async function retryImprint(item: Imprint, baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<Imprint> {
  if (!baseUrl) throw new Error("Reconnect before retrying analysis.");
  const sourceText = item.sourceType === "YouTube" ? await clientYouTubeTranscript(item.url, fetcher) : undefined;
  const response = await fetcher(`${baseUrl}/api/items/${encodeURIComponent(item.id)}/retry`, {
    method: "POST",
    headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(sourceText ? { sourceText } : {}),
  });
  if (!response.ok) throw new Error("Analysis could not be restarted. Please try again.");
  const payload = await response.json() as { item?: ApiItem };
  if (!payload.item) throw new Error("The retry response was incomplete.");
  return mapApiItem(payload.item);
}

export async function updatePrinciple(principleId: string, status: "candidate" | "active" | "dismissed", baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<void> {
  if (!baseUrl) throw new Error("Reconnect before updating this principle.");
  const response = await fetcher(`${baseUrl}/api/principles/${encodeURIComponent(principleId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("This principle could not be updated.");
}

export async function downloadLibraryExport(format: "json" | "markdown", baseUrl = apiBase, fetcher: typeof fetch = fetch): Promise<Blob> {
  if (!baseUrl) throw new Error("The export service is unavailable.");
  const created = await fetcher(`${baseUrl}/api/exports`, {
    method: "POST",
    headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ format }),
  });
  if (!created.ok) throw new Error("Your export could not be prepared.");
  const payload = await created.json() as { downloadUrl?: string };
  if (!payload.downloadUrl) throw new Error("The export response was incomplete.");
  const downloaded = await fetcher(new URL(payload.downloadUrl, baseUrl), {
    headers: authHeaders(baseUrl),
    credentials: "include",
  });
  if (!downloaded.ok) throw new Error("Your export could not be downloaded.");
  return downloaded.blob();
}

export const apiConfig = { baseUrl: apiBase ?? null, authMode, storageKey: STORAGE_KEY, legacyStorageKey: LEGACY_STORAGE_KEY, tokenStorageKey: TOKEN_KEY };
