import { describe, expect, it } from "vitest";
import { brainSettingsSchema, median, minutesAfterEvening, sleepDurationLabel, sleepSettingsSchema, sleepTip, type SleepWeekNumbers } from "../src";

const week = (extra: Partial<SleepWeekNumbers> = {}): SleepWeekNumbers => ({
  nights: 7, averageHours: 7.6, usualBedtime: minutesAfterEvening("23:30"), bedtimeRangeMinutes: 40,
  wakeRangeMinutes: 30, averageLatencyMinutes: 20, latencyAnswers: 5, ...extra,
});

describe("sleep", () => {
  it("is off by default, has no set times, and survives old settings without it", () => {
    expect(brainSettingsSchema.parse({ timeZone: "UTC" }).sleep).toEqual({ enabled: false, morningMinutes: 60, caffeineReminder: true });
    // Fields from the earlier schedule design are dropped, not kept around.
    expect(sleepSettingsSchema.parse({ enabled: true, wakeTime: "07:30", bedTime: "23:30" })).toEqual({ enabled: true, morningMinutes: 60, caffeineReminder: true });
    expect(sleepSettingsSchema.safeParse({ morningMinutes: 181 }).success).toBe(false);
  });

  it("finds the usual bedtime across midnight", () => {
    expect(median([minutesAfterEvening("23:40"), minutesAfterEvening("00:20"), minutesAfterEvening("01:10")])).toBe(minutesAfterEvening("00:20"));
    expect(median([minutesAfterEvening("23:00"), minutesAfterEvening("00:00")])).toBe(minutesAfterEvening("23:30"));
    expect(median([])).toBeNull();
  });

  it("picks one tip, first rule first", () => {
    expect(sleepTip(week({ nights: 2 })).title).toBe("Two taps a day");
    expect(sleepTip(week({ wakeRangeMinutes: 95, bedtimeRangeMinutes: 200 })).title).toBe("Same wake-up time, every day");
    expect(sleepTip(week({ bedtimeRangeMinutes: 120 }))).toEqual({ title: "Keep bedtime steady", line: "Your bedtime moved by 2 hr this week. Steadier nights make easier mornings." });
    expect(sleepTip(week({ averageLatencyMinutes: 70 })).title).toBe("Slow to fall asleep?");
    // Latency needs enough answers before it counts.
    expect(sleepTip(week({ averageLatencyMinutes: 70, latencyAnswers: 2 })).title).toBe("You’re on track");
    expect(sleepTip(week({ averageHours: 6.14 })).line).toBe("About 6.1 hr a night. Try Going to bed 30 minutes earlier.");
    expect(sleepTip(week({ usualBedtime: minutesAfterEvening("01:30") })).title).toBe("Get daylight early");
    expect(sleepTip(week()).title).toBe("You’re on track");
  });

  it("writes durations the way the rest of the app does", () => {
    expect(sleepDurationLabel(90)).toBe("1 hr 30 min");
    expect(sleepDurationLabel(120)).toBe("2 hr");
    expect(sleepDurationLabel(45)).toBe("45 min");
  });
});
