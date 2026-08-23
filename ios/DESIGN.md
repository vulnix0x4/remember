# iOS design rationale

Remember is designed as a quiet personal archive rather than a productivity dashboard. The interface uses editorial type hierarchy, warm adaptive backgrounds, restrained terracotta accents, and native system depth. Content—not chrome—owns the screen.

## System

- Spacing follows an 8 / 16 / 24 point rhythm.
- Interactive controls use native SwiftUI components and meet the 44-point minimum target.
- Typography uses semantic Dynamic Type styles only.
- Color uses adaptive SwiftUI styles with a warm light/dark foundation; state never depends on color alone.
- Navigation uses five persistent tabs, `NavigationStack` for hierarchy, and a native sheet for focused capture.
- Motion is limited to system transitions and `sensoryFeedback`, so Reduce Motion works without a parallel animation implementation.
- Every AI statement about personal meaning is visibly labeled as interpretation or hypothesis.

## HIG review

Current implementation score: **9/10**. It uses native navigation, controls, safe areas, SF Symbols, Dynamic Type, dark mode, explicit VoiceOver labels, system empty/error states, and keyboard-friendly inputs. Reaching a defensible 10/10 requires hands-on VoiceOver and Switch Control traversal plus physical-device validation of haptics and the Share Extension; those cannot be fully established by simulator automation alone.
