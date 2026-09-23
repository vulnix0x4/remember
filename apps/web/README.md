# Remember web

Responsive React and Vite client for Remember. It includes an installable PWA shell, durable local persistence, an offline mutation outbox, and an API boundary for the Cloudflare backend.

The primary navigation is shared with the iPhone app: Today, Plan, Library, Ask, and Life. Tasks, Calendar, and Goals live in Plan; saved items and Patterns live in Library; Health, Money, and Files live in Life; Settings opens from the profile control.

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

For YouTube saves, the browser requests timestamped public captions from `youtube-transcript.ai` using only the public video ID, then sends that transcript through the authenticated Remember API. Personal reactions are never sent to the caption service. The Worker persists the transcript for grounded analysis and future retries.

Local API origins (`localhost`, `127.0.0.1`, or `::1`) automatically receive a fixed `x-dev-user-id` UUID for the Worker's development-auth mode. Set `VITE_AUTH_MODE=password` for the production build; the polished login exchanges credentials for a signed HttpOnly cookie and never stores the password or a bearer token in JavaScript. `VITE_API_TOKEN` exists only for isolated local or private-preview verification and must never be used as production authentication.

The backend DTO and explicit presentation mapper live in `src/services/api.ts`; the UI-facing saved-item type lives in `src/types.ts`. `GET /api/items` may return either an array or `{ "items": [...] }`. `POST /api/items` receives `{ "url": string, "personalReaction"?: string }`.

## Product states

The local development fixture set intentionally includes ready, processing, partial, and failed saves. Search has a contextual empty state, failed URLs receive inline recovery, network loss displays a persistent sync banner, and capture completes before analysis.

When a live API is configured, failed requests never replace account data with fixtures. Saved-item captures are persisted locally before sync, and Life mutations remain in a durable outbox until the server acknowledges them. Forms keep entered values when a request genuinely fails.

Capture currently accepts an optional typed personal reaction. Recorded voice notes and transcription remain a post-v1 enhancement; the UI does not imply that audio is being captured before that backend path exists.

## Cloudflare static hosting

`wrangler.jsonc` serves the production `dist` directory as Worker Static Assets with SPA fallback. Use `npm run cf:dev` after building to preview the Cloudflare runtime. From the repository root, `pnpm deploy:production:dry-run` and `pnpm deploy:production` always rebuild this app before Wrangler packages the Worker, preventing a stale ignored `dist` directory from being published.
