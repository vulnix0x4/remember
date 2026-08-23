# Remember v1 architecture

## System boundary

Remember stores source URLs, user reactions, derived analysis, relationships, and exportable history. It does not download or retain copies of YouTube audiovisual content. Playback stays with the original source.

```text
iOS app + Share Extension     Web/PWA     Browser Extension
             |                   |                |
             +-------------------+----------------+
                                 |
                         Hono Worker API
                                 |
              +------------------+------------------+
              |                  |                  |
             D1             Workflow jobs          R2
              |                  |                  |
              +---------- analysis provider --------+
                                 |
                         Workers AI embeddings
                                 |
                             Vectorize
```

## Trust boundaries

- Clients may optimistically render capture success, but the Worker validates identity, URL, ownership, and payloads.
- D1 is the relational source of truth. Vectorize contains retrievable projections with user-scoped metadata, never authorization truth.
- Analysis providers return untrusted model output. The Worker validates it against the domain schema and records provenance and uncertainty.
- AI answers can reference only retrieved, user-owned Imprints and must emit structured citations.
- Personal relevance is always a hypothesis unless the user supplied the statement directly.

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
- Export reads from D1 and produces portable JSON plus Markdown.
- Live credentials are never embedded in clients or committed files.
