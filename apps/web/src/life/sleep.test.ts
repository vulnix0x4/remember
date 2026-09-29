import { describe, expect, it } from "vitest";
import { minutesAfterEvening, sleepTip } from "@remember/domain";
import {
  addDays, clockLabel, eveningLabel, lastNightLine, lastNight, nightKey, recentNights, savedNightId, sleepChart, sleepNights, sleepWeek, weekdayLabel,
} from "./sleep";
import type { HealthMetric } from "./types";

/** A local moment in September 2026. Day 28 is a Monday. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);
const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

let sequence = 0;
/** Apple Health's night, as the iPhone uploads it. */
function healthNight(asleep: Date, woke: Date, extra: Partial<HealthMetric> = {}): HealthMetric {
  sequence += 1;
  return {
    id: `health-${sequence}`, externalId: `healthkit.sleep.${sequence}`, type: "sleep", value: hoursBetween(asleep, woke), unit: "hr",
    startAt: asleep.toISOString(), endAt: woke.toISOString(), source: "Apple Health", metadata: { aggregation: "healthkit_sleep_union" },
    createdAt: woke.toISOString(), ...extra,
  };
}
/** A night saved by Going to bed and I'm up. It runs from falling asleep (bed plus the check-in's answer) to I'm up. */
function savedNight(key: string, bed: Date, up: Date, latency?: number | string, extra: Partial<HealthMetric> = {}): HealthMetric {
  sequence += 1;
  const asleep = new Date(bed.getTime() + Number(latency ?? 0) * 60_000);
  return {
    id: `saved-${sequence}`, externalId: savedNightId(key), type: "sleep", value: hoursBetween(asleep, up), unit: "hr",
    startAt: asleep.toISOString(), endAt: up.toISOString(), source: "Remember",
    metadata: { aggregation: "remember_night", bedAt: bed.toISOString(), ...(latency === undefined ? {} : { latency, rating: "okay" }) },
    createdAt: up.toISOString(), ...extra,
  };
}

describe("sleep on the calendar", () => {
  it("formats clock times the way the rest of the app does", () => {
    expect(clockLabel("23:30")).toBe("11:30 PM");
    expect(clockLabel("07:00")).toBe("7 AM");
    expect(clockLabel("00:00")).toBe("12 AM");
    expect(eveningLabel(minutesAfterEvening("00:40"))).toBe("12:40 AM");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayLabel("2026-09-27")).toBe("Sun");
    expect(weekdayLabel("2026-09-27", true)).toBe("Sunday");
  });

  it("puts a night on the evening it belongs to: 12 hours before getting up", () => {
    expect(nightKey(at(29, 7, 30))).toBe("2026-09-28");
    expect(nightKey(at(29, 11, 59))).toBe("2026-09-28");
    expect(nightKey(at(29, 12, 30))).toBe("2026-09-29");
  });
});

