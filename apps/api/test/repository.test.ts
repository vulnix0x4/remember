import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureUser } from "../src/auth";
import { encodeItemCursor, Repository } from "../src/repository";
import { canonicalizeSourceUrl } from "@remember/domain";

const userId = "10000000-0000-4000-8000-000000000001";

beforeEach(async () => {
  await ensureUser(env.DB, userId);
});

describe("Repository capture", () => {
  it("captures immediately and deduplicates canonical YouTube URLs", async () => {
    const repository = new Repository(env.DB);
    const first = await repository.capture(
      userId,
      canonicalizeSourceUrl("https://youtu.be/dQw4w9WgXcQ?si=tracker"),
      null,
      "2026-08-21T12:00:00.000Z",
      "capture-1",
    );
    const duplicate = await repository.capture(
      userId,
      canonicalizeSourceUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      null,
      "2026-08-21T12:01:00.000Z",
      null,
    );
    expect(first.created).toBe(true);
    expect(first.row.status).toBe("pending");
    expect(duplicate.created).toBe(false);
    expect(duplicate.row.id).toBe(first.row.id);
  });

  it("paginates every item when save timestamps are identical", async () => {
    const paginationUserId = "10000000-0000-4000-8000-000000000009";
    await ensureUser(env.DB, paginationUserId);
    const repository = new Repository(env.DB);
    const savedAt = "2026-08-21T12:00:00.000Z";
    await Promise.all([
      repository.capture(paginationUserId, canonicalizeSourceUrl("https://example.com/page-a"), null, savedAt, null),
      repository.capture(paginationUserId, canonicalizeSourceUrl("https://example.com/page-b"), null, savedAt, null),
      repository.capture(paginationUserId, canonicalizeSourceUrl("https://example.com/page-c"), null, savedAt, null),
    ]);

    const firstPage = await repository.listItems(paginationUserId, 2, null, null);
    const secondPage = await repository.listItems(paginationUserId, 2, encodeItemCursor(firstPage[1]!), null);

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(1);
    expect(new Set([...firstPage, ...secondPage].map((item) => item.id)).size).toBe(3);
  });

  it("rejects reuse of an idempotency key for another request", async () => {
    const repository = new Repository(env.DB);
    await repository.capture(
      userId,
      canonicalizeSourceUrl("https://youtu.be/9bZkp7q19f0"),
      null,
      "2026-08-21T12:00:00.000Z",
      "same-key",
    );
    await expect(
      repository.capture(
        userId,
        canonicalizeSourceUrl("https://youtu.be/kJQP7kiw5Fk"),
        null,
        "2026-08-21T12:00:00.000Z",
        "same-key",
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });
});

describe("authorization boundaries", () => {
  it("never returns another user's item", async () => {
    const repository = new Repository(env.DB);
    const captured = await repository.capture(
      userId,
      canonicalizeSourceUrl("https://youtu.be/3JZ_D3ELwOQ"),
      null,
      "2026-08-21T12:00:00.000Z",
      null,
    );
    await ensureUser(env.DB, "20000000-0000-4000-8000-000000000002");
    await expect(repository.requireItem("20000000-0000-4000-8000-000000000002", captured.row.id)).rejects.toMatchObject({
      code: "item_not_found",
    });
  });
});
