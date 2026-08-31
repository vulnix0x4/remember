# Remember Personal Life OS architecture

## System boundary

Remember stores saved knowledge, user reactions, derived analysis, goals, tasks, calendar events, approved health measurements, finance records, private file metadata, and exportable history. It does not download or retain copies of source audiovisual content. Playback stays with the original source.

```text
iOS + HealthKit + EventKit    Web/PWA     Browser Extension
             |                   |                |
             +-------------------+----------------+
                                 |
                         Hono Worker API
                                 |
              +------------------+------------------+
              |                  |                  |
             D1             Workflow jobs          R2
              |                  |                  |
        Life OS records     source analysis    files + exports
              |                  |
              +----------- Vectorize ---------+
```

## Trust boundaries

- Clients may optimistically render capture success, but the Worker validates identity, URL, ownership, and payloads.
- D1 is the relational source of truth. Vectorize contains retrievable projections with user-scoped metadata, never authorization truth.
- Analysis providers return untrusted model output. The Worker validates it against the domain schema and records provenance and uncertainty.
- AI answers can reference only retrieved, user-owned Imprints and must emit structured citations.
- Personal relevance is always a hypothesis unless the user supplied the statement directly.
- Apple Health and Calendar access begins only after explicit interaction in the native app. Their data is normalized client-side before sync.
- Finance provider credentials are outside the current system boundary. Provider adapters send normalized accounts and transactions only.
- Every Life OS table carries `user_id`; all reads, mutations, downloads, and R2 keys enforce that ownership boundary.

## Life OS domain

| Module | Source of truth | Core invariant |
| --- | --- | --- |
| Today | Derived from all modules | Shows current context; creates no duplicate data |
| Remember | D1 + Vectorize projection | Answers cite user-owned sources |
| Goals | D1 | A goal describes an observable result |
| Tasks | D1 | At most one active task per user |
| Life Floor | D1 | A completion is an explicit date, not an inferred streak |
| Calendar | D1 normalized events | External events upsert by source + external ID |
| Health | D1 normalized measurements | Health access remains read-only and user-approved |
| Money | D1 accounts + transactions | Currency and transaction signs are preserved |
| Files | R2 object + D1 metadata | Objects are user-namespaced and private |

The task engine is intentionally adaptive. Completing the active move selects the best queued move. Blocking a move records the reason and either shrinks, clarifies, time-boxes, adapts, or removes it. The database partial index enforces the single-active invariant even if multiple clients race.

## Processing contract

1. Canonicalize and validate the submitted URL.
2. Insert or return the existing user-owned item idempotently.
3. Acknowledge the client while processing continues.
4. Retrieve supported source metadata through an adapter.
5. Analyze through the configured provider using a strict schema.
6. Persist analysis, moments, themes, and provenance transactionally.
7. Generate and upsert searchable embeddings when bindings are available.
8. Compare against previous Imprints and store typed, explainable connections.
9. Update candidate principles, tensions, timeline projections, and resurfacing candidates.

## Resilience

- Workflow steps are retryable and idempotent.
- Unsupported sources remain useful bookmarks.
- Missing remote AI bindings fall back to deterministic local fixtures only in development and tests.
- Export reads from D1 and produces versioned portable JSON plus Markdown for both knowledge and Life OS records. Vault contents remain individually downloadable instead of being silently duplicated into an export.
- Live credentials are never embedded in clients or committed files.
