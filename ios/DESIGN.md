# iOS design rationale

Remember is designed as a quiet Personal Life OS rather than a productivity scoreboard. The iPhone interface is always dark: near-black canvas, graphite surfaces, clear white type, and a restrained periwinkle-blue action color. The current decision or next action owns the screen.

## System

- Spacing follows an 8 / 16 / 24 point rhythm.
- Interactive controls use native SwiftUI components and meet the 44-point minimum target.
- Typography uses semantic Dynamic Type styles only.
- The app presents in dark mode on every screen. Blue marks primary actions and selection; state never depends on color alone. Green is not part of the interface or app icon.
- Contrast separates the work: the current task sits on a graphite surface, its action is blue, and smaller disclosures use a raised neutral surface. Avoid placing unrelated controls directly on the same black plane.
- Navigation keeps Today, Library, and Ask immediately available, with the larger Life OS modules accessible through the native tab system. Every feature owns a `NavigationStack`; focused creation uses native sheets.
- Tasks give visual dominance to exactly one active move. Blocker choices use a native confirmation dialog and change the move without judgment.
- Today and Plan use the same task ordering. Jev's enabled plan takes precedence; otherwise available tasks fall back to explicit priority and age. Future tasks stay visible in Plan but are not presented as something to do now.
- A task has three clear states: **Do this now**, **Doing now**, and **After this**. Tapping a later task reveals its first step; it does not silently replace the current task.
- One thumb-reachable creation bar appears per relevant screen. Today and Plan add a task; Library saves a link or thought; Goals, Money, and Files use their own creation action. Top-right plus buttons are reserved for neither capture nor task entry.
- Creation asks only for the essential input first. Task name is enough to save; time, area, priority, recurrence, context, and return cues remain optional details.
- When a task feels hard, the person can make it smaller, clarify it, shorten it, or switch tasks. Switching preserves the original task. Removing a task requires a separate explicit confirmation.
- Saved ideas and completed work sit behind plain, clearly labeled disclosure controls. Decorative sparkle icons and nested promotional cards do not compete with the current task.
- Health and Calendar use explicit Sync buttons before HealthKit or EventKit authorization appears. Permission state is communicated in text, not color alone.
- Motion is limited to system transitions and `sensoryFeedback`, so Reduce Motion works without a parallel animation implementation.
- Every AI statement about personal meaning is visibly labeled as interpretation or hypothesis.

## HIG review

The implementation uses native navigation, controls, safe areas, SF Symbols, Dynamic Type, dark mode, explicit VoiceOver labels, system empty/error states, and keyboard-friendly inputs. A release sign-off still requires an Xcode build plus hands-on VoiceOver, Switch Control, HealthKit, EventKit, file-import, haptics, and Share Extension validation on physical hardware.
