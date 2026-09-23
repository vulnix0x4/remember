# Remember design direction

## Product promise

Remember is a quiet, private place to save what matters and find it when it becomes useful. It should feel immediately understandable, with one obvious action on each screen and no product jargon to learn.

## Information architecture

The iPhone app and website share five destinations:

- **Today:** the current task, next calendar event, daily basics, one resurfaced save, and recent saves.
- **Plan:** Tasks, Calendar, and Goals in one planning area.
- **Library:** saved items and source-backed Patterns.
- **Ask:** a focused conversation where answers link back to saved sources.
- **Life:** Health, Money, and Files without dashboard clutter.

Settings belongs behind the profile control. Save is always available as a global action. Secondary sections use local segmented navigation instead of adding more primary tabs.

## Visual thesis

Remember should feel like a calm, private companion: mineral black and warm off-white, a restrained jade accent for action and selection, semantic typography, and generous space. It follows the device appearance by default and supports both light and dark modes equally.

Content leads. Source artwork is used when it adds meaning; decoration never competes with it. Cards group real objects, not arbitrary sections. Lightning bolts, sparkles, fake analytics, ornamental arcs, all-caps labels, and generic AI imagery do not belong in the product.

## Interaction thesis

1. Each screen has one clear primary action and familiar native or web controls.
2. Saving acknowledges success immediately while analysis continues in the background.
3. Forms keep the user's input when a request fails and explain how to recover.
4. Empty, loading, offline, partial, denied, and error states are honest and useful.
5. Secondary detail appears progressively, without hiding common actions behind a More destination.
6. Motion explains continuity and feedback, stays brief, and respects reduced-motion preferences.

## Control hierarchy

Remember uses direct manipulation before disclosure. A user should see the available choices whenever the set is small enough to understand at a glance.

- Two to five choices use a visible segmented control or labeled choice buttons. They never use a dropdown.
- Six to twelve short choices use a wrapping choice grid or a horizontally scrollable chip row when scanning is faster than searching.
- Long lists such as currencies use a searchable sheet with a checkmark on the current value, keyboard and VoiceOver support, and one-tap selection.
- Related records such as finance accounts appear as readable rows with their useful context, not as opaque identifiers in a menu.
- Dates and times use the platform date controls. Quantities use a number field or stepper appropriate to the range.
- Common actions are visible buttons or row actions. Ellipsis and More menus are reserved for genuinely rare secondary actions, never core navigation or form completion.
- Selection state is communicated with a checkmark, shape, and text treatment in addition to color. Every choice target is at least 44 points tall on iPhone and 44 CSS pixels on touch web layouts.

## Surface principles

- **Today:** concise orientation, not a dashboard of every metric.
- **Tasks:** a persistent focus timer, clear pause and resume, a small queue, and straightforward daily basics.
- **Calendar:** a compact date selector and a readable agenda with honest permission states.
- **Goals:** outcomes, progress, and an explicit path to create a related task.
- **Library:** fast search, simple filters, recognizable source art, and quiet processing states.
- **Saved item:** source context first, then key ideas, moments, takeaways, relevance, and related saves when available.
- **Patterns:** topics, takeaways, contrasts, and history presented as source-backed observations rather than certainty.
- **Ask:** short prompts, readable answers, and citations that reopen the supporting save or timestamp.
- **Health:** useful movement and recovery context without moralized scores or invented zero values.
- **Money:** currency-correct accounts and activity without fake totals across unlike currencies.
- **Files:** upload, search, download, export, and delete controls that work on both platforms.
- **Settings:** appearance, privacy, permissions, portable export, version, and sign-out in familiar groups.

## System

- One jade accent for action and selection; status uses semantic colors and plain language.
- Semantic system colors and type on iOS; equivalent accessible tokens on the web.
- Self-hosted Manrope for web interface text and Newsreader only for restrained editorial moments; native iOS uses San Francisco through semantic text styles.
- Compact corner radii and borders for structure; shadows only for overlays or meaningful elevation.
- Phosphor icons on web and SF Symbols on iOS, each paired with an accessible name.
- Source media is preferred to generated decoration. The existing Remember mark remains the shared app and browser identity.

## Accessibility contract

- WCAG AA contrast at minimum and no meaning communicated only through color.
- Keyboard access, visible focus, predictable Back behavior, and focus-managed dialogs on web.
- At least 44 by 44 point touch targets, Dynamic Type, VoiceOver labels, safe areas, Reduce Motion, and semantic system colors on iOS.
- Layouts remain usable at narrow phone widths, large browser zoom, and XXXL Dynamic Type.
- Every actionable icon has a clear label; every error is announced and leaves a recovery path.
