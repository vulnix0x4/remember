import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { findReturnForMoment, localDateToReturnAt, returnAtToLocalDate, scheduleReturnDay } from "./returnCues";

describe("return cues", () => {
  it("rejects impossible calendar days instead of silently rolling into another month", () => {
    expect(localDateToReturnAt("2026-02-31")).toBeUndefined();
    expect(localDateToReturnAt("2026-02-29")).toBeUndefined();
    expect(localDateToReturnAt("2028-02-29")).toBeTruthy();
  });

  it("makes a future day available at its local start, including DST transitions", () => {
    const now = new Date(2026, 2, 7, 13);
    const scheduled = scheduleReturnDay("2026-03-09", now);
    expect(scheduled).toBe(new Date(2026, 2, 9).toISOString());
    const item = { ...imprints[0], returnCue: "date" as const, returnAt: scheduled };
    expect(findReturnForMoment([item], "date", new Date(2026, 2, 9, 0, 1))?.id).toBe(item.id);
  });

  it("schedules today after a previous check-in and rejects past days", () => {
    const now = new Date(2026, 8, 7, 19, 30);
    const scheduled = scheduleReturnDay("2026-09-07", now);
    expect(scheduled).toBe(now.toISOString());
    expect(scheduleReturnDay("2026-09-06", now)).toBeUndefined();
    const item = { ...imprints[0], returnCue: "date" as const, returnAt: scheduled };
    expect(findReturnForMoment([item], "date", now, { reflections: [{
      itemId: item.id, response: "still_true", occurredAt: new Date(2026, 8, 7, 12).toISOString(),
    }] })?.id).toBe(item.id);
  });

  it("returns the save deliberately kept for a stuck moment", () => {
    const items = imprints.map((item, index) => ({ ...item, returnCue: index === 1 ? "stuck" as const : undefined }));
    expect(findReturnForMoment(items, "stuck")?.id).toBe(items[1].id);
  });

  it("only returns a dated save once its chosen day arrives", () => {
    const item = { ...imprints[0], returnCue: "date" as const, returnAt: "2026-09-05T15:00:00.000Z" };
    expect(findReturnForMoment([item], "date", new Date("2026-09-05T14:59:00.000Z"))).toBeNull();
    expect(findReturnForMoment([item], "date", new Date("2026-09-05T15:00:00.000Z"))?.id).toBe(item.id);
  });

  it("round trips a local return date without drifting days", () => {
    const returnAt = localDateToReturnAt("2026-09-12");
    expect(returnAt).toBeTruthy();
    expect(returnAtToLocalDate(returnAt)).toBe("2026-09-12");
  });

  it("honors the latest check-in for a deliberately chosen moment", () => {
    const item = { ...imprints[0], returnCue: "stuck" as const };
    const now = new Date("2026-09-07T18:00:00Z");
    const released = { itemId: item.id, response: "no_longer_relevant" as const, occurredAt: "2026-09-05T12:00:00Z" };
    expect(findReturnForMoment([item], "stuck", now, { reflections: [released] })).toBeNull();
    expect(findReturnForMoment([item], "stuck", now, { reflections: [released, {
      itemId: item.id, response: "still_true", occurredAt: "2026-09-06T12:00:00Z",
    }] })?.id).toBe(item.id);
  });

  it("fulfills a dated return after a check-in and allows an explicit later date", () => {
    const item = { ...imprints[0], returnCue: "date" as const, returnAt: "2026-09-05T09:00:00Z" };
    const history = { reflections: [{ itemId: item.id, response: "not_sure" as const, occurredAt: "2026-09-05T10:00:00Z" }] };
    const now = new Date("2026-09-07T12:00:00Z");
    expect(findReturnForMoment([item], "date", now, history)).toBeNull();
    expect(findReturnForMoment([{ ...item, returnAt: "2026-09-07T09:00:00Z" }], "date", now, history)?.id).toBe(item.id);
  });

  it("does not fulfill a future return with an earlier check-in", () => {
    const item = { ...imprints[0], returnCue: "date" as const, returnAt: "2026-09-07T09:00:00Z" };
    const history = { reflections: [{ itemId: item.id, response: "still_true" as const, occurredAt: "2026-09-06T10:00:00Z" }] };
    expect(findReturnForMoment([item], "date", new Date("2026-09-07T12:00:00Z"), history)?.id).toBe(item.id);
  });

  it("uses recent not-today feedback for chosen returns too", () => {
    const item = { ...imprints[0], returnCue: "focus" as const };
    const history = { returnFeedback: [{ itemId: item.id, response: "not_today" as const, occurredAt: "2026-09-07T10:00:00Z" }] };
    expect(findReturnForMoment([item], "focus", new Date("2026-09-07T12:00:00Z"), history)).toBeNull();
    expect(findReturnForMoment([item], "focus", new Date("2026-09-15T12:00:00Z"), history)?.id).toBe(item.id);
  });

  it("chooses the most recent save when cue and personal context are equal", () => {
    const older = { ...imprints[0], id: "older", returnCue: "focus" as const, returnAt: undefined, savedAt: "September 1, 2026" };
    const newer = { ...older, id: "newer", savedAt: "September 7, 2026" };
    expect(findReturnForMoment([older, newer], "focus")?.id).toBe("newer");
  });
});
