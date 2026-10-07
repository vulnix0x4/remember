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

Today · Plan · Library · Ask · Life. Plan keeps the segments **Tasks · Calendar · Projects**. Library keeps **Saved · Patterns**. Life has **Health · Sleep · Money · Files**.

- **Header:** large left-aligned title plus the avatar button (profile and settings) on the right. Segment control sits directly below the title as a pill control (height 40, `card` background, selected segment white with black text).
- **Add bar:** pinned above the tab bar on every screen.

| Screen | Add bar placeholder | What it does |
|---|---|---|
| Today, Plan → Tasks, Plan → Calendar | `Add a task…` | Quick add task (inline, no sheet) |
| Plan → Projects | `Add a project…` | Creates a project from one line (inline) |
| Library (both segments) | `Save a link or thought…` | Inline save; a URL becomes a link, otherwise a thought |
| Ask | `Ask your library…` | Sends the question (Ask's composer *is* the add bar, restyled) |
| Life → Health | *(no bar)* | — |
| Life → Money | `Add a transaction…` | Opens the existing composer prefilled with the text |
| Life → Files | `Add a file` | Button-style bar that opens the picker |

- **Add bar anatomy:** white capsule, height 56, 16 horizontal padding. Left: text field, black text, placeholder `rgba(0,0,0,0.45)`. Right: when empty, a mic button (iOS: speech dictation; web: Web Speech API when available, hidden otherwise). When text is present, a black circular send button (44) with an up-arrow. Return submits. On success the field clears, keeps focus (so people can dump several tasks in a row), fires a success haptic, and shows the toast `Added · Jev will fit it in`.
- **Parse preview:** while typing a task, a row of small chips sits directly above the bar showing what was understood, e.g. `⏱ 30 min` `📅 Tomorrow` `↻ Weekly` `! Important`. Chips are read-only; they disappear when nothing is recognized. The one exception is the project chip (see *Projects*), which is a button.

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

## Morning flow

Starting with easy wins builds momentum, but quick tasks never run out, so the warm-up is capped and the big task always gets its turn while energy is high.

- **When it's offered:** once a day, during your morning (from 2 hours before Jev's start hour until 4 hours after), when nothing is in progress and there's a big task or at least two quick ones. It replaces the Now card on Today: label `MORNING`, a title (`Warm up, then the big one`), three numbered lines (`3 quick ones · 20 min max`, `10 min on College study`, `Then anything you like`), Primary **Start my morning**, and Quiet **Not today**.
- **Quick ones:** tasks that can happen now, 15 minutes or less, in Jev's order. **The big one:** the most important task of 30 minutes or more (first in Jev's order among ties). Guided routines like laundry are never either.
- **Warm-up:** the Now card offers quick ones one at a time, labeled `Warm-up · 1 of 3`. It ends after 3 are done or 20 minutes have passed, whichever comes first, but never interrupts a task in progress.
- **The big one:** labeled `The big one`, with `Just 10 minutes. You can stop after.` Start opens lock-in with a 10-minute ring and no wrap-up nudge. When the ten minutes are up, the ring reads `You started · stop or keep going` and **I'm stuck** becomes **Stop here**, which puts the task back for later and shows `You started. That's the hard part.` Done works as usual.
- **Afterwards:** once the big one is done, stopped, or moved aside (Not now or Do something else), Jev picks as usual for the rest of the day.
- The session lives on the device, one per day.

## Sleep

Sleep is what everything else stands on. There are no set times. You tap **Going to bed** when you're done for the night and **I'm up** in the morning. Those two taps are the phone lock and the sleep log. The section is built from a few proven habits: a phone-free hour before sleep, a steady wake-up time, daylight soon after waking, no late caffeine, and getting up when you can't sleep. It gives no medical advice. Its one line about doctors is below.

### Settings (synced)

Sleep is stored in Jev's settings as `sleep`. Every client sends it back unchanged when it saves other settings. Jev keeps planning with *Your day*.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | bool | false | Phone-free nights. |
| `morningMinutes` | 0–180 | 60 | Phone-free time after **I'm up**. |
| `caffeineReminder` | bool | true | A nudge 8 hours before the usual bedtime. |

The shared pieces live in `@remember/domain` (`sleepSettingsSchema`, `sleepTip`, `median`, `minutesAfterEvening`, `sleepDurationLabel`, and the constants), and iOS mirrors them exactly.

### A night (iPhone)

- **Going to bed** starts phone-free right away, with the toast `Phone-free until you're up · Undo`. It appears on Today's evening card and on Life → Sleep.
- Remember shows one calm full-screen view instead of the app. It has three phases:
  - **Wind down** (the first 60 minutes). Label `WIND DOWN`, title `Lights out around 11:40 PM` (an hour after the tap). A checklist that resets each night: *Park tomorrow's thoughts*, *Phone on the charger, away from bed*, *Lights low*, *Something calm: shower, read, stretch*. The add bar reads `Park a thought for tomorrow…`. Anything added waits until 6 AM, the toast says `Parked for tomorrow`, and adding one checks the first item.
  - **Sleep time** (after that). The screen is nearly black. Title `Sleep time`, Primary **I'm up**, Secondary **Can't sleep?**, and the same add bar.
  - **Morning** (after **I'm up**, for `morningMinutes`). Label `GOOD MORNING`, title `Phone-free until 8:30 AM`, the check-in, and a checklist: *Get daylight: 10 minutes outside or by a window*, *Drink a glass of water*, *Move a little*.
- Every phase ends with Quiet **I need my phone**. It opens `Take a breath first`, a 60-second ring and the line `If you still need it after this, you get 15 minutes.` Then Primary **Unlock for 15 minutes** appears, with Quiet **Never mind**. Unlocking hides the screen and lifts the app block for 15 minutes, and then both come back.
- **I'm up** saves the night and starts the phone-free morning, or ends phone-free when `morningMinutes` is 0. The toast reads `Good morning · Undo`, and Undo goes back to sleep time. If nobody taps **I'm up**, phone-free ends by itself 14 hours after **Going to bed** and that night isn't saved.
- **Can't sleep?** is a sheet with three short steps: *Been awake a while? Get up.* / *Go somewhere else and keep the lights low.*; *Do something boring.* / *Read something dull or fold laundry. No screens.*; *Go back when you feel sleepy.* / *Not before. Your bed is for sleep.* Primary **Breathe with me** runs two minutes of slow breathing: in for 4 seconds, out for 6, with a circle that grows and shrinks (text only under Reduce Motion).

**The saved night.** It's a `sleep` health metric with `externalId` `remember.night.<key>`, where the key is the local date of **I'm up** minus 12 hours. Source `Remember`, unit `hr`, and `metadata` `{ aggregation: "remember_night", bedAt, rating?, latency? }`. `bedAt` is the **Going to bed** time. The metric runs from falling asleep (**Going to bed** plus the check-in's answer, or plus 0 until there is one) to **I'm up**. Saving again for the same night replaces it.

### Morning check-in (iPhone)

It shows on the phone-free morning screen after **I'm up**, and on Today afterwards (above the Now card) until it's answered, for up to 8 hours.
1. `How did you sleep?` with three equal buttons: **Rough**, **Okay**, **Great**.
2. If Apple Health has that night, it saves right away. Otherwise it asks `How long until you fell asleep?` with chips `Under 30 min`, `About an hour`, `1–2 hr` and `2+ hr` (15, 60, 90 and 150 minutes after **Going to bed**), then saves.
3. The toast reads `Saved · 7 hr 5 min`.

### Today's evening card (iPhone)

While phone-free nights are on and it isn't phone-free already, a card sits at the top of Today from 6 PM until 4 AM. Title `Done for the night?`, the line `Tap when you start winding down. Your phone stays quiet until you're up.`, and Secondary **Going to bed**.

### Life → Sleep

**Off:** the empty state (moon icon), title `Phone-free nights`, the line `Tap Going to bed when you're done for the night. Your phone stays quiet until you're up.`, and Secondary **Turn on**. That turns phone-free nights on and opens Settings.

**On**, top to bottom:
1. **Tonight card** (the hero). Label `TONIGHT`, title `Done for the night?`, and the line `Tap when you start winding down. Your phone stays quiet until you're up.` On iPhone it has Primary **Going to bed**. The web shows `Tap Going to bed on your iPhone.` instead. When last night is known (from the two taps or Apple Health), one more line reads `Last night 12:40 AM – 7:35 AM · 6 hr 55 min`.
2. **Last 7 nights.** The newest 7 nights keyed 0 to 7 days before today. One row per night, labeled by the evening's weekday (`Sun`), with an accent bar from falling asleep to getting up on a shared time axis. The usual bedtime and usual wake-up (medians) show as two faint vertical lines once there are 3 nights. Below it are three stats: average sleep (`6.8 hr`, *average*), usual bedtime (`12:40 AM`, *usual bedtime*, `—` before 3 nights), and the wake-up range (`1 hr 20 min`, *wake-up range*). With no nights, it shows one line: `No nights yet. Tap Going to bed tonight and I'm up tomorrow.`
3. **One tip** from `sleepTip`, as a card with a title and one line.
4. Secondary **Sleep settings**, which opens Settings.
5. A `text3` footer: `Trouble sleeping most nights for weeks? Bring it up with a doctor.`

**Nights** come from `sleep` health metrics, keyed by the date of the end time minus 12 hours (a saved night uses the key in its `externalId`). Apple Health nights (`metadata.aggregation` `healthkit_sleep_union`) give the times and hours. Saved nights give the rating, the time to fall asleep and the **Going to bed** time, plus the times when Apple Health has nothing for that night. A saved night never adds to Apple Health's hours anywhere (the Health segment's *Latest sleep* included). The usual bedtime is the median of the **Going to bed** times (or where Apple Health saw sleep start) as minutes after 6 PM, and the bedtime range is the latest minus the earliest.

### Settings → Sleep

A section right after Your day, and a first-run setup step after Your day titled `Phone-free nights?` (`Tap Going to bed when you're done for the night. Remember keeps your phone quiet until you're up.`).
- Toggle **Phone-free nights** (`Tap Going to bed; get your phone back after you're up`).
- When on: **Phone-free after waking** chips Off / 30 min / 1 hr / 1.5 hr, and the toggle **Caffeine reminder** (`8 hours before your usual bedtime`).
- iPhone only: toggle **Lock my phone** (`Blocks apps while phone-free. Calls and alarms still work.`), then **Apps you can still use** (the system app picker).

### Lock my phone (iPhone)

Screen Time. The app group holds the night's state: when **Going to bed** and **I'm up** were tapped, the phone-free morning length, any 15-minute unlock, and whether the lock is on. One rule decides the shield everywhere, including in the device-activity monitor when Remember is closed. Apps stay shielded from **Going to bed** until **I'm up** plus the phone-free morning (never more than 14 hours after **Going to bed**), except during an unlock. The shield covers every app category and website except the allowed apps. **Going to bed** starts a one-off interval that runs to the 14-hour cap, **I'm up** starts one that ends with the phone-free morning (at least 15 minutes, Screen Time's minimum), and an unlock starts one of 15 minutes. Each interval's start and end re-applies the rule.

**Nudge** (iPhone, when Gentle reminders are on): `Last call for caffeine` / `Caffeine after now can keep you up tonight.` It repeats daily, 8 hours before the usual bedtime, once Remember knows it (3 nights).

The web has Life → Sleep and Settings → Sleep. It doesn't have the lock, the phone-free screen, **Going to bed** or the check-in.

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
- **Project filter:** when there's at least one project, a chip row under the segments: `All · College · iOS app · Other` (Other is loose tasks). It filters Today and Later, and while a project is chosen the add bar files into it. In `All`, each row's meta line starts with its project's name.
- **Sections** (plain `text2` 13 semibold uppercase headers, no cards around sections):
  - `Today`: available now, in Jev's order.
  - `Later`: notBefore or scheduled in the future, sorted by time, with meta showing the day and time (`Thu 3:00 PM`).
  - `Daily basics`: chips, same as Today.
  - `Done today · 3`: collapsed by default (the one allowed disclosure, because it's non-essential).
- **Task row:** 56+ tall, `card` background, radius 22, 8 gap between rows (rows are separate cards, not one grouped list). Left: a 28 circle checkbox; tapping it completes the task (fills with accent + check, row fades out, toast `Done · Undo`). Middle: title (17 semibold, 2 lines max) and a meta line (`15 min · Thu 3 PM · ↻ Weekly · Important`). Tapping the row opens the **Task sheet**. Swipe right → Start (accent). Swipe left → Delete (danger, with undo). The web shows a hover-revealed `Start` button instead of swipe.
- **Task sheet:** editable title (large), `Start with…` first-step field, **How long** chips (5, 15, 30, 60, 90), **When** chips (Anytime, Tonight, Tomorrow, This weekend, Next week → notBefore), **Repeat** chips (Never, Daily, Weekly, Monthly), **Project** chips (None plus each active project, only when there is one), and an **Important** toggle. Primary **Start now**. Quiet danger **Delete**. Changes save automatically on dismiss, with no Save button.

## Plan → Calendar

- **Calendar:** keep the week strip and day agenda. Restyle with the tokens, and show Jev's planned blocks as rows with an accent left bar. Use `Connect calendar` as a Secondary button when not connected.

## Projects

Big areas of life, like *College* or *My app*, each with its own pile of tasks and a button that turns an hour into deep work on it. You never sort anything yourself: tasks file themselves, and a wrong guess is one tap to fix.

Projects are goals on the server (`/api/life/goals`), and a task belongs to a project through `goalId`. A project's `status` is `active`, `paused` or `completed`; only active ones get tasks filed into them. Goal progress is no longer shown.

### Plan → Projects

- **Card** per active or paused project (paused ones are dimmed, last). Title (20 bold rounded), a meta line `5 tasks · 2 hr 15 min` (open tasks and their total time; `No tasks yet` when empty), and `Next: Read chapter 4` in `text2` (the project's next task in Jev's order). Secondary **Work on it** starts a 60-minute block. Tapping the card opens the project sheet.
- **Project sheet:** the editable name (large, saves on dismiss), the open tasks as task rows (tap the circle to finish, tap a row for the task sheet), **How long** chips (30 min, 1 hr, 1.5 hr, default 1 hr), Primary **Work on it**, then Quiet **Pause** / **Resume** and Quiet **Finish project** (status `completed`, with Undo).
- **Empty:** title `What are you working on?`, line `Add one below, like College or My app.`

### Filing: where a new task goes

`fileTask(title, projects, tasks, focusProjectId) -> projectId | null`, identical on both platforms. It never asks.

1. **Context.** If a deep-work block is running, or Plan → Tasks is filtered to a project, that project.
2. **Words.** Otherwise each active project gets a score from the task's words (lowercased, split on anything that isn't a letter or digit, without the stop words below):
   - **+3** if a word of the project's name (3+ letters, not a stop word) is in the title. *College* matches `college essay`.
   - **+2** if the title matches the project's kit. A kit is chosen by the project's name:
     - *School* (name has college, school, class, course, uni, university, wgu, study, degree or semester): wgu, college, class, course, study, studying, exam, quiz, essay, paper, chapter, lecture, homework, assignment, mentor, professor, syllabus, rubric, midterm, semester, submit, submission, and course codes like `c683` or `D335` (one letter then 3–4 digits).
     - *Code* (name has app, ios, code, coding, dev, software, website or startup): app, ios, swift, swiftui, xcode, testflight, app store, bug, crash, build, deploy, release, ship, feature, screen, ui, ux, api, backend, frontend, code, refactor, commit, pr, merge, onboarding, paywall, simulator.
     - *Fitness* (name has gym, fitness, workout, training or health): gym, workout, lift, lifting, run, cardio, protein, stretch, mobility, legs, push, pull.
   - **+1 per earlier task**, up to 2 per word: for each word in the title, how many of the project's earlier tasks (any status but removed) contain it. Two earlier *gym* tasks in Health make the next one go there.
   - The best project wins if it scores **2 or more** and strictly beats every other. Otherwise the task stays **loose**: no project. Loose is always safe.
   - **Stop words:** a, an, the, and, or, to, of, for, in, on, at, by, with, my, me, i, it, is, be, do, get, got, go, make, need, have, gotta, should, want, some, this, that, up, out, about, from, task, tasks, thing, things, stuff, work, finish, start.
3. **Tests:** projects College and iOS app with no history: `Finish the WGU essay` → College; `Fix the sleep screen crash` → iOS app; `Email my mentor` → College; `Call mom` → loose; `Read chapter 5` → College; `Gym` → loose. With a project *Self care* holding two earlier *Gym* tasks: `Gym tomorrow` → Self care.

### The project chip

While typing a task, when at least one project exists, the parse preview starts with a project chip: `📁 College` in the accent when filed, or `📁 No project` in `text3` when loose. **Tapping it moves the task to the next active project, then No project, and around.** A tapped choice sticks until the bar is cleared. Submitting with a project shows the toast `Added to College`.

### Brain dump

Paste or say a whole messy paragraph and Remember turns it into separate tasks. `splitDump(text) -> [string]`:

1. Split on new lines, `;`, and sentence ends (`. `, `? `). Then split each piece on commas, **unless** a comma piece would be a single word (so `Buy eggs, milk, bread` stays one task).
2. When there are already two or more pieces, also split a piece on ` and ` / ` then ` / ` and then ` when both sides keep two or more words.
3. Clean each piece: drop leading filler (`ok`, `okay`, `so`, `also`, `and`, `then`, `plus`, `oh`, `um`, `uh`, `like`), then a leading `I need to`, `I have to`, `I've got to`, `I gotta`, `I should`, `I want to`, `need to`, `have to`, `gotta`, `remember to`, `don't forget to`. Trim trailing `.` and `?`.
4. A piece with no real words, only how long, when or how important (like `45 min`), joins the one before it. It's a dump only if two or more pieces remain; otherwise the text is one ordinary task. Separate lines and sentences are always separate tasks, even one word long (`Gym` on its own line).

Each piece then goes through quick-add parsing and filing on its own. The preview shows one chip, `4 tasks`, plus `2 → College` style chips per project (not tappable; fix any of them later in the task sheet). The toast reads `Added 4 tasks` with Undo, which removes all of them. Dictation on iPhone adds punctuation so spoken dumps split too.

*Example:* `ok i need to finish the WGU essay, fix the sleep screen crash, call mom, and email my mentor` → `Finish the WGU essay` (College), `Fix the sleep screen crash` (iOS app), `Call mom` (loose), `Email my mentor` (College).

### Deep work block (Work on it)

**Work on it** opens a full-screen block for one project. It replaces lock-in for that time and works through the project's tasks one at a time.

- **Header:** label `DEEP WORK · COLLEGE` in accent, and the hold-to-leave Quiet **End block** (press and hold 3 seconds).
- **The task:** the project's next task in Jev's order that can happen now (open, not held for later). It becomes the current task automatically. Title (30 bold), `Start with:` if any, and the line `2 done · 3 to go`.
- **The ring** counts down the whole block (not the task), from when it started, and can't be paused. At zero it reads `Block done · finish when ready` in the accent.
- **Buttons:** Primary **Done** finishes the task (the usual `Done · Undo` toast) and the next one appears right away, with no win screen in between. Secondary **I'm stuck** opens the Stuck sheet; *Do something else* moves the task aside and the next one appears. After the ring hits zero, the Secondary becomes **Wrap up**.
- **Add bar:** `Add to College…`. Everything typed here is filed into this project, and if the project had run dry the new task becomes current.
- **Nothing left:** title `College is clear`, line `Add what's next below, or wrap up.`, Primary **Wrap up**.
- **Ending** (Wrap up or End block): the current task goes back to the list, then a two-second win moment, `Deep work done.` / `3 done for College.` (or just closes when nothing was done).
- **Blocking (iOS, Focus mode on):** apps stay blocked for the whole block, capped at its length plus 10 minutes.
- The block lives on the device: `{ projectId, startedAt, minutes }`. Reopening the app during a block goes straight back to it. A block ends by itself 4 hours after it started.

## Library, Ask, Life

- **Library:** search field in the header area (`card` capsule). Filters become one horizontal chip row. Items are rows with a thumbnail and title. Keep Saved · Patterns. Patterns keeps its content but uses the new cards and buttons, and its sub-tabs become chips.
- **Ask:** the empty state shows three suggestion chips and one `Think through a decision` Secondary button. The composer becomes the white add bar.
- **Life:** Health, Money, and Files use the new header, cards, and empty states (icon, one line, Secondary button). Money's `Add an account` becomes a Secondary button in the section header, not the add bar.

## Jev sheet

Opened from the Today status line. Contents: a toggle `Let Jev plan my day`, planning hours (two time pickers), a `What Jev should know` free text field (preferences), and a line `Last planned 2 min ago`. That's all.

## Toasts

One toast at a time, pinned above the add bar. `card` background, white text, and an optional accent `Undo` button. Auto-dismisses after 8 s when it offers Undo, 4 s otherwise. Errors use the same toast with danger text. Replace blocking error alerts with toasts wherever the action is retryable.

## Accessibility

Contrast: `text2` on `card` must pass AA (it does at 0.64). Every icon-only control has a label. Dynamic Type is respected, and rows grow instead of truncating. Reduce Motion disables the pulse and fade animations. The swipe actions have accessible custom-action equivalents.

## Setup: one place for everything (also the first-run onboarding)

All configuration lives in **Settings**, which opens from the avatar. There are no settings anywhere else. The Jev status line on Today opens Settings too. The first time someone signs in, and while they have no commitments and haven't finished setup, the same sections run as a skippable step-by-step flow: *Welcome → Your day → Sleep → Commitments → Chores → Focus → Nudges → Done*. Every step has one primary **Next** button and a quiet **Skip**. The final step says "Jev is planning your day" and lands on Today.

Settings sections, in order:

1. **Your day.** Four large choices: *Early bird* (6 AM–9 PM), *Regular* (8 AM–10 PM), *Night owl* (12 PM–3 AM) and *Custom*, which reveals two time pickers labeled "I wake up" and "I wind down". These write Jev's `startHour` and `endHour`, and an end before the start means after midnight. It also includes **Let Jev plan my day** (on/off).
2. **Sleep.** See *Settings → Sleep* above.
3. **Commitments.** Things you do most days that must fit around everything else. Each row shows the title, days and length, and tapping it opens the editor. There's a quiet `+ Add commitment` row. **Templates** appear as tappable chips when the list is empty and under the add row:
   - *College study*: every day, 2 hr, Must do
   - *Coursework*: weekdays, 1 hr, Must do
   - *Gym*: Mon/Wed/Fri, 1 hr, Important
   - *Walk*: every day, 20 min, Nice
4. **Chores.** Things that keep life running. The row shows the title and rhythm ("Laundry · weekly"). Templates:
   - *Laundry*: weekly, 30 min active, with guided steps (below)
   - *Dishes*: daily, 15 min
   - *Take out trash*: weekly, 5 min
   - *Groceries*: weekly, 45 min
   - *Clean bathroom*: weekly, 30 min
   - *Change sheets*: every 2 weeks, 15 min
5. **Focus mode.** iOS only. *Block distracting apps while I focus* (on/off), then *Choose apps* (the system app picker). There is no length setting, because blocking follows the task (see Lock-in mode).
6. **Nudges.** *Gentle reminders* (on/off). This controls notifications for the next planned thing, "wrap up in 5 minutes", and wait steps finishing. Each is sent once and never repeated.
7. **About me for Jev.** The free-text preferences field.
8. Account, appearance and data: the existing settings, unchanged.

**Commitment editor.** One sheet, top to bottom:
- **Name:** large text.
- **Days:** seven round chips (S M T W T F S), plus quick chips *Every day* and *Weekdays*.
- **Time:** *Jev picks* (default) or *At a set time*, which reveals a time picker.
- **How long:** chips for 15, 30, 45 min and 1, 1.5, 2, 3 hr.
- **How important:** three big choices. *Must do* (always planned first), *Important*, *Nice to do*.
- **Delete:** quiet, with undo.

**Chore editor.**
- **Name.**
- **How often:** *Every day*, *Every few days* (3), *Weekly*, *Every 2 weeks*, *Monthly*.
- **Best days (optional):** the seven day chips. None selected means any day.
- **Active time:** the length chips.
- **Steps:** an editable list. Each step has a title and an optional *wait* (minutes, for hands-off time like a washer). You can reorder, delete and add steps.

**Server model:** `POST/PATCH/DELETE /api/life/commitments`, with commitments returned in the `GET /api/life` snapshot as `commitments`. Fields:

| Field | Type | Meaning |
|---|---|---|
| `title` | text | The name shown everywhere. |
| `kind` | `commitment` or `chore` | Which section it lives in. |
| `days` | bitmask | Sunday = 1, Monday = 2, … Saturday = 64. |
| `everyDays` | number | Chores only: how many days between occurrences. |
| `fixedStart` | `"HH:MM"` or null | Null means Jev picks the time. |
| `durationMinutes` | number | Active time. |
| `importance` | `must`, `high` or `normal` | *Must do*, *Important* or *Nice to do*. |
| `steps` | list | Each step is `{ title, waitMinutes? }`. |

The server turns each commitment into dated tasks for the next 7 days, linked by `commitmentId` and `occurrenceDate`:
- **Commitments:** one task per matching day, due by the end of that day. Missed days are cleared quietly.
- **Chores:** always exactly one open task, which comes back `everyDays` after it's done.
- **Planning:** Jev plans these tasks with everything else, and *Must do* commitments always get a slot, first.

## Laundry and other guided routines

When a task has a `commitmentId` whose commitment has steps, **Start** opens lock-in mode in routine form. It shows one step at a time, as a big title with a `Next step` primary button, plus a progress line ("Step 2 of 7").

Routines **never block apps**, because laundry is something you do alongside other things.

A step with `waitMinutes` has one primary button, *Start 45-min timer*. Tapping it:
- **Moves the routine to the background.** Lock-in closes and the task is set back to `queued` with `notBefore` at the wait's end, so Jev immediately offers something else to do meanwhile. The step index and wait end are kept on the device.
- **Schedules one nudge** for when the wait ends: "Washer's done. Next: Move clothes to the dryer." It uses the next step's title.
- **Adds a strip to Today**, under the header, labeled "In the background". It shows a row per running routine ("Laundry · Washer running · 32 min left"). When the wait is over, the row changes to "Washer's done · Move clothes to the dryer" with a *Continue* button. Tapping a row reopens the routine at the right step.

During a wait, the routine screen shows the countdown and one button, *It's done already*. That ends the wait early and makes the task current again.

Finishing the last step completes the task, and the chore comes back on its rhythm.

**Default Laundry steps:**
1. Gather dirty clothes
2. Start the washer
3. Washer running (wait 45)
4. Move clothes to the dryer
5. Dryer running (wait 50)
6. Fold everything
7. Put it all away

## Lock-in mode (what Start opens)

A full-screen view replaces the Now card's in-place timer. It holds:
- **Task:** the title, and the current step (or the "Start with" first step).
- **Get ready:** a checklist of three optional taps, *Phone face down*, *Water nearby* and *Close everything else*. It's hidden after the first minute.
- **Countdown:** a large ring counting down the task's duration, since time blindness is real. Tap the ring to pause. When the time is up, the ring keeps counting up in the accent color and nothing alarms.
- **Buttons:** a primary **Done**, a secondary **I'm stuck** (the existing Stuck sheet), and a quiet **Leave focus**, which you have to *press and hold for 3 seconds*.

**Blocking (iOS, Focus mode on).** Starting a task that isn't a routine blocks the chosen apps with a Screen Time shield. The block lasts until Done or Leave focus, capped at the task's length plus 10 minutes. The cap is at least 15 minutes, because that's the shortest block Screen Time allows. A scheduled device-activity interval lifts the shield at the cap even if the app is closed. Routines never block. The web shows the same screen without blocking.

After **Done**, a two-second win moment appears: the accent check and "Done. That's 3 today." Then it returns to Today.

## Time estimates instead of 15 minutes for everything

Quick add estimates duration when the text doesn't say. `estimateMinutes(title, history)` uses, in order:
1. **Your history:** the median `actualMinutes` of the last three completed tasks with the same title (case-insensitive).
2. **Known tasks:** whole-word, checked longest first (so "run errands" is 45).

   | Minutes | Words |
   |---|---|
   | 5 | text, trash, meds |
   | 10 | email, call, pay, bills, rent, book |
   | 15 | dishes, shower, tidy, water plants |
   | 20 | walk, vacuum |
   | 30 | laundry, run, clean, read, meeting |
   | 40 | cook, dinner |
   | 45 | groceries, errands |
   | 60 | gym, workout, study, homework, meal prep, project, write |

3. **Otherwise** 15.

The preview chip shows `~30 min` when estimated, and `30 min` when typed.
