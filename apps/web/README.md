# Remember web

Responsive React and Vite client for Remember. It includes an installable PWA shell, deterministic product fixtures, local persistence, and an API boundary for the Cloudflare backend.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run deploy:dry-run
```

## API boundary

Set `VITE_API_BASE` to the Worker origin when the API is available:

```bash
VITE_API_BASE=http://localhost:8787 npm run dev
```

The configured client uses `GET /api/items`, `POST /api/items`, `GET /api/search`, `POST /api/ask`, `GET /api/evolution`, and the resurfacing read/response endpoints. Without an API origin, or when a request fails, it uses deterministic fixtures plus local persistence. Captures are always persisted locally before network sync is attempted.

For YouTube saves, the browser requests timestamped public captions from `youtube-transcript.ai` using only the public video ID, then sends that transcript through the authenticated Remember API. Personal reactions are never sent to the caption service. The Worker persists the transcript for grounded Ox Alpha analysis and future retries.

Local API origins (`localhost`, `127.0.0.1`, or `::1`) automatically receive a fixed `x-dev-user-id` UUID for the Worker's development-auth mode. Set `VITE_AUTH_MODE=password` for the production build; the polished login exchanges credentials for a signed HttpOnly cookie and never stores the password or a bearer token in JavaScript. `VITE_API_TOKEN` exists only for isolated local or private-preview verification and must never be used as production authentication.

The backend DTO and explicit presentation mapper live in `src/services/api.ts`; UI-facing Imprint types live in `src/types.ts`. `GET /api/items` may return either an array or `{ "items": [...] }`. `POST /api/items` receives `{ "url": string, "personalReaction"?: string }`.

## Product states

The fixture set intentionally includes ready, processing, and partial Imprints. Search has a contextual empty state, failed URLs receive inline errors, network loss displays a persistent sync banner, and capture completes before analysis.

Capture currently accepts an optional typed personal reaction. Recorded voice notes and transcription remain a post-v1 enhancement; the UI does not imply that audio is being captured before that backend path exists.

## Cloudflare static hosting

`wrangler.jsonc` serves the production `dist` directory as Worker Static Assets with SPA fallback. Use `npm run cf:dev` after building to preview the Cloudflare runtime, and `npm run deploy:dry-run` to validate the deploy bundle. No deploy script performs a live publish automatically.
