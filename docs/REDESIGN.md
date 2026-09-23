# Remember redesign: attention-first UI

The single source of truth for the iOS and web interfaces. Both platforms implement the same structure, words, and behavior. When a platform detail is not covered here, choose whatever removes the most friction.

## Who this is for

People with ADHD and attention difficulties who need to get through their day. Assume the person is distracted, tired, and one confusing tap away from closing the app. Jev decides what to do next; the app's job is to make that one thing obvious and make everything else effortless.

## Ten rules

1. **One obvious action per screen.** Exactly one white primary button is visible at a time. Everything else is quieter.
2. **Thumb zone.** Anything people do often lives at the bottom of the screen. The top-right holds only the profile avatar. Never place add buttons at the top.
3. **One add bar.** Every tab has the same big white bar pinned just above the tab bar. It never moves. There is never a second add button for the same thing.
4. **Type one line; Jev handles the rest.** Adding a task needs only words. Duration, day, repeat, and importance are picked up from the text (see *Quick add*). No forms on the way in.
5. **Undo, not "Are you sure?"** Completing, deleting, and skipping happen immediately and show an Undo toast for 5 seconds. Confirmation dialogs are banned for reversible actions.
6. **No hidden mechanics.** No expand/collapse chevrons to reveal essential actions. Never use jargon like "queue", "inbox", "floor", "autopilot", or "blocker" in the UI.
7. **Short words.** Button labels are 1 to 3 words and verbs: *Start*, *Done*, *I'm stuck*, *Not now*. Helper text is at most one line, and most screens need none.
8. **Big targets.** Primary buttons are 60pt/px tall and full width. Rows are at least 56 tall. Icon buttons are 44×44.
9. **Calm, not empty.** Dark canvas, one warm accent reserved for Jev and "now", and plenty of space. No decorative sparkles, no nested cards, no borders on cards.
10. **Instant feedback.** Every tap gets a haptic (iOS) or visual response within 100ms. Optimistic UI everywhere; roll back with an error toast on failure.

## Visual system

| Token | Value | Use |
|---|---|---|
| `canvas` | `#0B0B0D` | App background |
| `card` | `#18181C` | Cards and rows |
| `cardRaised` | `#232329` | Secondary buttons, chips, and pressed rows |
| `line` | `#2E2E35` | Hairline dividers only |
| `text` | `#FFFFFF` | Primary text |
| `text2` | `rgba(255,255,255,0.64)` | Secondary text |
| `text3` | `rgba(255,255,255,0.40)` | Placeholders and meta |
| `accent` | `#FFB23F` | Jev, the "Now" label, the running timer, checkmarks, and progress |
| `accentInk` | `#1A1204` | Text on accent |
| `primary` | `#FFFFFF` bg / `#0B0B0D` text | The one primary button per screen, and the add bar |
| `danger` | `#FF5D5D` | Delete text only |

- **Radius:** cards 22, buttons and add bar are capsules (fully rounded), chips 999.
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32. Screen side padding is 16 (20 on web ≥ 640px).
- **Type:** iOS uses SF Rounded for titles (`.fontDesign(.rounded)`) and SF Pro for body. Web uses `ui-rounded, "SF Pro Rounded", system-ui` for titles and `system-ui` for body. Screen title: 34 bold, left-aligned, no centered inline titles. Now-card title: 30 bold. Row title: 17 semibold. Meta: 13 medium, `text2`.
- **Buttons:** only three kinds.
  - `Primary`: white capsule, black 17-semibold text, height 60, full width.
  - `Secondary`: `cardRaised` capsule, white text, height 52.
  - `Quiet`: text only, `text2`, min 44 tall.
- **Icons:** SF Symbols on iOS; Phosphor on web (already installed). Always paired with a label, except the checkbox, mic, send, and avatar.

## App structure (5 tabs, unchanged)

Today · Plan · Library · Ask · Life. Plan keeps the segments **Tasks · Calendar · Goals**. Library keeps **Saved · Patterns**. Life keeps **Health · Money · Files**.

- **Header:** large left-aligned title plus the avatar button (profile and settings) on the right. Segment control sits directly below the title as a pill control (height 40, `card` background, selected segment white with black text).
- **Add bar:** pinned above the tab bar on every screen.

