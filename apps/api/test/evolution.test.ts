import { env } from "cloudflare:workers";
import { canonicalizeSourceUrl } from "@remember/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureUser } from "../src/auth";
import { EvolutionService } from "../src/evolution";
import { Repository } from "../src/repository";

const dayMs = 86_400_000;
let userId: string;
let service: EvolutionService;

function ago(milliseconds: number) {
  return new Date(Date.now() - milliseconds).toISOString();
}

beforeEach(async () => {
  userId = crypto.randomUUID();
  await ensureUser(env.DB, userId);
  service = new EvolutionService(env.DB);
});

async function savedItem(status = "ready", savedAt = ago(10 * dayMs), owner = userId) {
  const item = await new Repository(env.DB).capture(
    owner,
    canonicalizeSourceUrl(`https://example.com/feedback/${crypto.randomUUID()}`),
    null,
    savedAt,
    null,
  );
  await env.DB.prepare("UPDATE items SET status = ?2 WHERE id = ?1").bind(item.row.id, status).run();
  return item.row.id;
}

function signal(itemId: string, response: string, occurredAt: string, owner = userId) {
  const kind = ["useful", "not_today"].includes(response) ? "resurfacing_rating" : response;
  return env.DB.prepare(
    `INSERT INTO personal_signals (id, user_id, item_id, kind, value_text, occurred_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  ).bind(crypto.randomUUID(), owner, itemId, kind, response, occurredAt);
}

async function event(itemId: string, surfacedAt = ago(60_000), owner = userId) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO resurfacing_events (id, user_id, item_id, reason, surfaced_at) VALUES (?1, ?2, ?3, 'A past memory', ?4)",
  ).bind(id, owner, itemId, surfacedAt).run();
  return id;
}

async function practice(itemId: string, outcome: string | null, reflectedAt: string | null, updatedAt = reflectedAt ?? ago(60_000), owner = userId, source = "practice") {
  await env.DB.prepare(
    `INSERT INTO life_tasks (id, user_id, title, area, source, source_item_id, practice_outcome, reflected_at, created_at, updated_at)
     VALUES (?1, ?2, 'Try the saved idea', 'growth', ?3, ?4, ?5, ?6, ?7, ?7)`,
  ).bind(crypto.randomUUID(), owner, source, itemId, outcome, reflectedAt, updatedAt).run();
}

describe("evolution feedback", () => {
  it("accepts and returns check-ins and contextual feedback for partially processed saves", async () => {
    const itemId = await savedItem("partial");
    const reflection = await service.reflect(userId, itemId, "changed_mind");
    const feedback = await service.rateContextualReturn(userId, itemId, "useful");

    expect(await service.overview(userId)).toMatchObject({
      reflections: [reflection],
      returnFeedback: [feedback],
    });
    expect(await service.resurfaced(userId)).toMatchObject({ itemId });
  });

  it.each(["pending", "processing", "failed"])("rejects feedback for an unusable %s save", async (status) => {
    const itemId = await savedItem(status);
    await expect(service.reflect(userId, itemId, "still_true")).rejects.toMatchObject({ code: "item_not_found" });
    await expect(service.rateContextualReturn(userId, itemId, "useful")).rejects.toMatchObject({ code: "item_not_found" });
  });

  it("retains each item's latest decision beyond the recent-history limit", async () => {
    const releasedItem = await savedItem();
    const activeItem = await savedItem();
    const oldestDecision = ago(3 * dayMs);
    await env.DB.batch([
      signal(releasedItem, "no_longer_relevant", oldestDecision),
      signal(releasedItem, "not_today", oldestDecision),
      ...Array.from({ length: 65 }, (_, index) => {
        const occurredAt = ago((65 - index) * 60_000);
        return [
          signal(activeItem, index % 2 === 0 ? "still_true" : "changed_mind", occurredAt),
          signal(activeItem, index % 2 === 0 ? "useful" : "not_today", occurredAt),
        ];
      }).flat(),
    ]);

    const overview = await service.overview(userId);
    expect(overview.reflections).toHaveLength(52);
    expect(overview.returnFeedback).toHaveLength(52);
    expect(overview.reflections[0]).toMatchObject({ itemId: activeItem, response: "still_true" });
    expect(overview.returnFeedback[0]).toMatchObject({ itemId: activeItem, response: "useful" });
    expect(overview.reflections).toContainEqual(expect.objectContaining({ itemId: releasedItem, response: "no_longer_relevant" }));
    expect(overview.returnFeedback).toContainEqual(expect.objectContaining({ itemId: releasedItem, response: "not_today" }));
    expect(overview.reflections).toContainEqual(expect.objectContaining({ itemId: activeItem, response: "changed_mind" }));
  });

  it("orders feedback recorded at the same instant by the later insertion", async () => {
    const itemId = await savedItem();
    const occurredAt = ago(60_000);
    await env.DB.batch([
      signal(itemId, "no_longer_relevant", occurredAt),
      signal(itemId, "still_true", occurredAt),
      signal(itemId, "not_today", occurredAt),
      signal(itemId, "useful", occurredAt),
    ]);

    const overview = await service.overview(userId);
    expect(overview.reflections.map((entry) => entry.response)).toEqual(["still_true", "no_longer_relevant"]);
    expect(overview.returnFeedback.map((entry) => entry.response)).toEqual(["useful", "not_today"]);
    expect(await service.createResurfacing(userId)).toMatchObject({ itemId });
  });

  it("enforces both feedback and item ownership", async () => {
    const otherUser = crypto.randomUUID();
    await ensureUser(env.DB, otherUser);
    const ownedItem = await savedItem();
    const otherItem = await savedItem("partial", ago(10 * dayMs), otherUser);
    await env.DB.batch([
      signal(otherItem, "still_true", ago(60_000)),
      signal(otherItem, "useful", ago(60_000)),
      signal(ownedItem, "no_longer_relevant", ago(60_000), otherUser),
      signal(ownedItem, "not_today", ago(60_000), otherUser),
    ]);

    await expect(service.reflect(userId, otherItem, "still_true")).rejects.toMatchObject({ code: "item_not_found" });
    await expect(service.rateContextualReturn(userId, otherItem, "useful")).rejects.toMatchObject({ code: "item_not_found" });
    expect(await service.overview(userId)).toMatchObject({ reflections: [], returnFeedback: [] });
    expect(await service.createResurfacing(userId)).toMatchObject({ itemId: ownedItem });
  });
});

describe("automatic resurfacing", () => {
  it.each(["new", "cached"])("keeps a completed dated return out of the %s fallback until it is rescheduled", async (mode) => {
    const itemId = await savedItem();
    const checkedInAt = ago(60_000);
    await env.DB.prepare("UPDATE items SET return_cue = 'date', return_at = ?2 WHERE id = ?1").bind(itemId, checkedInAt).run();
    const eventId = mode === "cached" ? await event(itemId) : null;
    await signal(itemId, "still_true", checkedInAt).run();
    expect(await service.resurfaced(userId)).toBeNull();

    await env.DB.prepare("UPDATE items SET return_at = ?2 WHERE id = ?1").bind(itemId, ago(30_000)).run();
    const resurfaced = await service.resurfaced(userId);
    expect(resurfaced).toMatchObject({ itemId });
    if (eventId) expect(resurfaced).toMatchObject({ eventId });

    await signal(itemId, "no_longer_relevant", ago(20_000)).run();
    await env.DB.prepare("UPDATE items SET return_at = ?2 WHERE id = ?1").bind(itemId, ago(10_000)).run();
    expect(await service.resurfaced(userId)).toBeNull();
  });

  it.each(["new", "cached"])("keeps a rejected practice out of the %s fallback until a newer outcome replaces it", async (mode) => {
    const itemId = await savedItem();
    const eventId = mode === "cached" ? await event(itemId) : null;
    await practice(itemId, "not_for_me", ago(dayMs));
    await practice(itemId, null, null);
    expect(await service.resurfaced(userId)).toBeNull();

    await practice(itemId, "helped", ago(30_000));
    const resurfaced = await service.resurfaced(userId);
    expect(resurfaced).toMatchObject({ itemId });
    if (eventId) expect(resurfaced).toMatchObject({ eventId });
  });

  it("uses the practice update time when its reflection time is unavailable", async () => {
    const itemId = await savedItem();
    await practice(itemId, "helped", ago(dayMs));
    await practice(itemId, "not_for_me", null);
    expect(await service.resurfaced(userId)).toBeNull();
  });

  it("ignores other users' practice results and results from non-practice tasks", async () => {
    const otherUser = crypto.randomUUID();
    await ensureUser(env.DB, otherUser);
    const itemId = await savedItem();
    await practice(itemId, "not_for_me", ago(60_000), ago(60_000), otherUser);
    await practice(itemId, "not_for_me", ago(60_000), ago(60_000), userId, "manual");
    expect(await service.resurfaced(userId)).toMatchObject({ itemId });
  });

  it("releases a memory until a newer reflection makes it current again", async () => {
    const itemId = await savedItem();
    await signal(itemId, "no_longer_relevant", ago(2 * dayMs)).run();
    // A usefulness rating is a different kind of feedback and does not undo a reflection.
    await signal(itemId, "useful", ago(dayMs)).run();
    expect(await service.createResurfacing(userId)).toBeNull();

    await service.reflect(userId, itemId, "still_true");
    expect(await service.createResurfacing(userId)).toMatchObject({ itemId });
  });

  it("applies not-today feedback to an existing return until a newer useful response", async () => {
    const itemId = await savedItem();
    const original = await service.createResurfacing(userId);
    expect(original).toMatchObject({ itemId });
    await service.rateContextualReturn(userId, itemId, "not_today");
    expect(await service.resurfaced(userId)).toBeNull();

    await service.rateContextualReturn(userId, itemId, "useful");
    expect(await service.resurfaced(userId)).toMatchObject({ itemId, eventId: original!.eventId });
  });

  it.each([
    { age: 7 * dayMs - 60_000, suppressed: true },
    { age: 7 * dayMs + 60_000, suppressed: false },
  ])("honors the seven-day not-today cooldown at age $age", async ({ age, suppressed }) => {
    const itemId = await savedItem();
    await signal(itemId, "not_today", ago(age)).run();
    const result = await service.createResurfacing(userId);
    if (suppressed) expect(result).toBeNull();
    else expect(result).toMatchObject({ itemId });
  });

  it("skips a released existing return and selects another eligible memory", async () => {
    const releasedItem = await savedItem();
    const eligibleItem = await savedItem();
    await event(releasedItem);
    await signal(releasedItem, "no_longer_relevant", ago(30_000)).run();
    expect(await service.resurfaced(userId)).toMatchObject({ itemId: eligibleItem });
  });

  it("never serves an existing return whose item has become unusable", async () => {
    const itemId = await savedItem("failed");
    await event(itemId);
    expect(await service.resurfaced(userId)).toBeNull();
  });

  it("rejects an event associated with another user's item", async () => {
    const otherUser = crypto.randomUUID();
    await ensureUser(env.DB, otherUser);
    const itemId = await savedItem("ready", ago(10 * dayMs), otherUser);
    const eventId = await event(itemId);
    expect(await service.resurfaced(userId)).toBeNull();
    await expect(service.respond(userId, eventId, "still_true")).rejects.toMatchObject({ code: "resurfacing_not_found" });
  });

  it("records a response to an owned partial item's existing return", async () => {
    const itemId = await savedItem("partial");
    const eventId = await event(itemId);
    await service.respond(userId, eventId, "changed_mind");
    expect(await service.overview(userId)).toMatchObject({
      reflections: [expect.objectContaining({ itemId, response: "changed_mind" })],
    });
    expect(await service.resurfaced(userId)).toBeNull();
  });

  it.each([
    { age: 7 * dayMs - 60_000, eligible: false },
    { age: 7 * dayMs + 60_000, eligible: true },
  ])("uses elapsed time for the seven-day save age at age $age", async ({ age, eligible }) => {
    const itemId = await savedItem("ready", ago(age));
    const result = await service.createResurfacing(userId);
    if (eligible) expect(result).toMatchObject({ itemId });
    else expect(result).toBeNull();
  });

  it.each([
    { age: 30 * dayMs - 60_000, eligible: false },
    { age: 30 * dayMs + 60_000, eligible: true },
  ])("uses elapsed time for repeat resurfacing at age $age", async ({ age, eligible }) => {
    const itemId = await savedItem("ready", ago(40 * dayMs));
    await event(itemId, ago(age));
    const result = await service.createResurfacing(userId);
    if (eligible) expect(result).toMatchObject({ itemId });
    else expect(result).toBeNull();
  });
});
