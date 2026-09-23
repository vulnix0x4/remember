# Jev for everyday planning

Today shows **Your next steps** on web and iPhone. Once connected, Jev automatically ranks the person's tasks and chooses suitable parts of the day. Remember turns those judgments into a seven-day plan around existing calendar commitments. The next confidently ranked task becomes the current focus when its slot arrives, provided nothing else is active. A current task is never interrupted automatically.

## OpenRouter setup

The server calls OpenRouter's [Decisions endpoint](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request): `POST https://openrouter.ai/api/alpha/decisions`, with model `typesafe/jev-1.13`. This is a structured decision request, not a chat completion. It uses the existing server secret **OPENROUTER_API_KEY**. No TypeSafe key is needed.

For development, put the key in ignored `apps/api/.dev.vars`, apply local migrations with `pnpm --filter @remember/api db:migrate`, and run the API. Point web `VITE_API_BASE` or the iPhone API configuration to that server. Never put the key in a web environment variable or iPhone bundle.

Before production release, apply migration `0008_jev_planning.sql` with the other pending migrations to the intended production database, ensure the Worker has its OpenRouter secret, and deploy the API plus clients. The Worker configuration includes a planning cron every fifteen minutes. If the key is already configured for analysis, reuse it. Otherwise, from `apps/api`:

```sh
pnpm exec wrangler secret put OPENROUTER_API_KEY --env production
```

## Automatic decisions

- The first authenticated client sync enables planning with the device's time zone. The Today switch pauses or resumes it; preferences and planning hours persist on the server. Device time-zone changes update the planning zone.
- Relevant task, calendar, goal, health, and memory changes invalidate the saved plan. API mutations request a refresh immediately, visible clients sync every minute, and the Worker checks due plans every fifteen minutes while the app is closed. This is periodic scheduling, not an exact-time alarm or push notification.
- Jev scores up to forty unscheduled tasks per pass and chooses morning, afternoon, evening, or any time. The scheduler respects task duration, release dates, future deadlines, local planning hours, timed calendar events with five-minute buffers, and existing manual slots. Tasks outside the seven-day horizon or without a suitable slot stay visible as unscheduled. All-day events are context, not hard time blocks.
- Scores below one or confidence below 0.65 are not scheduled. Automatic focus requires at least 0.8 confidence. These are conservative product thresholds, not calibrated guarantees. Manually assigned slots stay fixed; conflicting commitments prevent automatic focus activation.
- Set a task to repeat daily, weekly, or every thirty days in the task composer. Completing it atomically creates exactly one next occurrence, released that interval after completion. Jev then finds an opening. This is completion-based repetition, not a fixed weekday recurrence. Add laundry once with a duration and repeat interval; later occurrences need no re-entry.

The provider receives bounded task details and notes, active goals, upcoming calendar titles/times, saved preferences, kept principles, recent personal thoughts, task outcomes/blockers, and recent sleep/exercise summaries. Bank records, file contents, and the full library are not sent. Preferences guide model judgments; hard exclusions should be represented by calendar commitments and planning hours. Generated slots appear in Remember's Plan calendar; external calendars are not edited.

## Reliability and scope

Plans and preferences are persisted per account and included in server exports. Database revisions and inference leases prevent overlapping requests and reject decisions made against changed context. Pausing while a decision is running prevents that decision from being applied. Completing a recurring task twice does not create duplicate occurrences.

Provider failures preserve the last plan and retry after five minutes. Missing credits, missing keys, and malformed responses are visible in Today; there is no pretend AI fallback. Offline task capture remains available, but automatic planning requires the authenticated server and OpenRouter.

This implements automatic task selection, timing, and recurring chores. It does not perform physical chores, send messages, make purchases, move external events, or replace all other AI features in Remember. Content analysis and Ask keep their existing models. Learning uses saved context and outcomes; it does not train a personalized model.

Tests cover the OpenRouter contract, local/DST scheduling, calendar buffers, recurring release dates, atomic recurrence, stale decisions, pause races, account isolation, failure backoff, and web controls. A live provider response and production cron must be verified in the configured deployment before considering the feature live.
