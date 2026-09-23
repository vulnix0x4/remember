import { describe, expect, it } from "vitest";
import { describeDay, describeRepeat, learnedRepeatDays, parseQuickTask, quickTaskChips } from "./quickTask";

// Wednesday, September 23, 2026 at 10:30 local time.
const wednesday = new Date(2026, 8, 23, 10, 30);
const local = (month: number, day: number, hour: number) => new Date(2026, month - 1, day, hour, 0, 0, 0);

describe("parseQuickTask: spec examples", () => {
  it("Call mom tomorrow 20m", () => {
    expect(parseQuickTask("Call mom tomorrow 20m", wednesday)).toEqual({ title: "Call mom", durationMinutes: 20, notBefore: local(9, 24, 9), repeatEveryDays: 7, repeatSource: "usual" });
  });
  it("laundry every week 1h", () => {
    expect(parseQuickTask("laundry every week 1h", wednesday)).toEqual({ title: "Laundry", durationMinutes: 60, repeatEveryDays: 7, repeatSource: "typed" });
  });
  it("pay rent by friday !", () => {
    expect(parseQuickTask("pay rent by friday !", wednesday)).toEqual({ title: "Pay rent", dueAt: local(9, 25, 17), priority: "high", repeatEveryDays: 30, repeatSource: "usual" });
  });
  it("email sam", () => {
    expect(parseQuickTask("email sam", wednesday)).toEqual({ title: "Email sam" });
  });
  it("today falls back to the original text", () => {
    expect(parseQuickTask("today", wednesday)).toEqual({ title: "today" });
  });
  it("gym tonight 45 min at 20:00 has no start time", () => {
    expect(parseQuickTask("gym tonight 45 min", new Date(2026, 8, 23, 20, 0))).toEqual({ title: "Gym", durationMinutes: 45 });
  });
});

describe("parseQuickTask: duration", () => {
  it.each([
    ["read 5m", 5], ["read 5 min", 5], ["read 10 mins", 10], ["read 1 minute", 2], ["read 25 minutes", 25],
    ["read 2h", 120], ["read 1.5 hours", 90], ["read 1 hr", 60], ["read 3 hrs", 180], ["read 1 hour", 60],
    ["read half an hour", 30], ["read half hour", 30], ["read for an hour", 60], ["read 20h", 720],
  ])("%s → %i minutes", (text, minutes) => {
    expect(parseQuickTask(text, wednesday).durationMinutes).toBe(minutes);
  });
  it("removes the duration from the title", () => {
    expect(parseQuickTask("Clean desk 30 MIN", wednesday).title).toBe("Clean desk");
  });
  it("does not read words that merely start with m or h as durations", () => {
    expect(parseQuickTask("buy 2 mangos", wednesday)).toEqual({ title: "Buy 2 mangos" });
  });
});

