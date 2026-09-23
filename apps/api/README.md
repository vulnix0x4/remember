# Remember API

Hono API and durable ingestion Workflow for Remember. The default configuration is local-first: D1 and R2 run locally, processing uses a deterministic mock, and AI/Vectorize calls are skipped. It never downloads or stores source media. YouTube analysis uses public captions, TikTok analysis uses the official public oEmbed caption, and X analysis uses public oEmbed text.

## Local development

From the repository root:

```sh
pnpm install
pnpm --filter @remember/api db:migrate
pnpm --filter @remember/api dev
```

Copy `.dev.vars.example` to `.dev.vars`. Local clients authenticate with `X-Dev-User-ID: <uuid>` only on localhost/test hosts. Bearer auth remains available using `AUTH_TOKEN`. `PROCESSING_MODE=workflow` preserves instant capture; the test harness overrides it to `direct` for deterministic local tests.

Useful checks:

```sh
pnpm --filter @remember/api types
pnpm --filter @remember/api typecheck
pnpm --filter @remember/api test
pnpm --filter @remember/api build
pnpm --filter @remember/api exec wrangler check startup
```

The API is available under both `/api` and `/api/v1`. Capture accepts `POST /items` with `{ "url": "..." }` and an optional `Idempotency-Key` header. Other core endpoints include `/items`, `/search`, `/ask`, `/connections`, `/evolution`, `/resurfacing/today`, and `/exports`. Shared request/response DTOs and Zod schemas are exported by `@remember/domain`.

Capture returns HTTP `202` for a new item and `200` for an existing canonical URL:

```json
{
  "item": { "id": "uuid", "status": "pending", "canonicalUrl": "https://www.youtube.com/watch?v=..." },
  "deduplicated": false,
  "duplicate": false
}
```

`duplicate` is a backward-compatible alias of `deduplicated`; both always have the same value. List responses use `{ "items": [], "nextCursor": null }`. Search uses `{ "items": [], "query": "..." }`. Ask returns `{ "threadId", "answer", "citations", "grounded", "limitations" }`, and every citation contains `itemId`, source `url`, an `excerpt`, and an optional `timestampSeconds`.

During local development, the web app may send `X-Dev-User-ID: <uuid>` to a localhost API; this bypass is rejected on non-local hosts. Production uses a single-owner email/password login and a signed HttpOnly session cookie. Password verification uses PBKDF2-SHA256, login attempts are rate-limited in D1, and the plaintext password is never deployed. Production CORS allows exactly `env.production.vars.CORS_ORIGIN`.

## Production checklist

Before any deployment:

1. Replace the placeholder D1 ID in the `production` environment.
2. Create a 768-dimension cosine Vectorize index matching `@cf/baai/bge-base-en-v1.5`.
3. Create a string metadata index for `userId` if metadata-filtered queries will be used; this implementation primarily isolates users with Vectorize namespaces.
4. Set `LOGIN_EMAIL`, a salted `LOGIN_PASSWORD_HASH`, and a random `SESSION_SECRET` as production Worker secrets.
5. Set `OPENROUTER_API_KEY` as a production Worker secret.
6. Apply D1 migrations explicitly with `wrangler d1 migrations apply remember-db-production --remote --env production`.
7. Copy `.env.deploy.example` to `.env.deploy` (git-ignored) and set `PRODUCTION_DOMAIN`. Deploy with `pnpm --filter @remember/api deploy:production`; it attaches that domain and sets `CORS_ORIGIN` and `OPENROUTER_SITE_URL` from it, so the real domain never lives in source. Build the web app first, because the Worker serves `../web/dist`.
8. Verify the GLM 5.3 Flash model route, transcript-grounded JSON output, denied data collection, fallback routing, and schema validation before release. Remember acquires public captions first, prompts the configured model for JSON, and validates the result through the shared Zod contract.

`OPENROUTER_API_KEY` is intentionally never stored in Wrangler variables. AI output is validated through the shared Zod contract, personal interpretations are marked as hypotheses, and Ask responses are synthesized exclusively from the owner's saved items.
