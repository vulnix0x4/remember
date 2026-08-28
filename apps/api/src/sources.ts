import { z } from "zod";
import { canonicalizeSourceUrl, type CanonicalSourceUrl, type SourceType } from "@remember/domain";
import type { SourceMetadata } from "./types";

export interface SourceAdapter {
  readonly type: SourceType;
  fetchMetadata(source: CanonicalSourceUrl): Promise<SourceMetadata>;
}

const youtubeOEmbedSchema = z.object({
  title: z.string().trim().max(500),
  author_name: z.string().trim().max(300),
  thumbnail_url: z.url(),
});
const xOEmbedSchema = z.object({
  url: z.url(),
  author_name: z.string().trim().min(1).max(300),
  author_url: z.url(),
  html: z.string().min(1).max(100_000),
  provider_name: z.literal("X"),
});
const xSyndicationSchema = z.object({
  text: z.string().max(100_000).optional(),
  video: z.object({
    poster: z.url(),
    durationMs: z.number().nonnegative().optional(),
  }).optional(),
});
const tikTokOEmbedSchema = z.object({
  type: z.literal("video"),
  title: z.string().trim().max(2_000),
  author_name: z.string().trim().min(1).max(300),
  author_url: z.url(),
  html: z.string().min(1).max(150_000),
  thumbnail_url: z.url(),
  provider_name: z.literal("TikTok"),
});
const captionTracksSchema = z.array(z.object({
  baseUrl: z.url(),
  languageCode: z.string().min(1),
})).min(1);
const captionsSchema = z.object({
  events: z.array(z.object({
    tStartMs: z.number().nonnegative().optional(),
    segs: z.array(z.object({ utf8: z.string() })).optional(),
  })).default([]),
});

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new Error("Source response exceeded the allowed size.");
  if (!response.body) throw new Error("Source response had no body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) throw new Error("Source response exceeded the allowed size.");
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readBoundedText(response, maxBytes)) as unknown;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

function plainTextFromHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<(script|style|noscript|svg|template|form|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote|article|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) {
      const value = pattern.exec(html)?.[1];
      if (value) return decodeHtml(value).replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

function htmlElement(html: string, element: "article" | "main" | "body" | "title"): string | null {
  return new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\/${element}>`, "i").exec(html)?.[1] ?? null;
}

function isXHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "x.com" || host === "www.x.com" || host === "twitter.com" || host === "www.twitter.com" || host === "mobile.twitter.com";
}

function isTikTokHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "tiktok.com" || host.endsWith(".tiktok.com");
}

function xPostID(url: URL): string | null {
  return /\/status\/(\d+)/i.exec(url.pathname)?.[1] ?? null;
}

function xSyndicationToken(postID: string): string {
  return ((Number(postID) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

async function fetchXMedia(url: URL, fetcher: typeof fetch): Promise<z.infer<typeof xSyndicationSchema> | null> {
  const postID = xPostID(url);
  if (!postID) return null;
  const endpoint = new URL("https://cdn.syndication.twimg.com/tweet-result");
  endpoint.searchParams.set("id", postID);
  endpoint.searchParams.set("lang", "en");
  endpoint.searchParams.set("token", xSyndicationToken(postID));
  try {
    const response = await fetcher(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "Remember/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const result = xSyndicationSchema.safeParse(await readBoundedJson(response, 256 * 1_024));
    if (!result.success) return null;
    const poster = result.data.video?.poster ? new URL(result.data.video.poster) : null;
    if (poster && (poster.protocol !== "https:" || poster.hostname !== "pbs.twimg.com")) return { ...result.data, video: undefined };
    return result.data;
  } catch {
    return null;
  }
}

function safeFetchUrl(value: string | URL): URL {
  const url = new URL(value);
  const checked = new URL(canonicalizeSourceUrl(url.toString()).canonicalUrl);
  if (checked.port && checked.port !== "80" && checked.port !== "443") throw new Error("Source URLs may only use standard web ports.");
  return checked;
}

async function fetchPublicHtml(initialUrl: URL, fetcher: typeof fetch): Promise<{ html: string; finalUrl: URL }> {
  let current = safeFetchUrl(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetcher(current, {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
        "User-Agent": "Remember/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("Source redirected too many times.");
      current = safeFetchUrl(new URL(location, current));
      continue;
    }
    if (!response.ok) throw new Error(`Source request failed (${response.status}).`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      throw new Error("This link did not return a readable web page.");
    }
    return { html: await readBoundedText(response, 2 * 1_024 * 1_024), finalUrl: current };
  }
  throw new Error("Source could not be reached.");
}

function jsonArrayAfter(source: string, marker: string): unknown {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error("No caption tracks were published for this video.");
  const start = source.indexOf("[", markerIndex + marker.length);
  if (start < 0) throw new Error("Caption track data was malformed.");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1)) as unknown;
    }
  }
  throw new Error("Caption track data was incomplete.");
}

function timestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeYouTubeTranscript(transcript: string): string {
  const cleanLine = (line: string): string => {
    const match = /^(\[[^\]]+\]\s+)(.*)$/.exec(line);
    if (!match) return line;
    const prefix = match[1] ?? "";
    const tokens = (match[2] ?? "").trim().split(/\s+/).filter(Boolean);
    const output: string[] = [];
    for (let index = 0; index < tokens.length;) {
      let collapsed = false;
      const maximumWindow = Math.min(80, Math.floor((tokens.length - index) / 2));
      for (let window = maximumWindow; window >= 1; window -= 1) {
        let repeats = 1;
        while (
          index + (repeats + 1) * window <= tokens.length
          && tokens.slice(index, index + window).every((token, offset) => token === tokens[index + repeats * window + offset])
        ) repeats += 1;
        const requiredRepeats = window <= 2 ? 3 : 2;
        if (repeats < requiredRepeats) continue;
        output.push(...tokens.slice(index, index + window));
        index += window * repeats;
        collapsed = true;
        break;
      }
      if (!collapsed) {
        const token = tokens[index];
        if (token) output.push(token);
        index += 1;
      }
    }
    return `${prefix}${output.join(" ")}`;
  };
  return transcript.split("\n").map(cleanLine).join("\n").trim().slice(0, 160_000);
}

async function fetchNativeYouTubeTranscript(source: CanonicalSourceUrl, fetcher: typeof fetch): Promise<string> {
  const watch = await fetcher(source.canonicalUrl, {
    headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (compatible; Remember/1.0)" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!watch.ok) throw new Error(`YouTube watch-page request failed (${watch.status}).`);
  const html = await readBoundedText(watch, 3 * 1_024 * 1_024);
  const tracks = captionTracksSchema.parse(jsonArrayAfter(html, '"captionTracks":'));
  const track = tracks.find((candidate) => candidate.languageCode.toLocaleLowerCase("en-US").startsWith("en")) ?? tracks[0];
  if (!track) throw new Error("No usable caption track was published for this video.");
  const captionsUrl = new URL(track.baseUrl);
  if (captionsUrl.protocol !== "https:" || !["www.youtube.com", "youtube.com"].includes(captionsUrl.hostname)) {
    throw new Error("YouTube returned an untrusted captions URL.");
  }
  captionsUrl.searchParams.set("fmt", "json3");
  const captionsResponse = await fetcher(captionsUrl, {
    headers: { Accept: "application/json", "User-Agent": "Remember/1.0" },
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if (!captionsResponse.ok) throw new Error(`YouTube captions request failed (${captionsResponse.status}).`);
  const captions = captionsSchema.parse(await readBoundedJson(captionsResponse, 2 * 1_024 * 1_024));
  const lines = captions.events.flatMap((event) => {
    const text = event.segs?.map((segment) => segment.utf8).join("").replace(/\s+/g, " ").trim();
    return text ? [`[${timestamp(event.tStartMs ?? 0)}] ${text}`] : [];
  });
  if (!lines.length) throw new Error("YouTube captions were empty.");
  return lines.join("\n").slice(0, 160_000);
}

async function fetchYouTubeTranscript(source: CanonicalSourceUrl, fetcher: typeof fetch): Promise<{ text: string; source: string }> {
  const native = fetchNativeYouTubeTranscript(source, fetcher).then((text) => ({ text, source: "youtube_captions" }));
  const fallback = async (): Promise<{ text: string; source: string }> => {
    if (!source.externalId || !/^[A-Za-z0-9_-]{11}$/.test(source.externalId)) {
      throw new Error("YouTube video ID was unavailable.");
    }
    const endpoint = new URL(`https://youtube-transcript.ai/transcript/${source.externalId}.txt`);
    const response = await fetcher(endpoint, {
      headers: { Accept: "text/markdown", "User-Agent": "Remember/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(50_000),
    });
    if (!response.ok) throw new Error(`Transcript fallback request failed (${response.status}).`);
    const document = await readBoundedText(response, 512 * 1_024);
    const section = document.split("## Transcript")[1]?.split("\n---")[0]?.trim() ?? "";
    if (!/^\[\d{1,2}:\d{2}(?::\d{2})?\]/m.test(section)) {
      throw new Error("Transcript fallback returned no timestamped captions.");
    }
    return { text: normalizeYouTubeTranscript(section), source: "youtube-transcript.ai" };
  };

  try {
    return await Promise.any([native, fallback()]);
  } catch (error) {
    const messages = error instanceof AggregateError
      ? error.errors.map((reason) => reason instanceof Error ? reason.message : String(reason))
      : [error instanceof Error ? error.message : String(error)];
    if (messages.some((message) => /timeout|timed out|aborted/i.test(message))) {
      throw new Error("YouTube transcript retrieval timed out.");
    }
    throw new Error("This YouTube video has no readable captions.");
  }
}

export class YouTubeSourceAdapter implements SourceAdapter {
  readonly type = "youtube" as const;

  constructor(
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
    private readonly includeTranscript = true,
  ) {}

  async fetchMetadata(source: CanonicalSourceUrl): Promise<SourceMetadata> {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", source.canonicalUrl);
    endpoint.searchParams.set("format", "json");
    const [response, transcriptResult] = await Promise.all([
      this.fetcher(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "Remember/0.1 (+https://example.invalid)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      }),
      this.includeTranscript
        ? fetchYouTubeTranscript(source, this.fetcher)
          .then((transcript) => ({ transcript, error: null }))
          .catch((error: unknown) => ({ transcript: null, error: error instanceof Error ? error.message : "YouTube transcript retrieval failed." }))
        : Promise.resolve({ transcript: null, error: null }),
    ]);
    if (!response.ok) throw new Error(`YouTube metadata request failed (${response.status}).`);
    const metadata = youtubeOEmbedSchema.parse(await readBoundedJson(response, 64 * 1_024));
    const transcript = transcriptResult.transcript;
    return {
      title: metadata.title,
      author: metadata.author_name,
      thumbnailUrl: metadata.thumbnail_url,
      durationSeconds: null,
      transcript: transcript?.text ?? null,
      providerMetadata: {
        metadataSource: "youtube_oembed",
        ...(transcript ? { transcriptSource: transcript.source, transcript: transcript.text } : {}),
        ...(transcriptResult.error ? { transcriptError: transcriptResult.error } : {}),
      },
    };
  }
}

export class WebSourceAdapter implements SourceAdapter {
  readonly type = "web" as const;

  constructor(private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async fetchMetadata(source: CanonicalSourceUrl): Promise<SourceMetadata> {
    const sourceUrl = safeFetchUrl(source.canonicalUrl);
    if (isTikTokHost(sourceUrl.hostname)) {
      const endpoint = new URL("https://www.tiktok.com/oembed");
      endpoint.searchParams.set("url", sourceUrl.toString());
      const response = await this.fetcher(endpoint, {
        headers: { Accept: "application/json", "User-Agent": "Remember/1.0" },
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`TikTok post request failed (${response.status}). The post may be private or unavailable.`);
      const post = tikTokOEmbedSchema.parse(await readBoundedJson(response, 192 * 1_024));
      const caption = post.title.trim() || plainTextFromHtml(post.html).slice(0, 2_000);
      if (!caption) throw new Error("TikTok returned no public caption for this post.");
      const sourceText = [
        `TikTok creator: ${post.author_name}`,
        `TikTok caption: ${caption}`,
      ].join("\n");
      return {
        title: caption.slice(0, 500),
        author: post.author_name,
        thumbnailUrl: post.thumbnail_url,
        durationSeconds: null,
        transcript: sourceText,
        providerMetadata: {
          metadataSource: "tiktok_oembed",
          contentSource: "tiktok_public_caption",
          transcript: sourceText,
        },
      };
    }
    if (isXHost(sourceUrl.hostname)) {
      const endpoint = new URL("https://publish.x.com/oembed");
      endpoint.searchParams.set("url", sourceUrl.toString());
      endpoint.searchParams.set("omit_script", "true");
      endpoint.searchParams.set("dnt", "true");
      const [response, media] = await Promise.all([
        this.fetcher(endpoint, {
          headers: { Accept: "application/json", "User-Agent": "Remember/1.0" },
          redirect: "manual",
          signal: AbortSignal.timeout(12_000),
        }),
        fetchXMedia(sourceUrl, this.fetcher),
      ]);
      if (!response.ok) throw new Error(`X post request failed (${response.status}). The post may be private or deleted.`);
      const post = xOEmbedSchema.parse(await readBoundedJson(response, 128 * 1_024));
      const text = plainTextFromHtml(post.html).slice(0, 160_000);
      if (!text) throw new Error("X returned no readable text for this post.");
      const handle = new URL(post.author_url).pathname.split("/").filter(Boolean)[0];
      const postTitle = media?.text?.split("\n").map((line) => line.trim()).find(Boolean)?.slice(0, 180);
      return {
        title: postTitle || `${handle ? `@${handle}` : post.author_name} on X`,
        author: post.author_name,
        thumbnailUrl: media?.video?.poster ?? null,
        durationSeconds: media?.video?.durationMs ? Math.round(media.video.durationMs / 1_000) : null,
        transcript: text,
        providerMetadata: { metadataSource: "x_oembed", contentSource: "x_oembed", ...(media ? { mediaSource: "x_syndication" } : {}), transcript: text },
      };
    }

    const { html, finalUrl } = await fetchPublicHtml(sourceUrl, this.fetcher);
    const preferredContent = htmlElement(html, "article") ?? htmlElement(html, "main") ?? htmlElement(html, "body") ?? html;
    const text = plainTextFromHtml(preferredContent).slice(0, 160_000);
    if (!text) throw new Error("This page did not contain readable text.");
    const title = metaContent(html, ["og:title", "twitter:title"]) ?? (plainTextFromHtml(htmlElement(html, "title") ?? "") || null);
    const author = metaContent(html, ["author", "article:author", "og:site_name"]);
    const thumbnailUrl = metaContent(html, ["og:image", "twitter:image"]);
    return {
      title: title?.slice(0, 500) ?? null,
      author: author?.slice(0, 300) ?? null,
      thumbnailUrl: thumbnailUrl && URL.canParse(thumbnailUrl, finalUrl) ? new URL(thumbnailUrl, finalUrl).toString() : null,
      durationSeconds: null,
      transcript: text,
      providerMetadata: { metadataSource: "web_reader", contentSource: finalUrl.toString(), transcript: text },
    };
  }
}

export function sourceAdapterFor(type: SourceType, includeTranscript = true): SourceAdapter {
  return type === "youtube" ? new YouTubeSourceAdapter(undefined, includeTranscript) : new WebSourceAdapter();
}
