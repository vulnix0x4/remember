import { describe, expect, it } from "vitest";
import type { HealthMetric } from "./types";
import { cumulativeHealthTotal, focusTimerElapsedMs, latestNightSleep } from "./LifeOS";

function sleep(id: string, value: number, startAt: string, endAt: string): HealthMetric {
  return {
    id,
    externalId: id,
    type: "sleep",
    value,
    unit: "hr",
    startAt,
    endAt,
    source: "Apple Health",
    metadata: { stage: id },
    createdAt: endAt,
  };
}

describe("latestNightSleep", () => {
  it("adds all stages from the latest night without including an older night", () => {
    const metrics = [
      sleep("latest-core", 2, "2026-08-31T00:30:00Z", "2026-08-31T02:30:00Z"),
      sleep("old", 2, "2026-08-28T23:00:00Z", "2026-08-29T01:00:00Z"),
      sleep("latest-rem", 1, "2026-08-31T02:45:00Z", "2026-08-31T03:45:00Z"),
      sleep("latest-deep", 1.5, "2026-08-30T23:00:00Z", "2026-08-31T00:30:00Z"),
    ];

    expect(latestNightSleep(metrics)).toBe(4.5);
    expect(latestNightSleep([])).toBeUndefined();
  });

  it("derives running timer time from the wall clock after backgrounding", () => {
    expect(focusTimerElapsedMs({ accumulatedMs: 5_000, startedAt: 10_000 }, 25_000)).toBe(20_000);
    expect(focusTimerElapsedMs({ accumulatedMs: 20_000, startedAt: null }, 99_000)).toBe(20_000);
  });

  it("unions overlapping sleep rows from multiple devices", () => {
    const metrics = [
      sleep("watch", 4, "2026-08-30T22:00:00Z", "2026-08-31T02:00:00Z"),
      sleep("phone", 4, "2026-08-30T23:00:00Z", "2026-08-31T03:00:00Z"),
    ];
    expect(latestNightSleep(metrics)).toBe(5);
  });

  it("uses the latest session when two sleep periods are more than four hours apart", () => {
    const metrics = [
      sleep("night", 4, "2026-08-31T04:00:00Z", "2026-08-31T08:00:00Z"),
      sleep("later", 2, "2026-08-31T13:00:00Z", "2026-08-31T15:00:00Z"),
    ];
    expect(latestNightSleep(metrics)).toBe(2);
  });

  it("prefers the latest authoritative daily total and never adds devices together", () => {
    const base = (id: string, value: number, source: string, metadata: HealthMetric["metadata"], createdAt: string): HealthMetric => ({
      id, externalId: id, type: "steps", value, unit: "count", source, metadata, createdAt,
      startAt: "2026-08-31T12:00:00Z", endAt: "2026-08-31T12:01:00Z",
    });
    const metrics = [
      base("watch", 1_889, "Apple Watch", { bundleIdentifier: "watch" }, "2026-08-31T12:00:00Z"),
      base("phone", 1_057, "iPhone", { bundleIdentifier: "phone" }, "2026-08-31T12:00:00Z"),
      base("old-stat", 3_400, "Apple Health", { aggregation: "healthkit_statistics" }, "2026-08-31T12:01:00Z"),
      base("new-stat", 2_400, "Apple Health", { aggregation: "healthkit_statistics" }, "2026-08-31T12:02:00Z"),
      base("manual", 40, "manual", {}, "2026-08-31T12:03:00Z"),
    ];
    expect(cumulativeHealthTotal(metrics, "steps", new Date("2026-08-31T18:00:00Z"))).toBe(2_440);
    expect(cumulativeHealthTotal(metrics.slice(0, 2).concat(metrics.at(-1)!), "steps", new Date("2026-08-31T18:00:00Z"))).toBe(1_929);
  });
});
