import { ArrowRight, CalendarBlank, CheckCircle, ListChecks } from "@phosphor-icons/react";
import type { Page } from "../types";
import type { CalendarEvent } from "./types";
import type { LifeOSController } from "./useLifeOS";

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function eventTime(event: CalendarEvent) {
  if (event.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.startAt));
}

function sameDay(value: string, day: Date) {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

export function LifeOverview({ life, onNavigate }: { life: LifeOSController; onNavigate: (page: Page) => void }) {
  const { snapshot } = life;
  const today = new Date();
  const active = snapshot.tasks.find((task) => task.status === "active");
  const nextPlanned = life.brain?.settings.enabled ? life.brain.plan.find((block) => snapshot.tasks.some((task) => task.id === block.taskId && ["queued", "inbox"].includes(task.status))) : undefined;
  const focusTitle = active?.title ?? nextPlanned?.title ?? (life.brain?.settings.enabled ? "Room in your day" : "No task selected");
  const focusDetail = active ? active.firstStep : nextPlanned ? new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: life.brain?.settings.timeZone }).format(new Date(nextPlanned.startAt)) : life.brain?.settings.enabled ? "Jev will choose your next task when it fits." : "Choose one task when you’re ready.";
  const nextEvent = snapshot.events
    .filter((event) => event.status !== "cancelled" && new Date(event.endAt).getTime() >= Date.now())
    .sort((left, right) => left.startAt.localeCompare(right.startAt))[0];
  const floorComplete = snapshot.floor.filter((item) => item.completionDates.some((value) => sameDay(value, today))).length;
  const nextEventLabel = nextEvent ? `${sameDay(nextEvent.startAt, today) ? "Today" : shortDate(nextEvent.startAt)} · ${eventTime(nextEvent)}` : "Nothing scheduled";

  if (life.loading) {
    return <section className="life-overview life-overview-loading" aria-label="Today’s plan" aria-busy="true">
      <div className="feature-loading" role="status"><span className="login-spinner" /><span>Loading today’s plan…</span></div>
    </section>;
  }

  return <section className="life-overview" aria-label="Today’s plan">
    <div className="today-brief">
      <article><span className="today-brief-icon"><ListChecks size={19} /></span><div><span className="section-kicker">Up next</span><strong>{focusTitle}</strong><p>{focusDetail}</p></div><button type="button" onClick={() => onNavigate("tasks")}>Tasks <ArrowRight size={14} /></button></article>
      <article><span className="today-brief-icon"><CalendarBlank size={19} /></span><div><span className="section-kicker">Next event</span><strong>{nextEvent?.title ?? "Your calendar is open"}</strong><p>{nextEventLabel}</p></div><button type="button" onClick={() => onNavigate("calendar")}>Calendar <ArrowRight size={14} /></button></article>
      <article><span className="today-brief-icon"><CheckCircle size={19} /></span><div><span className="section-kicker">Daily basics</span><strong>{snapshot.floor.length ? `${floorComplete} of ${snapshot.floor.length} done` : "None added yet"}</strong><p>{snapshot.floor.length ? "Keep the basics easy to finish." : "Add the few things you want to do every day."}</p></div><button type="button" onClick={() => onNavigate("tasks")}>Daily basics <ArrowRight size={14} /></button></article>
    </div>
  </section>;
}
