const CACHE = "remember-shell-v7";
const SHELL = [
  "/theme.js",
  "/manifest.webmanifest",
  "/remember-icon-192.png",
  "/remember-icon-512.png",
  "/fonts/manrope-variable-latin.woff2",
  "/fonts/newsreader-variable-latin.woff2",
];

function builtAssetUrls(html) {
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  return [...new Set(references.flatMap((reference) => {
    try {
      const url = new URL(reference, self.location.origin);
      return url.origin === self.location.origin && url.pathname.startsWith("/assets/") ? [url.href] : [];
    } catch {
      return [];
    }
  }))];
}

async function cacheShell(response, includeStaticAssets = false) {
  const cache = await caches.open(CACHE);
  const shellResponse = response.clone();
  const assets = builtAssetUrls(await response.text());
  const candidates = [...new Set([...(includeStaticAssets ? SHELL : []), ...assets])];
  const missing = (await Promise.all(candidates.map(async (url) => (
    await cache.match(url, { ignoreVary: true }) ? null : url
  )))).filter(Boolean);
  if (missing.length) await cache.addAll(missing);
  await cache.put("/", shellResponse);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const indexResponse = await fetch("/", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error(`Could not cache the app shell (${indexResponse.status}).`);
    await cacheShell(indexResponse, true);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const bypassCache = url.origin !== self.location.origin
    || url.pathname === "/health"
    || url.pathname === "/contract"
    || url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/cdn-cgi/");
  if (bypassCache) return;
  if (event.request.mode === "navigate") {
    const navigation = fetch(event.request).then((response) => {
      if (!response.ok || response.type !== "basic") return { response, refresh: Promise.resolve() };
      const browserResponse = response.clone();
      return { response: browserResponse, refresh: cacheShell(response) };
    });
    event.waitUntil(navigation.then(({ refresh }) => refresh).catch(() => undefined));
    event.respondWith(navigation.then(({ response }) => response).catch(() => caches.match("/", { ignoreVary: true })));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request).then(async (response) => {
    const cacheControl = response.headers.get("Cache-Control") || "";
    if (response.ok && response.type === "basic" && !/(?:^|,)\s*(?:no-store|private)(?:\s|,|$)/i.test(cacheControl)) {
      const copy = response.clone();
      await caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  })));
});