describe("parseQuickTask: when", () => {
  it("drops today without setting a date", () => {
    expect(parseQuickTask("call bank today", wednesday)).toEqual({ title: "Call bank" });
  });
  it("tonight is 18:00 when that is still ahead", () => {
    expect(parseQuickTask("stretch tonight", wednesday).notBefore).toEqual(local(9, 23, 18));
  });
  it.each(["tomorrow", "tmrw", "tmr", "TOMORROW"])("%s is tomorrow at 09:00", (word) => {
    expect(parseQuickTask(`read a book ${word}`, wednesday)).toEqual({ title: "Read a book", notBefore: local(9, 24, 9) });
  });
  it("weekend is the next Saturday at 09:00", () => {
    expect(parseQuickTask("clean garage this weekend", wednesday)).toEqual({ title: "Clean garage", notBefore: local(9, 26, 9) });
    expect(parseQuickTask("clean garage weekend", wednesday).notBefore).toEqual(local(9, 26, 9));
  });
  it("weekend is today on an early Saturday and next week on a late one", () => {
    expect(parseQuickTask("hike weekend", new Date(2026, 8, 26, 7, 0)).notBefore).toEqual(local(9, 26, 9));
    expect(parseQuickTask("hike weekend", new Date(2026, 8, 26, 11, 0)).notBefore).toEqual(local(10, 3, 9));
  });
  it("next week is next Monday at 09:00", () => {
    expect(parseQuickTask("plan trip next week", wednesday)).toEqual({ title: "Plan trip", notBefore: local(9, 28, 9) });
    expect(parseQuickTask("plan trip next week", new Date(2026, 8, 28, 8, 0)).notBefore).toEqual(local(10, 5, 9));
  });
  it.each([
    ["monday", 28], ["mon", 28], ["tuesday", 29], ["tue", 29], ["tues", 29], ["wednesday", 30], ["wed", 30],
    ["thursday", 24], ["thu", 24], ["thur", 24], ["thurs", 24], ["friday", 25], ["fri", 25],
    ["saturday", 26], ["sat", 26], ["sunday", 27], ["sun", 27],
  ])("%s is the next one strictly after today", (word, day) => {
    expect(parseQuickTask(`coffee with jo ${word}`, wednesday)).toEqual({ title: "Coffee with jo", notBefore: local(9, day, 9) });
  });
  it("accepts on and next before a day name", () => {
    expect(parseQuickTask("text jo on friday", wednesday)).toEqual({ title: "Text jo", notBefore: local(9, 25, 9) });
    expect(parseQuickTask("text jo next fri", wednesday)).toEqual({ title: "Text jo", notBefore: local(9, 25, 9) });
  });
  it("only matches short day names as whole words", () => {
    expect(parseQuickTask("wedding gift", wednesday)).toEqual({ title: "Wedding gift" });
    expect(parseQuickTask("monitor setup", wednesday)).toEqual({ title: "Monitor setup" });
    expect(parseQuickTask("sunscreen", wednesday)).toEqual({ title: "Sunscreen" });
  });
  it("by a day sets a 17:00 deadline instead of a start", () => {
    expect(parseQuickTask("taxes by tomorrow", wednesday)).toEqual({ title: "Taxes", dueAt: local(9, 24, 17) });
    expect(parseQuickTask("taxes by next week", wednesday)).toEqual({ title: "Taxes", dueAt: local(9, 28, 17) });
    expect(parseQuickTask("taxes by today", wednesday)).toEqual({ title: "Taxes", dueAt: local(9, 23, 17) });
  });
  it("can combine a start and a deadline", () => {
    expect(parseQuickTask("draft essay tomorrow by friday", wednesday)).toEqual({ title: "Draft essay", notBefore: local(9, 24, 9), dueAt: local(9, 25, 17) });
  });
});

describe("parseQuickTask: repeat", () => {
  it.each([
    ["meds every day", 1], ["meds daily", 1], ["meds everyday", 1], ["review every week", 7], ["review weekly", 7],
    ["budget every month", 30], ["budget monthly", 30], ["water every 3 days", 3], ["water every other day", 2],
    ["water every 999 days", 365], ["water every 0 days", 1],
  ])("%s → every %i days", (text, days) => {
    expect(parseQuickTask(text, wednesday).repeatEveryDays).toBe(days);
  });
  it("does not treat the repeat count as a duration", () => {
    expect(parseQuickTask("water every 3 days", wednesday)).toEqual({ title: "Water", repeatEveryDays: 3, repeatSource: "typed" });
  });
});

describe("parseQuickTask: priority", () => {
  it.each([["call vet !!", "must"], ["call vet urgent", "must"], ["call vet !", "high"], ["call vet asap", "high"], ["IMPORTANT call vet", "high"]])("%s → %s", (text, priority) => {
    expect(parseQuickTask(text, wednesday)).toEqual({ title: "Call vet", priority });
  });
  it("ignores an exclamation mark attached to a word", () => {
    expect(parseQuickTask("finally done!", wednesday)).toEqual({ title: "Finally done!" });
  });
});

