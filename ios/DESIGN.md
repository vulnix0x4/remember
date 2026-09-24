# iOS design rationale

The iPhone app follows the attention-first spec in [docs/REDESIGN.md](../docs/REDESIGN.md). This file records how the iOS implementation meets it.

## Where things live

- **Tokens and components:** `Remember/Design/DesignSystem.swift`. It holds the colors (dark canvas, `card`, `cardRaised`, warm amber accent reserved for Jev and "now"), the three button styles (`.rememberPrimary`, `.rememberSecondary`, `.rememberQuiet` / `.rememberDanger`), `RememberHeader`, `SectionHeading`, `MetaChip`, `RememberEmptyState`, the bottom dock with `AddBar` and toasts, and duration and relative-day formatting.
- **Task experience:** `Remember/Features/Tasks/`. It holds `NowCard` (Now / Doing / empty), `StuckSheet`, `TaskRow`, `TaskEditorSheet`, `DailyBasicsStrip`, and `JevSheet` with `JevStatusLine`.
- **One-line capture:** `Remember/Utilities/QuickTaskParser.swift`. It mirrors the web parser; tests are in `RememberTests/QuickTaskParserTests.swift`.
- **Focus timer:** `Remember/App/FocusTimer.swift`. One timer shared by Today and Plan, persisted in `UserDefaults`.
- **Dictation:** `Remember/Services/SpeechDictation.swift`. Tap-to-talk, on-device when available. Audio callbacks are built outside main-actor isolation so Swift 6 runtime checks don't trap.

## Decisions

- **Every root screen draws its own header.** The large, left-aligned tab title and the avatar are the only top-right control. The system navigation bar is hidden on root screens (`rememberPrimaryActions()`), so top-right add buttons are no longer possible. Sectioned tabs get the header automatically from `AdaptiveSectionControl`.
- **One add bar per screen,** pinned above the tab bar through `rememberBottomDock`. It never opens a form: tasks are parsed from the text, Library saves a link or a thought depending on the input, and Goals create from one line. Money and Files use the action-style `QuickAddBar`.
- **Nothing starts without the person.** The server (with Jev off) and Jev's autopilot can mark a task `active`. The app still shows it as **Now** with a Start button until the person taps Start. At that point the focus timer tracks the task, and the card becomes **Doing** with Done and I'm stuck.
- **Undo instead of confirmation.** Complete, delete, "Not now", and the Stuck adaptations apply immediately and offer Undo in a toast. Retryable failures also use a toast instead of an alert. Deleting a file stays a confirmation, because it is permanent.
- **Undoing a finished repeating task** also removes the next occurrence the server created when the task was completed.
- **Motion:** system transitions, `sensoryFeedback`, a pulsing "Doing" dot, and toast slides. Reduce Motion turns the pulse and slides into fades.

## Setup, routines and lock-in

- **Settings is the one place for configuration:** `Remember/Features/Setup/`. The same sections (Your day, Commitments, Chores, Focus mode, Nudges, About me) render inside `SettingsView`, and one at a time in `SetupFlowView`. That flow appears on first launch while there are no commitments. Preview data mode only shows it with `REMEMBER_SHOW_SETUP=1`.
- **Commitments and chores live on the server.** It turns them into dated tasks, so Jev plans them with everything else. The app only edits them, through `CommitmentEditorSheet`, and shows the tasks.
- **Lock-in:** every Start button sets `store.lockInTask`, and `RootView` presents `LockInView` full screen.
  - Tasks linked to a commitment with steps run as a guided routine. Progress is stored per task in `UserDefaults`, so leaving the app to move the laundry never loses your place.
  - Wait steps schedule one local notification.
  - Leaving takes a 3-second press, or the VoiceOver action.
- **Screen Time:** `FocusShield` holds the person's `FamilyActivitySelection` and applies a named `ManagedSettingsStore`.
  - The `RememberFocusMonitor` extension clears that store when the scheduled `DeviceActivity` interval ends. Intervals are at least 15 minutes, so the shield lifts even if the app is closed.
  - Both targets need the Family Controls entitlement: development builds work now, but App Store distribution needs Apple's approval.
- **Nudges:** `Nudges` schedules at most one "next planned" notification, one wrap-up per task, and one per routine wait. Nothing repeats.

## Verification still needed on hardware

VoiceOver across the Now card, rows (custom actions: Start now, Delete), toasts (announced), and lock-in (hold-to-leave has an accessibility action). Screen Time blocking and its automatic lift after the interval, and notification delivery while the app is closed. Also check dictation permission prompts, HealthKit, EventKit, Share Extension, and haptics on a physical device.