describe("nights", () => {
  it("takes the times and hours from Apple Health, and the bedtime and time to fall asleep from the saved night", () => {
    const nights = sleepNights([
      healthNight(at(27, 23, 50), at(28, 7, 10), { value: 7 }),
      savedNight("2026-09-27", at(27, 23, 20), at(28, 7, 15), 15),
    ]);
    expect(nights).toEqual([{
      key: "2026-09-27", asleepAt: at(27, 23, 50), wokeAt: at(28, 7, 10), hours: 7,
      bedAt: at(27, 23, 20), latencyMinutes: 15, measured: true, saved: true,
    }]);
  });

  it("uses a saved night's own times when Apple Health has nothing for it", () => {
    const [night] = sleepNights([savedNight("2026-09-26", at(27, 0, 10), at(27, 7, 30), "60")]);
    expect(night).toEqual({
      key: "2026-09-26", asleepAt: at(27, 1, 10), wokeAt: at(27, 7, 30), hours: hoursBetween(at(27, 1, 10), at(27, 7, 30)),
      bedAt: at(27, 0, 10), latencyMinutes: 60, measured: false, saved: true,
    });
  });

  it("keeps a saved night on the evening its externalId names, even after a get-up past noon", () => {
    const [night] = sleepNights([savedNight("2026-09-27", at(28, 4), at(28, 13))]);
    expect(night.key).toBe("2026-09-27");
    // Without that name, the end time decides.
    expect(sleepNights([{ ...savedNight("x", at(28, 4), at(28, 13)), externalId: null }])[0].key).toBe("2026-09-28");
  });

  it("accepts the time to fall asleep as a number or a string, and ignores anything else", () => {
    const latency = (value: unknown) => sleepNights([{ ...savedNight("2026-09-27", at(27, 23), at(28, 7)), metadata: { aggregation: "remember_night", bedAt: at(27, 23).toISOString(), latency: value as string } }])[0].latencyMinutes;
    expect(latency(90)).toBe(90);
    expect(latency("150")).toBe(150);
    expect(latency("")).toBeNull();
    expect(latency("soon")).toBeNull();
    expect(latency(null)).toBeNull();
    expect(latency(-5)).toBeNull();
  });

  it("ignores stage samples, other sleep rows, and broken records", () => {
    expect(sleepNights([
      { ...healthNight(at(25, 23), at(26, 7)), metadata: { stage: "core" } },
      { ...healthNight(at(25, 23), at(26, 7)), source: "manual", metadata: {} },
      healthNight(at(26, 7), at(26, 6)),
      { ...savedNight("2026-09-24", at(24, 23), at(25, 7)), value: 0 },
    ])).toEqual([]);
  });

  it("uses the newest record when a night was uploaded twice", () => {
    const older = healthNight(at(27, 23), at(28, 7), { createdAt: at(28, 8).toISOString() });
    const newer = healthNight(at(27, 23, 15), at(28, 7), { createdAt: at(28, 9).toISOString() });
    expect(sleepNights([newer, older])[0].asleepAt).toEqual(at(27, 23, 15));
  });
});

describe("last night", () => {
  it("shows last night, with Apple Health's times when it has them", () => {
    const nights = sleepNights([
      savedNight("2026-09-27", at(28, 0, 25), at(28, 7, 35), 15),
      healthNight(at(28, 0, 40), at(28, 7, 35)),
    ]);
    const last = lastNight(nights, at(28, 18))!;
    expect(lastNightLine(last)).toBe("Last night 12:40 AM – 7:35 AM · 6 hr 55 min");
  });

  it("counts a night owl's night keyed today, and nothing older than yesterday", () => {
    const owl = sleepNights([savedNight("2026-09-28", at(28, 5), at(28, 13))]);
    expect(lastNight(owl, at(28, 18))?.key).toBe("2026-09-28");
    const old = sleepNights([savedNight("2026-09-26", at(26, 23), at(27, 7))]);
    expect(lastNight(old, at(28, 18))).toBeNull();
  });

  it("counts a night Apple Health recorded without the two taps", () => {
    expect(lastNight(sleepNights([healthNight(at(27, 23), at(28, 7))]), at(28, 18))?.key).toBe("2026-09-27");
  });
});

