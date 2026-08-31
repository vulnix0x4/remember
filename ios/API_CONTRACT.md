# Client API contract

Set `REMEMBER_API_URL` in the Remember scheme environment. The client appends the following paths:

- `GET /api/items` → a JSON array of `Imprint`
- `POST /api/items` with `{ "url": "https://…" }` → the pending `Imprint`
- `GET /api/life` → goals, tasks, blockers, Life Floor, calendar, health, finance, and vault metadata
- `POST /api/life/tasks`, `PATCH /api/life/tasks/:id` → create or change a move
- `POST /api/life/tasks/:id/complete`, `POST /api/life/tasks/:id/block` → advance or adapt the RESET task path
- `POST /api/life/floor`, `POST /api/life/floor/:id/toggle` → configure and check a daily baseline
- `POST /api/life/calendar/sync` → normalized EventKit/provider events
- `POST /api/life/health/sync` → normalized, approved HealthKit measurements
- `POST /api/life/finance/accounts/sync`, `POST /api/life/finance/transactions/sync` → normalized finance records
- `POST /api/life/files`, `GET /api/life/files/:id/download`, `DELETE /api/life/files/:id` → private vault lifecycle

Dates use ISO-8601. Connection values are `related_to`, `supports`, `contradicts`, `extends`, `same_theme`, or `changed_into`; processing state is `ready`, `processing`, or `failed`.

The Worker enforces at most one active task per user with both repository logic and a partial unique index. Calendar, health, and finance sync operations are idempotent for records that carry a source and external identifier. File uploads are multipart and limited to 25 MB.

Local API requests send `x-dev-user-id`. Remote requests send `Authorization: Bearer …` when `REMEMBER_API_TOKEN` or a Keychain token is available. No token is bundled.

Debug builds fall back to deterministic fixtures when the API is unavailable. Override with `REMEMBER_MOCK_FALLBACK=0`; release builds default to no fallback. Direct API contract tests bypass the repository, so decoding regressions cannot be hidden by fixtures.
