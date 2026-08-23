export const DEFAULT_API_BASE = "http://localhost:8787";
export const DEFAULT_DEV_USER_ID = "00000000-0000-4000-8000-000000000001";

export function normalizeApiBase(value) {
  const url = new URL(value || DEFAULT_API_BASE);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Use HTTPS for remote servers.");
  }
  return url.href.replace(/\/$/, "");
}

export function isSavableUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function authorizationHeaders(apiBase, accessToken) {
  const url = new URL(normalizeApiBase(apiBase));
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return { "x-dev-user-id": DEFAULT_DEV_USER_ID };
  }
  const token = accessToken?.trim();
  if (!token) throw new Error("Add your Remember access token in extension settings.");
  return { authorization: `Bearer ${token}` };
}

export async function saveImprint({ apiBase, accessToken, url, title, reaction }, fetcher = fetch) {
  if (!isSavableUrl(url)) throw new Error("This page cannot be saved.");
  const base = normalizeApiBase(apiBase);
  const response = await fetcher(`${base}/api/items`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-remember-client": "browser-extension",
      ...authorizationHeaders(base, accessToken)
    },
    body: JSON.stringify({
      url,
      title: title || undefined,
      personalReaction: reaction?.trim() || undefined
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || "Remember could not save this page.");
  }
  return payload;
}