describe("the last seven nights", () => {
  // Monday evening.
  const now = at(28, 18);

  it("keeps the newest seven nights keyed up to seven days before today, today included, oldest first", () => {
    const nights = sleepNights([20, 21, 22, 23, 24, 25, 26, 27].map((day) => healthNight(at(day, 23, 30), at(day + 1, 7, 30))).concat(
      // A night owl who got up after noon today: that night is keyed today.
      healthNight(at(28, 5), at(28, 13)),
    ));
    expect(recentNights(nights, now).map((night) => night.key)).toEqual(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(recentNights(nights.slice(0, 2), now).map((night) => night.key)).toEqual(["2026-09-21"]);
  });

  const week = sleepNights([
    savedNight("2026-09-21", at(21, 23, 40), at(22, 7, 30), 15),
    savedNight("2026-09-22", at(23, 0, 20), at(23, 7, 20), 60),
    savedNight("2026-09-23", at(24, 1, 10), at(24, 9, 0), "90"),
    // Apple Health alone: where it saw sleep start counts as the bedtime.
    healthNight(at(24, 23, 55), at(25, 7, 40)),
    // Saved without an answer to the check-in yet.
    savedNight("2026-09-25", at(25, 23, 30), at(26, 7, 30)),
  ]);

  it("finds the usual bedtime across midnight, the ranges, and the time to fall asleep", () => {
    const numbers = sleepWeek(week);
    expect(numbers.nights).toBe(5);
    expect(numbers.averageHours).toBeCloseTo(week.reduce((sum, night) => sum + night.hours, 0) / 5);
    // Bedtimes 11:40 PM, 12:20 AM, 1:10 AM, 11:55 PM and 11:30 PM: the middle one is 11:55 PM.
    expect(numbers.usualBedtime).toBe(minutesAfterEvening("23:55"));
    expect(numbers.bedtimeRangeMinutes).toBe(100);
    // Up between 7:20 AM and 9 AM; usually 7:30 AM.
    expect(numbers.wakeRangeMinutes).toBe(100);
    expect(numbers.usualWake).toBe(minutesAfterEvening("07:30"));
    // Only the nights that answered "How long until you fell asleep?".
    expect(numbers.latencyAnswers).toBe(3);
    expect(numbers.averageLatencyMinutes).toBe(55);
  });

  it("waits for three nights before it calls a time usual", () => {
    const numbers = sleepWeek(week.slice(0, 2));
    expect(numbers).toMatchObject({ nights: 2, usualBedtime: null, usualWake: null, bedtimeRangeMinutes: 40, wakeRangeMinutes: 10 });
    expect(sleepWeek([])).toEqual({ nights: 0, averageHours: null, usualBedtime: null, bedtimeRangeMinutes: null, wakeRangeMinutes: null, averageLatencyMinutes: null, latencyAnswers: 0, usualWake: null });
  });

  it("feeds the shared tip", () => {
    expect(sleepTip(sleepWeek(week.slice(0, 2))).title).toBe("Two taps a day");
    expect(sleepTip(sleepWeek(week)).title).toBe("Same wake-up time, every day");
    const steadyWake = sleepNights([
      savedNight("2026-09-22", at(22, 22, 30), at(23, 7), 15),
      savedNight("2026-09-23", at(24, 0, 30), at(24, 7, 10), 15),
      savedNight("2026-09-24", at(24, 23), at(25, 7, 5), 15),
    ]);
    expect(sleepTip(sleepWeek(steadyWake))).toEqual({ title: "Keep bedtime steady", line: "Your bedtime moved by 2 hr this week. Steadier nights make easier mornings." });
  });
});

describe("chart", () => {
  it("puts every night and the usual bedtime and wake-up on one time axis", () => {
    const nights = sleepNights([healthNight(at(26, 23, 30), at(27, 7, 30)), healthNight(at(28, 1), at(28, 9))]);
    const chart = sleepChart(nights, { bed: minutesAfterEvening("23:30"), wake: minutesAfterEvening("07:30") });
    // The axis runs from 11 PM to 9 AM: ten hours.
    expect([chart.from, chart.to]).toEqual(["23:00", "09:00"]);
    expect(chart.lines.bed).toBeCloseTo(5);
    expect(chart.lines.wake).toBeCloseTo(85);
    expect(chart.bars.get("2026-09-26")?.left).toBeCloseTo(5);
    expect(chart.bars.get("2026-09-26")?.width).toBeCloseTo(80);
    expect(chart.bars.get("2026-09-27")?.left).toBeCloseTo(20);
    expect(chart.bars.get("2026-09-27")?.width).toBeCloseTo(80);
  });

  it("draws no lines until the usual times are known", () => {
    const chart = sleepChart(sleepNights([healthNight(at(26, 23, 30), at(27, 7, 30))]), { bed: null, wake: null });
    expect(chart.lines).toEqual({ bed: null, wake: null });
    expect([chart.from, chart.to]).toEqual(["23:00", "08:00"]);
  });
});