describe("parseQuickTask: title cleanup", () => {
  it("collapses whitespace and trims dangling connectors", () => {
    expect(parseQuickTask("  send   invoice ,  tomorrow ", wednesday).title).toBe("Send invoice");
    expect(parseQuickTask("meet ana at tomorrow", wednesday).title).toBe("Meet ana");
    expect(parseQuickTask("pick up keys - friday", wednesday).title).toBe("Pick up keys");
  });
  it("keeps the rest of the capitalization", () => {
    expect(parseQuickTask("call NASA about iPhone", wednesday).title).toBe("Call NASA about iPhone");
  });
  it("falls back to the raw text when every word is a token", () => {
    expect(parseQuickTask("tomorrow 20m", wednesday)).toEqual({ title: "tomorrow 20m" });
  });
});

describe("preview chips", () => {
  it("describes what was understood", () => {
    const parsed = parseQuickTask("laundry tomorrow every week 30m !", wednesday);
    expect(quickTaskChips(parsed, wednesday).map((chip) => chip.label)).toEqual(["30 min", "Tomorrow", "Weekly", "Important"]);
  });
  it("is empty when nothing was recognized", () => {
    expect(quickTaskChips(parseQuickTask("email sam", wednesday), wednesday)).toEqual([]);
  });
  it("labels days, deadlines, and repeats in short words", () => {
    expect(describeDay(local(9, 23, 18), wednesday)).toBe("Tonight");
    expect(describeDay(local(9, 26, 9), wednesday)).toBe("Sat");
    expect(quickTaskChips(parseQuickTask("taxes by friday 2h urgent", wednesday), wednesday).map((chip) => chip.label)).toEqual(["2 hr", "Due Fri", "Urgent"]);
    expect(describeRepeat(3)).toBe("Every 3 days");
  });
});

describe("automatic repeat", () => {
  const now = new Date(2026, 8, 23, 10, 0);
  it("gives common chores their usual rhythm", () => {
    expect(parseQuickTask("laundry", now)).toMatchObject({ title: "Laundry", repeatEveryDays: 7, repeatSource: "usual" });
    expect(parseQuickTask("do the dishes", now).repeatEveryDays).toBe(1);
    expect(parseQuickTask("change sheets", now).repeatEveryDays).toBe(14);
    expect(parseQuickTask("pay rent by friday", now)).toMatchObject({ title: "Pay rent", repeatEveryDays: 30 });
    expect(parseQuickTask("replace air filter", now).repeatEveryDays).toBe(90);
    expect(parseQuickTask("book dentist", now).repeatEveryDays).toBe(180);
  });
  it("lets typed rhythm and 'once' win", () => {
    expect(parseQuickTask("laundry every 3 days", now)).toMatchObject({ repeatEveryDays: 3, repeatSource: "typed" });
    const once = parseQuickTask("laundry once", now);
    expect(once.title).toBe("Laundry");
    expect(once.repeatEveryDays).toBeUndefined();
  });
  it("leaves one-off tasks alone", () => {
    expect(parseQuickTask("email sam", now).repeatEveryDays).toBeUndefined();
    expect(parseQuickTask("buy a rental car", now).repeatEveryDays).toBeUndefined();
  });
  it("learns the person's own rhythm from past completions", () => {
    const history = [
      { title: "Clean litter box", completedAt: new Date(2026, 8, 17, 9).toISOString() },
      { title: "clean litter box", completedAt: new Date(2026, 8, 20, 9).toISOString() },
    ];
    expect(parseQuickTask("clean litter box", now, history)).toMatchObject({ repeatEveryDays: 3, repeatSource: "learned" });
    // One earlier completion: the gap until now counts.
    expect(learnedRepeatDays("Laundry", [{ title: "laundry", completedAt: new Date(2026, 8, 9, 10).toISOString() }], now)).toBe(14);
  });
  it("labels where the repeat came from", () => {
    expect(quickTaskChips(parseQuickTask("laundry", now), now).find((chip) => chip.kind === "repeat")?.label).toBe("Weekly · usual");
  });
});
