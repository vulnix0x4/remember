import { safeErrorMessage } from "./http";

type DeletionJobKind = "vault_file" | "account";

interface DeletionJobRow {
  id: string;
  user_id: string;
  kind: DeletionJobKind;
  resource_id: string;
  object_key: string | null;
  object_prefixes_json: string;
  vector_ids_json: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface DeletionJob {
  id: string;
  userId: string;
  kind: DeletionJobKind;
  resourceId: string;
  objectKey: string | null;
  objectPrefixes: string[];
  vectorIds: string[];
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

type DeletionEnv = Pick<Env, "DB" | "MEDIA" | "VECTOR_INDEX" | "ANALYSIS_PROVIDER">;

const JOB_SELECT = `SELECT id, user_id, kind, resource_id, object_key, object_prefixes_json,
  vector_ids_json, attempts, created_at, updated_at FROM deletion_jobs`;
// A second pass after in-flight uploads/exports have ended prevents late writes from escaping account cleanup.
const ACCOUNT_SETTLE_MS = 60 * 60 * 1_000;

function nowIso(): string {
  return new Date().toISOString();
}

function stringArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("Deletion job contains an invalid string list.");
  }
  return parsed;
}

function deletionJob(row: DeletionJobRow): DeletionJob {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    resourceId: row.resource_id,
    objectKey: row.object_key,
    objectPrefixes: stringArray(row.object_prefixes_json),
    vectorIds: stringArray(row.vector_ids_json),
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DeletionService {
  constructor(private readonly env: DeletionEnv) {}

  async stageVaultFile(userId: string, fileId: string): Promise<DeletionJob | null> {
    const pending = await this.findJob(userId, "vault_file", fileId);
    if (pending) return pending;

    const file = await this.env.DB.prepare("SELECT object_key FROM vault_files WHERE user_id = ?1 AND id = ?2")
      .bind(userId, fileId)
      .first<{ object_key: string }>();
    if (!file) return null;

    const jobId = `vault-file:${fileId}`;
    const now = nowIso();
    await this.env.DB.batch([
      this.env.DB.prepare(`INSERT INTO deletion_jobs
        (id,user_id,kind,resource_id,object_key,object_prefixes_json,vector_ids_json,created_at,updated_at)
        VALUES (?1,?2,'vault_file',?3,?4,'[]','[]',?5,?5)
        ON CONFLICT(user_id,kind,resource_id) DO NOTHING`)
        .bind(jobId, userId, fileId, file.object_key, now),
      this.env.DB.prepare("DELETE FROM vault_files WHERE user_id = ?1 AND id = ?2")
        .bind(userId, fileId),
    ]);
    return this.requireJob(userId, "vault_file", fileId);
  }

  async stageAccount(userId: string): Promise<DeletionJob> {
    const pending = await this.findJob(userId, "account", userId);
    const vectorIds = pending
      ? pending.vectorIds
      : (await this.env.DB.prepare("SELECT id FROM items WHERE user_id = ?1 ORDER BY id")
        .bind(userId)
        .all<{ id: string }>()).results.map((row) => row.id);
    const jobId = pending?.id ?? `account:${userId}`;
    const now = nowIso();

    await this.env.DB.batch([
      this.env.DB.prepare(`INSERT INTO deletion_jobs
        (id,user_id,kind,resource_id,object_key,object_prefixes_json,vector_ids_json,created_at,updated_at)
        VALUES (?1,?2,'account',?2,NULL,?3,?4,?5,?5)
        ON CONFLICT(user_id,kind,resource_id) DO NOTHING`)
        .bind(jobId, userId, JSON.stringify([`exports/${userId}/`, `vault/${userId}/`]), JSON.stringify(vectorIds), now),
      this.env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(userId),
      this.env.DB.prepare("DELETE FROM sources WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.source_id = sources.id)"),
    ]);
    return this.requireJob(userId, "account", userId);
  }

  async tryProcess(job: DeletionJob): Promise<boolean> {
    try {
      return await this.process(job);
    } catch (error) {
      await this.recordFailure(job.id, job.kind, error);
      return false;
    }
  }

  async drain(limit = 100): Promise<{ processed: number; pending: number }> {
    const rows = await this.env.DB.prepare(`${JOB_SELECT} ORDER BY updated_at, created_at LIMIT ?1`)
      .bind(limit)
      .all<DeletionJobRow>();
    let processed = 0;
    for (const row of rows.results) {
      try {
        if (await this.tryProcess(deletionJob(row))) processed += 1;
      } catch (error) {
        await this.recordFailure(row.id, row.kind, error);
      }
    }
    return { processed, pending: rows.results.length - processed };
  }

  private async process(job: DeletionJob): Promise<boolean> {
    if (job.objectKey) await this.env.MEDIA.delete(job.objectKey);
    for (const prefix of job.objectPrefixes) await this.deletePrefix(prefix);
    if (job.vectorIds.length && String(this.env.ANALYSIS_PROVIDER) !== "mock") {
      for (let start = 0; start < job.vectorIds.length; start += 1_000) {
        await this.env.VECTOR_INDEX.deleteByIds(job.vectorIds.slice(start, start + 1_000));
      }
    }
    const createdAt = Date.parse(job.createdAt);
    if (!Number.isFinite(createdAt)) throw new Error("Deletion job has an invalid creation timestamp.");
    if (job.kind === "account" && Date.now() - createdAt < ACCOUNT_SETTLE_MS) return false;
    await this.env.DB.prepare("DELETE FROM deletion_jobs WHERE id = ?1").bind(job.id).run();
    return true;
  }

  private async deletePrefix(prefix: string): Promise<void> {
    while (true) {
      const listed = await this.env.MEDIA.list({ prefix, limit: 1_000 });
      if (!listed.objects.length) return;
      await this.env.MEDIA.delete(listed.objects.map((object) => object.key));
    }
  }

  private async recordFailure(jobId: string, kind: DeletionJobKind, error: unknown): Promise<void> {
    const message = safeErrorMessage(error);
    console.error(JSON.stringify({ message: "deletion cleanup deferred", jobId, kind, error: message }));
    try {
      await this.env.DB.prepare("UPDATE deletion_jobs SET attempts = attempts + 1, last_error = ?2, updated_at = ?3 WHERE id = ?1")
        .bind(jobId, message, nowIso())
        .run();
    } catch (recordError) {
      console.error(JSON.stringify({ message: "deletion cleanup failure could not be recorded", jobId, error: safeErrorMessage(recordError) }));
    }
  }

  private async findJob(userId: string, kind: DeletionJobKind, resourceId: string): Promise<DeletionJob | null> {
    const row = await this.env.DB.prepare(`${JOB_SELECT} WHERE user_id = ?1 AND kind = ?2 AND resource_id = ?3`)
      .bind(userId, kind, resourceId)
      .first<DeletionJobRow>();
    return row ? deletionJob(row) : null;
  }

  private async requireJob(userId: string, kind: DeletionJobKind, resourceId: string): Promise<DeletionJob> {
    const job = await this.findJob(userId, kind, resourceId);
    if (!job) throw new Error("Deletion job could not be read after it was staged.");
    return job;
  }
}
