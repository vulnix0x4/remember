import { canonicalizeSourceUrl } from "@remember/domain";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { ensureUser } from "../src/auth";
import { DeletionService } from "../src/deletion";
import { Repository } from "../src/repository";

function overrideMethod<T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]): T {
  return new Proxy(target, {
    get(current, property) {
      if (property === key) return replacement;
      const value: unknown = Reflect.get(current, property);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });
}

function request(path: string, init: RequestInit, requestEnv: Env = env) {
  return app.request(`https://remember.test${path}`, init, requestEnv);
}

async function seedVaultFile(userId: string, name: string) {
  const form = new FormData();
  form.set("file", new File([`private contents for ${name}`], name, { type: "text/plain" }));
  const response = await request("/api/life/files", { method: "POST", headers: { "x-dev-user-id": userId }, body: form });
  expect(response.status).toBe(201);
  const payload = await response.json() as { file: { id: string } };
  const row = await env.DB.prepare("SELECT object_key FROM vault_files WHERE user_id = ?1 AND id = ?2")
    .bind(userId, payload.file.id)
    .first<{ object_key: string }>();
  if (!row) throw new Error("Seeded vault file metadata is missing.");
  return { fileId: payload.file.id, objectKey: row.object_key };
}

async function seedSavedItem(userId: string, suffix: string) {
  await ensureUser(env.DB, userId);
  return new Repository(env.DB).capture(
    userId,
    canonicalizeSourceUrl(`https://example.com/delete-${suffix}`),
    null,
    "2026-08-31T20:00:00.000Z",
    null,
  );
}

async function matureAccountJob(userId: string) {
  await env.DB.prepare("UPDATE deletion_jobs SET created_at = ?2, updated_at = ?2 WHERE kind = 'account' AND resource_id = ?1")
    .bind(userId, new Date(Date.now() - 2 * 60 * 60_000).toISOString())
    .run();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("durable cross-store deletion", () => {
  it("does not touch R2 when the atomic D1 staging transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userId = "81000000-0000-4000-8000-000000000001";
    const { fileId, objectKey } = await seedVaultFile(userId, "d1-stage-failure.txt");
    let r2DeleteCalls = 0;
    const failingBatch: D1Database["batch"] = async () => { throw new Error("simulated D1 transaction failure"); };
    const trackedDelete: R2Bucket["delete"] = async (keys) => {
      r2DeleteCalls += 1;
      await env.MEDIA.delete(keys);
    };
    const failingEnv = {
      ...env,
      DB: overrideMethod(env.DB, "batch", failingBatch),
      MEDIA: overrideMethod(env.MEDIA, "delete", trackedDelete),
    } as Env;

    const response = await request(`/api/life/files/${fileId}`, {
      method: "DELETE",
      headers: { "x-dev-user-id": userId },
    }, failingEnv);

    expect(response.status).toBe(500);
    expect(r2DeleteCalls).toBe(0);
    expect(await env.DB.prepare("SELECT id FROM vault_files WHERE id = ?1").bind(fileId).first()).not.toBeNull();
    expect(await env.DB.prepare("SELECT id FROM deletion_jobs WHERE resource_id = ?1").bind(fileId).first()).toBeNull();
    expect(await env.MEDIA.head(objectKey)).not.toBeNull();
  });

  it("keeps an outbox job when R2 fails, then completes on an idempotent retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userId = "81000000-0000-4000-8000-000000000002";
    const { fileId, objectKey } = await seedVaultFile(userId, "r2-failure.txt");
    expect((await request(`/api/life/files/${fileId}`, {
      method: "DELETE",
      headers: { "x-dev-user-id": "81000000-0000-4000-8000-000000000099" },
    })).status).toBe(204);
    expect(await env.DB.prepare("SELECT id FROM vault_files WHERE id = ?1").bind(fileId).first()).not.toBeNull();
    expect(await env.MEDIA.head(objectKey)).not.toBeNull();
    const failingDelete: R2Bucket["delete"] = async () => { throw new Error("simulated R2 delete failure"); };
    const failingEnv = { ...env, MEDIA: overrideMethod(env.MEDIA, "delete", failingDelete) } as Env;

    const first = await request(`/api/life/files/${fileId}`, {
      method: "DELETE",
      headers: { "x-dev-user-id": userId },
    }, failingEnv);

    expect(first.status).toBe(204);
    expect(await env.DB.prepare("SELECT id FROM vault_files WHERE id = ?1").bind(fileId).first()).toBeNull();
    expect(await env.DB.prepare("SELECT attempts FROM deletion_jobs WHERE resource_id = ?1").bind(fileId).first<{ attempts: number }>())
      .toEqual({ attempts: 1 });
    expect(await env.MEDIA.head(objectKey)).not.toBeNull();

    expect((await request(`/api/life/files/${fileId}`, {
      method: "DELETE",
      headers: { "x-dev-user-id": userId },
    })).status).toBe(204);
    expect(await env.MEDIA.head(objectKey)).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM deletion_jobs WHERE resource_id = ?1").bind(fileId).first()).toBeNull();
    expect((await request(`/api/life/files/${fileId}`, {
      method: "DELETE",
      headers: { "x-dev-user-id": userId },
    })).status).toBe(204);
  });

  it("retries safely when D1 cannot acknowledge an already successful R2 delete", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userId = "81000000-0000-4000-8000-000000000003";
    const { fileId, objectKey } = await seedVaultFile(userId, "d1-ack-failure.txt");
    await env.DB.prepare(`CREATE TRIGGER fail_deletion_job_ack
      BEFORE DELETE ON deletion_jobs BEGIN SELECT RAISE(ABORT, 'simulated deletion acknowledgement failure'); END`).run();
    try {
      const response = await request(`/api/life/files/${fileId}`, {
        method: "DELETE",
        headers: { "x-dev-user-id": userId },
      });
      expect(response.status).toBe(204);
      expect(await env.MEDIA.head(objectKey)).toBeNull();
      expect(await env.DB.prepare("SELECT attempts FROM deletion_jobs WHERE resource_id = ?1").bind(fileId).first<{ attempts: number }>())
        .toEqual({ attempts: 1 });
    } finally {
      await env.DB.prepare("DROP TRIGGER IF EXISTS fail_deletion_job_ack").run();
    }

    expect((await request(`/api/life/files/${fileId}`, {
      method: "DELETE",
      headers: { "x-dev-user-id": userId },
    })).status).toBe(204);
    expect(await env.DB.prepare("SELECT id FROM deletion_jobs WHERE resource_id = ?1").bind(fileId).first()).toBeNull();
  });

  it("keeps account data intact when D1 cannot atomically stage its cleanup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userId = "81000000-0000-4000-8000-000000000004";
    const captured = await seedSavedItem(userId, "account-d1-failure");
    const { fileId, objectKey } = await seedVaultFile(userId, "account-d1-failure.txt");
    let r2ListCalls = 0;
    let vectorDeleteCalls = 0;
    const failingBatch: D1Database["batch"] = async () => { throw new Error("simulated account D1 transaction failure"); };
    const trackedList: R2Bucket["list"] = async (options) => {
      r2ListCalls += 1;
      return env.MEDIA.list(options);
    };
    const trackedVectorDelete: VectorizeIndex["deleteByIds"] = async (ids) => {
      vectorDeleteCalls += 1;
      return { ids, count: ids.length };
    };
    const failingEnv = {
      ...env,
      ANALYSIS_PROVIDER: "openrouter",
      DB: overrideMethod(env.DB, "batch", failingBatch),
      MEDIA: overrideMethod(env.MEDIA, "list", trackedList),
      VECTOR_INDEX: overrideMethod(env.VECTOR_INDEX, "deleteByIds", trackedVectorDelete),
    } as Env;

    const response = await request("/api/account/data", {
      method: "DELETE",
      headers: { "x-dev-user-id": userId, "x-confirm-delete": "DELETE MY DATA" },
    }, failingEnv);

    expect(response.status).toBe(500);
    expect(r2ListCalls).toBe(0);
    expect(vectorDeleteCalls).toBe(0);
    expect(await env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(userId).first()).not.toBeNull();
    expect(await env.DB.prepare("SELECT id FROM items WHERE id = ?1").bind(captured.row.id).first()).not.toBeNull();
    expect(await env.DB.prepare("SELECT id FROM vault_files WHERE id = ?1").bind(fileId).first()).not.toBeNull();
    expect(await env.DB.prepare("SELECT id FROM deletion_jobs WHERE resource_id = ?1").bind(userId).first()).toBeNull();
    expect(await env.MEDIA.head(objectKey)).not.toBeNull();
  });

  it("retries account R2 and Vectorize failures from the scheduled outbox", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r2FailureUser = "81000000-0000-4000-8000-000000000005";
    const r2Item = await seedSavedItem(r2FailureUser, "account-r2-failure");
    const r2File = await seedVaultFile(r2FailureUser, "account-r2-failure.txt");
    let prematureVectorDeletes = 0;
    const failingR2Delete: R2Bucket["delete"] = async () => { throw new Error("simulated account R2 failure"); };
    const trackedVectorDelete: VectorizeIndex["deleteByIds"] = async (ids) => {
      prematureVectorDeletes += 1;
      return { ids, count: ids.length };
    };
    const r2FailureEnv = {
      ...env,
      ANALYSIS_PROVIDER: "openrouter",
      MEDIA: overrideMethod(env.MEDIA, "delete", failingR2Delete),
      VECTOR_INDEX: overrideMethod(env.VECTOR_INDEX, "deleteByIds", trackedVectorDelete),
    } as Env;

    expect((await request("/api/account/data", {
      method: "DELETE",
      headers: { "x-dev-user-id": r2FailureUser, "x-confirm-delete": "DELETE MY DATA" },
    }, r2FailureEnv)).status).toBe(204);
    expect(prematureVectorDeletes).toBe(0);
    expect(await env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(r2FailureUser).first()).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM items WHERE id = ?1").bind(r2Item.row.id).first()).toBeNull();
    expect(await env.MEDIA.head(r2File.objectKey)).not.toBeNull();

    const completedVectorIds: string[] = [];
    const successfulVectorDelete: VectorizeIndex["deleteByIds"] = async (ids) => {
      completedVectorIds.push(...ids);
      return { ids, count: ids.length };
    };
    const retryEnv = {
      ...env,
      ANALYSIS_PROVIDER: "openrouter",
      VECTOR_INDEX: overrideMethod(env.VECTOR_INDEX, "deleteByIds", successfulVectorDelete),
    } as Env;
    await matureAccountJob(r2FailureUser);
    expect(await new DeletionService(retryEnv).drain()).toMatchObject({ processed: 1 });
    expect(completedVectorIds).toContain(r2Item.row.id);
    expect(await env.MEDIA.head(r2File.objectKey)).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM deletion_jobs WHERE resource_id = ?1").bind(r2FailureUser).first()).toBeNull();

    const vectorFailureUser = "81000000-0000-4000-8000-000000000006";
    const vectorItem = await seedSavedItem(vectorFailureUser, "account-vector-failure");
    const vectorFile = await seedVaultFile(vectorFailureUser, "account-vector-failure.txt");
    const failingVectorDelete: VectorizeIndex["deleteByIds"] = async () => { throw new Error("simulated Vectorize failure"); };
    const vectorFailureEnv = {
      ...env,
      ANALYSIS_PROVIDER: "openrouter",
      VECTOR_INDEX: overrideMethod(env.VECTOR_INDEX, "deleteByIds", failingVectorDelete),
    } as Env;

    expect((await request("/api/account/data", {
      method: "DELETE",
      headers: { "x-dev-user-id": vectorFailureUser, "x-confirm-delete": "DELETE MY DATA" },
    }, vectorFailureEnv)).status).toBe(204);
    expect(await env.MEDIA.head(vectorFile.objectKey)).toBeNull();
    expect(await env.DB.prepare("SELECT attempts FROM deletion_jobs WHERE resource_id = ?1").bind(vectorFailureUser).first<{ attempts: number }>())
      .toEqual({ attempts: 1 });

    const retriedVectorIds: string[] = [];
    const retriedVectorDelete: VectorizeIndex["deleteByIds"] = async (ids) => {
      retriedVectorIds.push(...ids);
      return { ids, count: ids.length };
    };
    const vectorRetryEnv = {
      ...env,
      ANALYSIS_PROVIDER: "openrouter",
      VECTOR_INDEX: overrideMethod(env.VECTOR_INDEX, "deleteByIds", retriedVectorDelete),
    } as Env;
    await matureAccountJob(vectorFailureUser);
    expect(await new DeletionService(vectorRetryEnv).drain()).toMatchObject({ processed: 1 });
    expect(retriedVectorIds).toContain(vectorItem.row.id);
    expect(await env.DB.prepare("SELECT id FROM deletion_jobs WHERE resource_id = ?1").bind(vectorFailureUser).first()).toBeNull();
  });
});
