import { describe, expect, it } from "vitest";
import { createTaskSchema, upsertCalendarEventSchema, upsertHealthMetricSchema } from "../src/life";

describe("Personal Life OS contracts", () => {
  it("applies safe defaults to a new task", () => {
    expect(createTaskSchema.parse({ title: "Ship the first screen" })).toMatchObject({
      area: "direction",
      durationMinutes: 15,
      priority: "normal",
      status: "inbox",
      source: "manual",
    });
  });

  it("rejects a calendar event that ends before it starts", () => {
    expect(upsertCalendarEventSchema.safeParse({
      title: "Impossible event",
      startAt: "2026-09-01T18:00:00.000Z",
      endAt: "2026-09-01T17:00:00.000Z",
    }).success).toBe(false);
  });

  it("keeps health metadata primitive and portable", () => {
    expect(upsertHealthMetricSchema.safeParse({
      type: "steps",
      value: 8_200,
      unit: "count",
      startAt: "2026-09-01T00:00:00.000Z",
      endAt: "2026-09-01T23:59:59.000Z",
      source: "Apple Health",
      metadata: { device: "Apple Watch", userEntered: false },
    }).success).toBe(true);
  });
});
