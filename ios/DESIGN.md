# iOS design rationale

Remember is designed as a quiet Personal Life OS rather than a productivity scoreboard. The interface uses editorial type hierarchy, warm adaptive backgrounds, restrained accent color, and native system depth. The current decision or next action—not chrome—owns the screen.

## System

- Spacing follows an 8 / 16 / 24 point rhythm.
- Interactive controls use native SwiftUI components and meet the 44-point minimum target.
- Typography uses semantic Dynamic Type styles only.
- Color uses adaptive SwiftUI styles with a warm light/dark foundation; state never depends on color alone.
- Navigation keeps Today, Library, and Ask immediately available, with the larger Life OS modules accessible through the native tab system. Every feature owns a `NavigationStack`; focused creation uses native sheets.
- Tasks give visual dominance to exactly one active move. Blocker choices use a native confirmation dialog and change the move without judgment.
- Health and Calendar use explicit Sync buttons before HealthKit or EventKit authorization appears. Permission state is communicated in text, not color alone.
- Motion is limited to system transitions and `sensoryFeedback`, so Reduce Motion works without a parallel animation implementation.
- Every AI statement about personal meaning is visibly labeled as interpretation or hypothesis.

## HIG review

The implementation uses native navigation, controls, safe areas, SF Symbols, Dynamic Type, dark mode, explicit VoiceOver labels, system empty/error states, and keyboard-friendly inputs. A release sign-off still requires an Xcode build plus hands-on VoiceOver, Switch Control, HealthKit, EventKit, file-import, haptics, and Share Extension validation on physical hardware.