| Screen | Add bar placeholder | What it does |
|---|---|---|
| Today, Plan → Tasks, Plan → Calendar | `Add a task…` | Quick add task (inline, no sheet) |
| Plan → Goals | `Add a goal…` | Creates a goal from one line (inline) |
| Library (both segments) | `Save a link or thought…` | Inline save; a URL becomes a link, otherwise a thought |
| Ask | `Ask your library…` | Sends the question (Ask's composer *is* the add bar, restyled) |
| Life → Health | *(no bar)* | — |
| Life → Money | `Add a transaction…` | Opens the existing composer prefilled with the text |
| Life → Files | `Add a file` | Button-style bar that opens the picker |

- **Add bar anatomy:** white capsule, height 56, 16 horizontal padding. Left: text field, black text, placeholder `rgba(0,0,0,0.45)`. Right: when empty, a mic button (iOS: speech dictation; web: Web Speech API when available, hidden otherwise). When text is present, a black circular send button (44) with an up-arrow. Return submits. On success the field clears, keeps focus (so people can dump several tasks in a row), fires a success haptic, and shows the toast `Added · Jev will fit it in`.
- **Parse preview:** while typing a task, a row of small chips sits directly above the bar showing what was understood, e.g. `⏱ 30 min` `📅 Tomorrow` `↻ Weekly` `! Important`. Chips are read-only; they disappear when nothing is recognized.

## Quick add parsing (identical on both platforms)

Implement as a pure function `parseQuickTask(text, now, calendar) -> { title, durationMinutes?, notBefore?, dueAt?, repeatEveryDays?, priority? }`. It is case-insensitive, and every recognized token is removed from the title.

- **Duration:** `(\d+)\s*(m|min|mins|minute|minutes)\b` → N. `(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b` → round(N×60). `half an hour` / `half hour` → 30. `an hour` → 60. Clamp to 2...720.
- **When:**
  - `today`: no date (it is removed).
  - `tonight`: notBefore today 18:00, only if that is still in the future; otherwise no date.
  - `tomorrow` / `tmrw` / `tmr`: tomorrow 09:00.
  - `this weekend` / `weekend`: next Saturday 09:00 (today if today is Saturday and it's before 09:00).
  - `next week`: next Monday 09:00.
  - `(on |next )?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)`: the next occurrence strictly after today, at 09:00. The short forms match only as whole words.
  - `by <any of the above day words>`: sets **dueAt** at 17:00 on that day instead of notBefore.
- **Repeat:** `every day` / `daily` / `everyday` → 1. `every week` / `weekly` → 7. `every month` / `monthly` → 30. `every (\d+) days` → N (1...365). `every other day` → 2.
- **Priority:** `!!` or `urgent` → `must`. A standalone `!`, `asap`, or `important` → `high`.
- **Automatic repeat:** people should never have to set up recurring chores. When the text doesn't say how often (and doesn't say `once`, `one time` or `just once`, which are removed and turn this off), repeat is chosen in this order:
  1. **Your rhythm:** if tasks with the same title (case-insensitive) have been completed before, use the gap between the last two completions, or between the last completion and now if there's only one. Round it to the nearest of 1, 2, 3, 7, 14, 30, 90, 180 or 365 days. Ignore gaps under half a day.
  2. **The usual rhythm** for common chores (whole-word, case-insensitive, first match wins):
     - 1 day: dishes, make (the/my) bed, meds, medication, pills, vitamins, walk (the) dog, feed (the) dog/cat/pet(s), floss, journal, skincare
     - 3 days: water (the) plants
     - 7 days: laundry, vacuum, mop, groceries, grocery, trash, garbage, recycling, bins, dust, meal prep, clean (the) bathroom/kitchen/room/house/apartment, mow (the) lawn, weekly review, plan (the/my) week, call mom/dad/grandma/grandpa/parents
     - 14 days: sheets, bedding, change (the) bed
     - 30 days: rent, bill(s), pay (the) bills, credit card, mortgage, haircut, budget, wash (the) car, car wash, clean (the) fridge, back up / backup
     - 90 days: air filter, hvac filter, furnace filter, toothbrush, oil change, change (the) oil
     - 180 days: dentist, teeth cleaning
     - 365 days: checkup, eye exam, registration
  
  The preview chip says where it came from: `Weekly` when typed, `Weekly · usual` for the chore list, `Weekly · your rhythm` when learned. The task sheet's Repeat chips always include the chosen value.
- **Title:** collapse whitespace, trim trailing ` on`, ` by`, ` at`, `,`, and `-`, then uppercase the first character. If the title would be empty, use the original trimmed text with no parsing.
- **Defaults:** durationMinutes 15, area `direction`, status `queued`, priority `normal`.
- **Tests:** "laundry" → weekly (usual); "laundry once" → no repeat; "pay rent by friday" → monthly and due Friday. "Call mom tomorrow 20m" → title "Call mom", 20, tomorrow 09:00. "laundry every week 1h" → "Laundry", 60, repeat 7. "pay rent by friday !" → "Pay rent", dueAt Friday 17:00, high. "email sam" → "Email sam", nothing else. "today" → title "today" (empty fallback). "gym tonight 45 min" at 20:00 → "Gym", 45, no notBefore.

## Today

From top to bottom:

1. **Header:** `Today` plus the avatar. Below it, a small Jev status line: accent dot + `Jev is planning your day` (or `Jev is paused` in `text3`). Tapping it opens the **Jev sheet**.
2. **Now card:** the hero, and the only thing that matters.
   - **Not started** (Jev's pick or next available). Label `NOW` in accent, 13 bold, tracking 1.2. Title (30 bold rounded). `Start with: <first step>` in `text2`, if there is one. Meta chips: `15 min`, plus the scheduled time if any. Jev's reason is visible as one line in `text3` italic, truncated to 2 lines, and tapping it expands in place. Primary button **Start**, which makes the task current and starts the timer in one tap. Below it, Quiet button **Not now**: moves the task aside for an hour (blocker reason `different`), Jev picks the next one, and an Undo toast appears.
   - **Doing** (active task). Label `DOING` in accent with a pulsing dot. Title. A big monospaced timer (48, accent) that starts automatically on Start; tapping the timer pauses or resumes it. Primary **Done**. Secondary **I'm stuck**, which opens the **Stuck sheet**.
   - **Empty.** If there are no tasks: title `What's on your mind?` with one line `Add anything below. Jev will plan it.` If all tasks are scheduled later: `You're clear until 3:00 PM` plus Quiet **Pull one forward**, which opens the Plan tab.
3. **Up next:** at most 3 compact rows (same row component as Plan), then a Quiet `See all in Plan` link. Hidden when empty.
4. **Daily basics:** a horizontal row of tappable chips (title + check). Tap toggles with a haptic. The last chip is `+ Add`. Hidden entirely when there are none, except a single Quiet `Add a daily habit` link.
5. **One idea for today:** the existing contextual return or resurfaced card, restyled as a single `card` with the title, one line of why, and one Secondary button. Only one; everything else moves to Library.

Remove from Today: the "Saved ideas" disclosure, the autopilot section, the weekly synthesis card (it moves to Library → Patterns), welcome copy, and the date line (the Jev line replaces it).

## Stuck sheet (replaces the blocker dialog and the task switcher)

Bottom sheet, medium height. Title `What's getting in the way?`. Four large rows (icon + label, 64 tall, `card` background):

- `It's too big`: reason `big`. Toast: `Made it smaller`.
- `Not sure where to start`: reason `unclear`.
- `Only have 5 minutes`: reason `time`.
- `Do something else`: reason `different`. Jev picks the next task. Toast: `Moved aside · Undo`.

At the bottom, the danger-colored Quiet button `Delete task`. It deletes immediately (status `removed`), closes the sheet, and shows the toast `Deleted · Undo`. Undo PATCHes the status back.

There is no "choose another task" list anywhere. If someone wants a specific task, they tap **Start** on it in Plan.

## Plan → Tasks

- Optional compact Now card at the top: same data as Today, single line, with a Primary-small **Start** or **Done**.
- **Sections** (plain `text2` 13 semibold uppercase headers, no cards around sections):
  - `Today`: available now, in Jev's order.
  - `Later`: notBefore or scheduled in the future, sorted by time, with meta showing the day and time (`Thu 3:00 PM`).
  - `Daily basics`: chips, same as Today.
  - `Done today · 3`: collapsed by default (the one allowed disclosure, because it's non-essential).
- **Task row:** 56+ tall, `card` background, radius 22, 8 gap between rows (rows are separate cards, not one grouped list). Left: a 28 circle checkbox; tapping it completes the task (fills with accent + check, row fades out, toast `Done · Undo`). Middle: title (17 semibold, 2 lines max) and a meta line (`15 min · Thu 3 PM · ↻ Weekly · Important`). Tapping the row opens the **Task sheet**. Swipe right → Start (accent). Swipe left → Delete (danger, with undo). The web shows a hover-revealed `Start` button instead of swipe.
- **Task sheet:** editable title (large), `Start with…` first-step field, **How long** chips (5, 15, 30, 60, 90), **When** chips (Anytime, Tonight, Tomorrow, This weekend, Next week → notBefore), **Repeat** chips (Never, Daily, Weekly, Monthly), and an **Important** toggle. Primary **Start now**. Quiet danger **Delete**. Changes save automatically on dismiss, with no Save button.

## Plan → Calendar and Goals

- **Calendar:** keep the week strip and day agenda. Restyle with the tokens, and show Jev's planned blocks as rows with an accent left bar. Use `Connect calendar` as a Secondary button when not connected.
- **Goals:** cards show the title, a progress bar (accent), and the Quiet button `Add a step`, which creates a task linked to the goal. Tapping a card opens an edit sheet with a progress slider and Pause/Complete.

## Library, Ask, Life

- **Library:** search field in the header area (`card` capsule). Filters become one horizontal chip row. Items are rows with a thumbnail and title. Keep Saved · Patterns. Patterns keeps its content but uses the new cards and buttons, and its sub-tabs become chips.
- **Ask:** the empty state shows three suggestion chips and one `Think through a decision` Secondary button. The composer becomes the white add bar.
- **Life:** Health, Money, and Files use the new header, cards, and empty states (icon, one line, Secondary button). Money's `Add an account` becomes a Secondary button in the section header, not the add bar.

## Jev sheet

Opened from the Today status line. Contents: a toggle `Let Jev plan my day`, planning hours (two time pickers), a `What Jev should know` free text field (preferences), and a line `Last planned 2 min ago`. That's all.

## Toasts

One toast at a time, pinned above the add bar. `card` background, white text, and an optional accent `Undo` button. Auto-dismisses after 5s. Errors use the same toast with danger text. Replace blocking error alerts with toasts wherever the action is retryable.

## Accessibility

Contrast: `text2` on `card` must pass AA (it does at 0.64). Every icon-only control has a label. Dynamic Type is respected, and rows grow instead of truncating. Reduce Motion disables the pulse and fade animations. The swipe actions have accessible custom-action equivalents.
