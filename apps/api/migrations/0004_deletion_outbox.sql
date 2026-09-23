PRAGMA foreign_keys = ON;

CREATE TABLE deletion_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vault_file', 'account')),
  resource_id TEXT NOT NULL,
  object_key TEXT,
  object_prefixes_json TEXT NOT NULL DEFAULT '[]',
  vector_ids_json TEXT NOT NULL DEFAULT '[]',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, kind, resource_id)
) STRICT;

CREATE INDEX idx_deletion_jobs_drain ON deletion_jobs(updated_at, created_at);
