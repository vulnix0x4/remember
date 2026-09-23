# Remember quality gates

## Return decisions and calendar days — September 7, 2026

- Today now applies the latest check-in, Not for today response, and practice outcome to chosen, dated, contextual, and fallback returns. A completed dated return stays completed until explicitly scheduled later; releasing an idea preserves its library entry. Contextual returns include the same check-in choices and acknowledgement as other returns.
- Web feedback persists locally, survives failed reads, and is removed from visible history when its source is deleted. Failed feedback does not silently dismiss a card. Delayed responses cannot restore a previously selected return; native overview refreshes preserve feedback confirmed while they were loading and cannot restore history after sign-out.
- The API retains the latest decision for every eligible item, beyond the recent-event window, and applies it to both new and cached returns. Feedback supports partial analyses, preserves ownership checks, and honors newer decisions that reverse older ones.
- New calendar-day schedules use local midnight for future days and the save instant for today, allowing explicit rescheduling after an earlier check-in. Web rejects impossible or past days and uses local today for the picker minimum. Native uses Calendar arithmetic across daylight-saving changes. The API stores and returns canonical UTC timestamps for accepted offset inputs; the stored instant remains fixed across devices.
- The native saved-item page uses a regular stack for its small set of sections. The previous lazy layout reproducibly froze after adding an experiment, with a process sample showing a busy SwiftUI layout loop. The same UI flow now confirms the addition and opens Plan.
- `pnpm check` passed with 229 tests: web 131, API 73, domain 21, extension 4; all typechecks and builds passed. The API's 73 tests passed again after preserving the original idempotency hash calculation around timestamp normalization. Thirteen date/picker regressions also passed separately in America/Denver and Asia/Tokyo.
- Native validation passed all 89 unit/contract tests and four affected UI flows: check-in acknowledgement, release followed by a fresh return, chosen Focus return, and saved experiment into Plan. An earlier full run passed 22 of 24 UI scenarios and exposed the fixed layout freeze plus an invalid long-label test query. The final affected run is `ios/DerivedData/Logs/Test/Test-Remember-2026.09.07_20-19-01--0600.xcresult`; screenshots are exported in `output/ios-return-final`.
- Chromium verified release acknowledgement, persistence after reload, and preservation of the source in Library at desktop and mobile widths. Screenshots are in `output/playwright/return-desktop.png`, `return-mobile.png`, and `return-acknowledgement.png`. A further local capture verified the picker’s local-day minimum and tomorrow’s persisted midnight. No production deployment occurred in this pass.

## Web capture recovery — September 7, 2026

- Library refresh uploads only unsynced captures, preserving legacy drafts without recreating acknowledged items that were deleted on another device.
- Captures reuse their draft identity for retries, share concurrent uploads, and persist the server acknowledgement before the next refresh. An older library response cannot overwrite a capture made while it was loading.
- Incomplete responses remain recoverable locally. Stalled capture requests time out after 30 seconds; optional YouTube transcript lookup has its separate 15-second limit. Local-save confirmation explains that reconnecting is needed for analysis, including thoughts with a return cue.
- Twelve new regression tests cover recovery and the visible single-thought result. Five of the initial service regressions failed against the prior implementation before the fix.
- `pnpm check` passed with 181 tests: web 109, API 47, domain 21, and extension 4. All typechecks and builds passed, including the Worker dry-run. This pass did not change native code or deploy to production.
- A Chromium session against the local web app and an explicitly mocked API dropped the first response after saving a thought. Automatic recovery used the same idempotency key, left one server record and one cached record, and displayed one library row. A subsequent reload made no further capture request. Screenshots at 1440×1000 and 390×844 are in `output/playwright/recovery-desktop.png` and `output/playwright/recovery-mobile.png`; mobile had no horizontal page overflow.

## Historical release evidence

Release evidence below reflects the production redesign and direct-control pass verified on September 1, 2026.

## Product and visual verification

