import type { SourceType } from "./imprint";

export class UnsafeUrlError extends Error {
  readonly code = "unsafe_url";

  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface CanonicalSourceUrl {
  originalUrl: string;
  canonicalUrl: string;
  sourceType: SourceType;
  externalId: string | null;
  timestampSeconds: number | null;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "si",
  "spm",
]);

function normalizedHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function isNonPublicIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value > 255)) return true;
  const [first = 0, second = 0, third = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function assertPublicWebUrl(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only HTTP and HTTPS URLs can be saved.");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs containing credentials are not allowed.");
  }

  const host = normalizedHost(url.hostname);
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.startsWith("[") ||
    isNonPublicIpv4(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home") ||
    host.endsWith(".lan") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid") ||
    host.endsWith(".onion")
  ) {
    throw new UnsafeUrlError("Private and local network URLs are not allowed.");
  }
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(value);
  if (!match) return null;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds);
}

function youtubeVideoId(url: URL): string | null {
  const host = normalizedHost(url.hostname);
  let candidate: string | null = null;
  if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  else if (url.pathname === "/watch") candidate = url.searchParams.get("v");
  else {
    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "live"].includes(parts[0] ?? "")) candidate = parts[1] ?? null;
  }
  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

export function canonicalizeSourceUrl(input: string): CanonicalSourceUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UnsafeUrlError("Enter a valid URL.");
  }
  assertPublicWebUrl(url);
  url.hash = "";
  url.hostname = normalizedHost(url.hostname);
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const externalId = youtubeVideoId(url);
    if (!externalId) throw new UnsafeUrlError("This does not appear to be a valid public YouTube video URL.");
    const timestampSeconds = parseTimestamp(url.searchParams.get("t") ?? url.searchParams.get("start"));
    return {
      originalUrl: input.trim(),
      canonicalUrl: `https://www.youtube.com/watch?v=${externalId}`,
      sourceType: "youtube",
      externalId,
      timestampSeconds,
    };
  }

  const ordered = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  url.search = "";
  for (const [key, value] of ordered) url.searchParams.append(key, value);
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");

  return {
    originalUrl: input.trim(),
    canonicalUrl: url.toString(),
    sourceType: "web",
    externalId: null,
    timestampSeconds: null,
  };
}

export function youtubeTimestampUrl(canonicalUrl: string, seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return canonicalUrl;
  const url = new URL(canonicalUrl);
  url.searchParams.set("t", `${Math.max(0, Math.floor(seconds))}s`);
  return url.toString();
}
