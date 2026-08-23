# Remember quality gates

## Functional

- Capture, canonical-URL duplicate handling, processing, retry, detail, vague search, grounded Ask, typed connections, resurfacing feedback, evolution, export, and destructive account deletion have automated or live-browser coverage.
- Every Ask citation identifies an Imprint; timestamp-backed claims preserve a clickable source timestamp when one exists.
- Provider failures and malformed model output preserve usable source data as an honest partial result.
- Fixture data is a development fallback only; valid empty live API responses render truthful empty states.

## Visual and responsive

- Web was browser-inspected at 1440px desktop and 390×844 mobile in light and dark appearances.
- iOS was simulator-inspected on iPhone 17 Pro and a compact phone, including XXXL Dynamic Type and dark appearance.
- Final evidence is stored in `output/playwright`, `apps/web/output/playwright`, and `ios/Screenshots`.
- Loading, processing, partial, failure, offline, validation, success, and empty states are visually distinct.

## Accessibility

- Real-browser axe-core reports zero violations on all five primary web routes in both appearances.
- The automated component gate combines axe WCAG rules with explicit checks for labels, names, landmarks, dialog semantics, duplicate IDs, and hidden focusable content across Home, Library, Ask, Evolution, Settings, Detail, and Capture.
- Keyboard focus is visible; the capture dialog traps/restores focus; motion respects reduced-motion preferences.
- The iOS system accessibility audit passes. Critical controls have labels and 44-point targets; XXXL Dynamic Type remains navigable; semantic text colors have automated WCAG AA contrast checks.

## Engineering evidence

- TypeScript/type generation: pass for web, domain, API, and extension.
- Automated JavaScript/TypeScript tests: 63/63 pass (web 25, API 22, domain 12, extension 4).
- Swift tests: 18/18 unit/contract and 6/6 UI pass.
- Production web build and Cloudflare static-assets dry-run: pass.
- Production Lighthouse (mobile): 97 Performance, 100 Accessibility, 100 Best Practices, 100 SEO; 2.4 s LCP, 0 ms total blocking time, and 0 cumulative layout shift.
- Worker default and production dry-runs, startup check, and fresh local D1 migration: pass.
- Unsigned iOS Simulator build with embedded/validated Share Extension: pass.
- No credentials, Apple signing identifiers, or provisioned production resource identifiers are committed.

## Honest boundary

The checked-in product is a production-quality, runnable v1 implementation. A public production launch still requires owner-controlled Cloudflare secrets, Apple signing/App Group registration, physical-device assistive-technology testing, and production OpenRouter/Vectorize validation.
