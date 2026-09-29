import { z } from "zod";

/**
 * Sleep with no set times: tap Going to bed when you're done for the night and I'm up in the morning.
 * Those two taps are the phone lock and the sleep log. Clock times are local "HH:MM".
 */
export const sleepSettingsSchema = z.object({
  /** Phone-free nights: the Going to bed button, the phone-free screen, and the morning check-in. */
  enabled: z.boolean().default(false),
  /** Phone-free time after I'm up. */
  morningMinutes: z.number().int().min(0).max(180).default(60),
  /** A nudge 8 hours before the usual bedtime, once Remember knows it. */
  caffeineReminder: z.boolean().default(true),
});

export type SleepSettings = z.infer<typeof sleepSettingsSchema>;

/** The first hour after Going to bed is for winding down; after that it's sleep time. */
export const SLEEP_WIND_DOWN_MINUTES = 60;
/** Phone-free ends by itself this long after Going to bed if nobody taps I'm up. */
export const SLEEP_MAX_HOURS = 14;
/** How a night saved by the two taps (and the morning check-in) is marked in health metrics. */
export const SLEEP_NIGHT_MARKER = "remember_night";
/** Apple Health nights, uploaded by the iPhone. */
export const SLEEP_HEALTH_MARKER = "healthkit_sleep_union";
/** The usual bedtime needs this many nights. */
export const SLEEP_MIN_NIGHTS = 3;

export function clockMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function clockTimeFrom(minutes: number) {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** Minutes after 6 PM, so times on either side of midnight compare simply (11 PM = 300, 2 AM = 480, 8 AM = 840). */
export function minutesAfterEvening(time: string) {
  return (clockMinutes(time) - 18 * 60 + 1440) % 1440;
}

/** The middle value, or null for none. Clock times go in as minutes after 6 PM. */
export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/** A week of nights, reduced to the numbers the tip needs. Times are minutes after 6 PM. */
export interface SleepWeekNumbers {
  nights: number;
  averageHours: number | null;
  /** Median bedtime: when Going to bed was tapped, or when Apple Health saw sleep start. */
  usualBedtime: number | null;
  bedtimeRangeMinutes: number | null;
  wakeRangeMinutes: number | null;
  /** From the check-in's "How long until you fell asleep?". */
  averageLatencyMinutes: number | null;
  latencyAnswers: number;
}

export interface SleepTip { title: string; line: string }

/** "1 hr 30 min", "2 hr", "45 min". */
export function sleepDurationLabel(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60), rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** The one tip worth acting on. The first rule that matches wins. */
export function sleepTip(week: SleepWeekNumbers): SleepTip {
  if (week.nights < SLEEP_MIN_NIGHTS) {
    return { title: "Two taps a day", line: "Going to bed at night, I’m up in the morning. That’s how Remember learns your nights." };
  }
  if ((week.wakeRangeMinutes ?? 0) > 60) {
    return { title: "Same wake-up time, every day", line: "Weekends too. It’s the single biggest fix." };
  }
  if ((week.bedtimeRangeMinutes ?? 0) > 90) {
    return { title: "Keep bedtime steady", line: `Your bedtime moved by ${sleepDurationLabel(week.bedtimeRangeMinutes ?? 0)} this week. Steadier nights make easier mornings.` };
  }
  if (week.latencyAnswers >= SLEEP_MIN_NIGHTS && (week.averageLatencyMinutes ?? 0) > 45) {
    return { title: "Slow to fall asleep?", line: "Give the wind-down a real hour. If you’re awake after 20 minutes, get up for a bit." };
  }
  if (week.averageHours !== null && week.averageHours < 7) {
    return { title: "You’re short on sleep", line: `About ${week.averageHours.toFixed(1)} hr a night. Try Going to bed 30 minutes earlier.` };
  }
  if (week.usualBedtime !== null && week.usualBedtime > minutesAfterEvening("01:00")) {
    return { title: "Get daylight early", line: "10 minutes outside within an hour of waking moves your body clock earlier." };
  }
  return { title: "You’re on track", line: "Keep your nights steady, even on weekends." };
}
