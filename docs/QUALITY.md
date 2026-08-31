# Remember quality gates

## Functional

- Capture, canonical-URL duplicate handling, processing, retry, detail, vague search, grounded Ask, typed connections, resurfacing feedback, evolution, the RESET task loop, Life Floor, cross-module sync, private vault lifecycle, portable export, and destructive account deletion have automated coverage.
- The database and repository enforce exactly one active move. Tests cover blocker-driven shrinking, completion-driven activation, floor toggling, Calendar/Health/Finance normalization, canonical finance account IDs, and private R2 upload/download.
- Every Ask citation identifies an Imprint; timestamp-backed claims preserve a clickable source timestamp when one exists.
- Provider failures and malformed model output preserve usable source data as an honest partial result.
- Fixture data is a development fallback only; valid empty live API responses render truthful empty states.

## Visual and responsive

- The original Remember surfaces were browser-inspected at 1440px desktop and 390×844 mobile in light and dark appearances. The new Life OS surfaces have responsive CSS and automated semantic coverage; refresh visual snapshots on a browser-equipped release machine.
- The original iOS surfaces were simulator-inspected on iPhone 17 Pro and a compact phone, including XXXL Dynamic Type and dark appearance. The new native Life OS modules require the macOS/Xcode release gate described below.
- Final evidence is stored in `output/playwright`, `apps/web/output/playwright`, and `ios/Screenshots`.
- Loading, processing, partial, failure, offline, validation, success, and empty states are visually distinct.

## Accessibility

- The automated axe-core gate covers Today, Tasks, Goals, Calendar, Health, Money, Files, Library, Ask, Evolution, Settings, Detail, and Capture.
- The automated component gate combines axe WCAG rules with explicit checks for labels, names, landmarks, dialog semantics, duplicate IDs, hidden focusable content, focus trapping, Escape dismissal, and trigger focus restoration.
- Keyboard focus is visible; the capture dialog traps/restores focus; motion respects reduced-motion preferences.
- The iOS system accessibility audit passes. Critical controls have labels and 44-point targets; XXXL Dynamic Type remains navigable; semantic text colors have automated WCAG AA contrast checks.

## Engineering evidence

- TypeScript/type generation: pass for web, domain, API, and extension.
- Automated JavaScript/TypeScript tests: 88/88 pass (web 33, API 32, domain 19, extension 4).
- Swift suite now contains 25 unit/contract and 6 UI tests, including unified Life OS decoding and authenticated multipart vault upload contracts. Run it on macOS/Xcode before release.
- Production web build and Cloudflare static-assets dry-run: pass.
- Production Lighthouse (mobile): 97 Performance, 100 Accessibility, 100 Best Practices, 100 SEO; 2.4 s LCP, 0 ms total blocking time, and 0 cumulative layout shift.
- Worker default and production dry-runs, startup check, and fresh local D1 migration: pass.
- iOS project YAML, Info.plist, entitlements, and new source structure pass static validation in this Linux workspace. The native build/simulator gate requires macOS with Xcode 26 and remains a release prerequisite.
- No credentials, Apple signing identifiers, or provisioned production resource identifiers are committed.

## Honest boundary

The checked-in product is a production-quality, runnable Personal Life OS foundation. A public production launch still requires owner-controlled Cloudflare resources/secrets, the D1 migration, Apple signing/App Group/HealthKit registration, a macOS native build and simulator pass, physical-device permission/assistive-technology testing, and production provider validation. No checked-in code can substitute for those owner-controlled launch steps.
