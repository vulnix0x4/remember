import {
  SLEEP_HEALTH_MARKER,
  SLEEP_MIN_NIGHTS,
  SLEEP_NIGHT_MARKER,
  clockMinutes,
  clockTimeFrom,
  median,
  minutesAfterEvening,
  sleepDurationLabel,
  type SleepWeekNumbers,
} from "@remember/domain";
import { dayKey } from "./morning";
import type { HealthMetric } from "./types";

/**
 * Sleep on the web: the nights we know about and the week's numbers. There are no set times: the
 * iPhone saves a night when someone taps Going to bed and then I'm up, and Apple Health adds its own.
 * The tip and its rules live in @remember/domain (`sleepTip`).
 */

/* ---------- Clock and calendar ---------- */

/** "11:30 PM", or "11 PM" on the hour. */
export function clockLabel(time: string) {
  const minutes = clockMinutes(time);
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "AM" : "PM"}`;
}

/** Local "HH:MM" of a moment. */
export function clockOf(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** A clock time given as minutes after 6 PM: "12:40 AM". */
export function eveningLabel(minutes: number) {
  return clockLabel(clockTimeFrom(minutes + 18 * 60));
}

/** The local day `days` after a "YYYY-MM-DD" day. */
export function addDays(key: string, days: number) {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + days, 12));
}

/** "Sun", or "Sunday" when `long`. */
export function weekdayLabel(key: string, long = false) {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: long ? "long" : "short" }).format(new Date(year, month - 1, day, 12));
}

/** The evening a night belongs to, from when it ended: the local date 12 hours before getting up. */
export function nightKey(endAt: string | Date) {
  const date = new Date(endAt);
  date.setHours(date.getHours() - 12);
  return dayKey(date);
}

/* ---------- Nights from health data ---------- */

export interface SleepNight {
  /** The evening the night belongs to, "YYYY-MM-DD". */
  key: string;
  asleepAt: Date;
  wokeAt: Date;
  hours: number;
  /** When Going to bed was tapped, for a saved night. */
  bedAt: Date | null;
  /** From the check-in: minutes from Going to bed until they fell asleep. */
  latencyMinutes: number | null;
  /** Apple Health measured it, so its times and hours win. */
  measured: boolean;
  /** Going to bed and I'm up were tapped for it. */
  saved: boolean;
}

export function isHealthNight(metric: HealthMetric) {
  return metric.type === "sleep" && metric.metadata.aggregation === SLEEP_HEALTH_MARKER;
}

/** A night saved by Going to bed and I'm up (and the check-in). */
export function isSavedNight(metric: HealthMetric) {
  return metric.type === "sleep" && metric.metadata.aggregation === SLEEP_NIGHT_MARKER;
}

export function savedNightId(key: string) { return `remember.night.${key}`; }

/** A saved night names its evening in its externalId, so a late get-up after noon can't move it. */
function savedNightKey(metric: HealthMetric) {
  return /^remember\.night\.(\d{4}-\d{2}-\d{2})$/.exec(metric.externalId ?? "")?.[1] ?? null;
}

function usable(metric: HealthMetric) {
  const start = Date.parse(metric.startAt); const end = Date.parse(metric.endAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && Number.isFinite(metric.value) && metric.value > 0;
}

function newest(current: HealthMetric | undefined, next: HealthMetric) {
  return !current || next.createdAt.localeCompare(current.createdAt) > 0 ? next : current;
}

/** `bedAt` is an ISO time. */
function bedAtOf(metric: HealthMetric | undefined) {
  const value = metric?.metadata.bedAt;
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time) : null;
}

/** `latency` is minutes, stored as a number or a string. */
function latencyOf(metric: HealthMetric | undefined) {
  const value = metric?.metadata.latency;
  const minutes = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

/**
 * One entry per night, oldest first, keyed by the evening's date (12 hours before getting up; a saved
 * night uses the key in its externalId). Apple Health gives the times and hours. A saved night gives the
 * Going to bed time and how long it took to fall asleep, plus the times when Apple Health has nothing.
 * A saved night never adds to Apple Health's hours.
 */
export function sleepNights(health: HealthMetric[]): SleepNight[] {
  const measured = new Map<string, HealthMetric>();
  const saved = new Map<string, HealthMetric>();
  for (const metric of health) {
    const nights = isHealthNight(metric) ? measured : isSavedNight(metric) ? saved : null;
    if (!nights || !usable(metric)) continue;
    const key = (nights === saved ? savedNightKey(metric) : null) ?? nightKey(metric.endAt);
    nights.set(key, newest(nights.get(key), metric));
  }
  return [...new Set([...measured.keys(), ...saved.keys()])].sort().map((key) => {
    const fromHealth = measured.get(key);
    const tapped = saved.get(key);
    const times = (fromHealth ?? tapped)!;
    return {
      key, asleepAt: new Date(times.startAt), wokeAt: new Date(times.endAt), hours: times.value,
      bedAt: bedAtOf(tapped), latencyMinutes: latencyOf(tapped), measured: Boolean(fromHealth), saved: Boolean(tapped),
    };
  });
}

/**
 * Last night, from Going to bed and I'm up or from Apple Health: the newest night keyed today or
 * yesterday (today's key belongs to someone who got up after noon).
 */
export function lastNight(nights: SleepNight[], now: Date) {
  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  return [...nights].reverse().find((night) => night.key === today || night.key === yesterday) ?? null;
}

/** "Last night 12:40 AM – 7:35 AM · 6 hr 55 min". */
export function lastNightLine(night: SleepNight) {
  return `Last night ${clockLabel(clockOf(night.asleepAt))} – ${clockLabel(clockOf(night.wokeAt))} · ${sleepDurationLabel(night.hours * 60)}`;
}

/* ---------- The last seven nights ---------- */

/** The newest seven nights keyed 0 to 7 days before today (today included), oldest first. */
export function recentNights(nights: SleepNight[], now: Date, count = 7) {
  const today = dayKey(now);
  const from = addDays(today, -7);
  return nights.filter((night) => night.key >= from && night.key <= today).slice(-count);
}

/** When the night began: Going to bed, or where Apple Health saw sleep start. Minutes after 6 PM. */
export function bedtimeOf(night: SleepNight) {
  return minutesAfterEvening(clockOf(night.bedAt ?? night.asleepAt));
}

export function wakeTimeOf(night: SleepNight) {
  return minutesAfterEvening(clockOf(night.wokeAt));
}

export interface SleepWeek extends SleepWeekNumbers {
  /** Median getting-up time, minutes after 6 PM, once there are enough nights. */
  usualWake: number | null;
}

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const spread = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : null;

/** The week's numbers. The usual times need a few nights before they mean anything. */
export function sleepWeek(nights: SleepNight[]): SleepWeek {
  const bedtimes = nights.map(bedtimeOf);
  const wakes = nights.map(wakeTimeOf);
  const latencies = nights.flatMap((night) => night.latencyMinutes === null ? [] : [night.latencyMinutes]);
  const known = nights.length >= SLEEP_MIN_NIGHTS;
  return {
    nights: nights.length,
    averageHours: average(nights.map((night) => night.hours)),
    usualBedtime: known ? median(bedtimes) : null,
    bedtimeRangeMinutes: spread(bedtimes),
    wakeRangeMinutes: spread(wakes),
    averageLatencyMinutes: average(latencies),
    latencyAnswers: latencies.length,
    usualWake: known ? median(wakes) : null,
  };
}

/** "6.8 hr". */
export function hoursLabel(hours: number) { return `${hours.toFixed(1)} hr`; }

/* ---------- The chart's shared time axis ---------- */

export interface SleepChart {
  bars: Map<string, { left: number; width: number }>;
  /** The usual bedtime and wake-up, as percentages across the axis, once they're known. */
  lines: { bed: number | null; wake: number | null };
  /** Where the axis starts and ends, as clock times. */
  from: string;
  to: string;
}

/**
 * Places every night on one axis in minutes after 6 PM, rounded out to whole hours, with the usual
 * bedtime and wake-up as reference lines. Positions are percentages.
 */
export function sleepChart(nights: SleepNight[], usual: { bed: number | null; wake: number | null }): SleepChart {
  const spans = nights.map((night) => {
    const start = minutesAfterEvening(clockOf(night.asleepAt));
    // The axis is clock time, so a bar ends where the clock read when they got up (right across a DST change too).
    const onClock = (clockMinutes(clockOf(night.wokeAt)) - clockMinutes(clockOf(night.asleepAt)) + 1440) % 1440;
    return { key: night.key, start, end: start + (onClock || (night.wokeAt.getTime() - night.asleepAt.getTime()) / 60_000) };
  });
  const marks = [usual.bed, usual.wake].filter((mark): mark is number => mark !== null);
  const from = Math.floor(Math.min(...spans.map((span) => span.start), ...marks) / 60) * 60;
  const to = Math.ceil(Math.max(...spans.map((span) => span.end), ...marks) / 60) * 60;
  const place = (minutes: number) => ((minutes - from) / Math.max(60, to - from)) * 100;
  return {
    bars: new Map(spans.map((span) => [span.key, { left: place(span.start), width: place(span.end) - place(span.start) }])),
    lines: { bed: usual.bed === null ? null : place(usual.bed), wake: usual.wake === null ? null : place(usual.wake) },
    from: clockTimeFrom(from + 18 * 60),
    to: clockTimeFrom(to + 18 * 60),
  };
}