- Remember now uses five primary destinations on both platforms: Today, Plan, Library, Ask, and Life. Save is global; Settings is available from the profile control.
- The complete web experience was inspected at 1440×1000 and 390×844 in light and dark appearances, including Library list/detail, Patterns, Ask, Life sections, Settings, Save, task, and transaction dialogs. The final mobile pass verified visible task choices, the pinned currency search sheet, focus return, and zero horizontal overflow.
- The complete iPhone experience was inspected in light and dark appearances, including compact Library rows, navigation, forms, failure/retry states, Dynamic Type, focus, and accessibility behavior.
- Final visual evidence is stored in the ignored `output/web-redesign` and `output/ios-redesign` directories.
- Loading, processing, partial, failure, offline, validation, success, and empty states remain distinct without decorative AI-style iconography.
- The final simulator check verified a single compact top region on Today, Plan, and Library, readable status-bar time, fully visible task-duration labels, and seeded content on every audited route.
- Library and Home no longer flash an empty archive while the first signed-in request is loading. Cached data and queued Life changes are labeled honestly, with explicit retry and automatic reconnect flushing.
- File deletion uses an accessible in-app confirmation instead of a browser-native prompt, and feature-level Life screens load on demand so the initial web JavaScript is below the former 500 kB warning threshold.

## Functional and accessibility verification

- Capture, canonical-URL deduplication, processing, retry, detail, search, grounded Ask, typed connections, resurfacing, Patterns, Life modules, private files, export, and account deletion have automated coverage.
- Durable deletion jobs protect D1, R2, and Vectorize cleanup from partial failures. Five fault-injection tests cover staging, external cleanup, acknowledgement, ordering, and idempotency failures.
- The web accessibility suite covers all primary destinations and dialogs, including labels, names, landmarks, focus trapping, Escape dismissal, trigger focus restoration, inert modal backgrounds, duplicate IDs, and hidden focusable content.
- iOS controls use native semantics and adequate targets; the suite covers Dynamic Type, accessibility identifiers, navigation, retryable mutations, file uploads, and deterministic Health aggregation.
- Short choices are visible on both platforms; long currency and account lists are searchable. Source audits found no native web selects, SwiftUI menus, hidden primary actions, lightning/sparkle action icons, or undersized audited choice targets.

## Automated engineering evidence

- Full repository gate: `pnpm check` passed.
- JavaScript/TypeScript tests: 121/121 passed (web 58, API 40, domain 19, extension 4).
- Swift unit, contract, and UI tests: 55/55 passed.
- Web, domain, API, extension, and production builds/typechecks passed.
- Cloudflare production dry-run and Worker startup check passed; the deployed Worker reported a 37 ms startup time.
- The production dependency audit reports no known vulnerabilities.
- Signed iPhone build 1.0 (12) was installed over build 11 with bundle identifier `com.lukewhaley.remember`, preserving the existing app container and session. CoreDevice verified the installed version and launched it over Wi-Fi.

## Production verification

- Cloudflare Worker version `e45d20f5-7dda-4329-8f1b-ede55112df18` is deployed to the private production domain.
- The deployed worker reports the production environment and uses `z-ai/glm-5.3-flash`, with `openai/gpt-5-mini` retained as the analysis and Ask fallback.
- Live HTML references the tested assets `/assets/index-CLF7RLlR.js` and `/assets/index-CyniQgiv.css`; the Life feature bundle is split into `/assets/LifeOS-BcVZrmZj.js` and loads only when needed.
- A fresh production browser session installed `remember-shell-v7`, loaded the exact deployed bundle, and successfully reloaded the Remember shell while fully offline.
- The existing signed-in production session opened the redesigned app and displayed all eight saved items plus live Health history.
- Production metadata identified that the first 14 Ask answers had all fallen back to source matching. The repaired path now requests low reasoning, JSON output, fastest-provider routing, and a model fallback. Answers are constrained to concise conversational prose, citation markers are removed defensively, unusable link-only saves are excluded, and at most three supporting saves remain collapsed until requested.
- Two signed-in live Ask canaries completed with genuine `z-ai/glm-5.3-flash` synthesis, including a follow-up using thread history. Provider traces reported `finishReason: stop` in 10.9 s and 35.8 s, with no fallback on either verified answer.
- Migration `0004_deletion_outbox.sql` applied successfully and no migrations remain pending.
- Post-deploy D1 counts preserve the archive: 8 items, 8 analyses, 19,240 Health rows, and 0 pending deletion jobs. The Health increase is expected ongoing device sync; only the explicit Ask canary conversations added verification rows.
- The pre-redesign D1 backup is `output/backups/remember-db-production-pre-redesign-2026-08-31.sql`, with SHA-256 `3fc060a4673625579a7af81d4c28fd9762e949e3feac3a4b95cedee6ee569b30`. A restore rehearsal and `PRAGMA quick_check` passed before deployment.

## Remaining physical-device boundary

The signed app is installed and was launched on the paired iPhone, and it points at the verified production API. Health, Calendar, and notification permission prompts remain intentionally user-controlled; open the corresponding feature on the phone if iOS asks you to approve access.
