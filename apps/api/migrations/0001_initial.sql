PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('youtube', 'web')),
  canonical_url TEXT NOT NULL UNIQUE,
  external_id TEXT,
  title TEXT,
  author TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  original_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'partial', 'failed')),
  personal_reaction TEXT,
  captured_timestamp_seconds INTEGER CHECK (captured_timestamp_seconds IS NULL OR captured_timestamp_seconds >= 0),
  saved_at TEXT NOT NULL,
  processing_started_at TEXT,
  processed_at TEXT,
  processing_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, canonical_url)
) STRICT;

CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  contract_version INTEGER NOT NULL DEFAULT 1,
  essence TEXT NOT NULL,
  summary TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE moments (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  seconds INTEGER NOT NULL CHECK (seconds >= 0),
  label TEXT NOT NULL,
  context TEXT NOT NULL,
  source_verified INTEGER NOT NULL DEFAULT 0 CHECK (source_verified IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  normalized_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE item_topics (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  PRIMARY KEY(item_id, topic_id)
) STRICT;

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('related_to', 'supports', 'contradicts', 'extends', 'same_theme', 'changed_into')),
  explanation TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance TEXT NOT NULL CHECK (provenance IN ('heuristic', 'manual', 'model')),
  created_at TEXT NOT NULL,
  CHECK (from_item_id <> to_item_id),
  UNIQUE(user_id, from_item_id, to_item_id, type)
) STRICT;

CREATE TABLE personal_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reaction', 'still_true', 'changed_mind', 'not_sure', 'no_longer_relevant', 'resurfacing_rating')),
  value_text TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE candidate_principles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'dismissed', 'retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE resurfacing_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  surfaced_at TEXT NOT NULL,
  response TEXT CHECK (response IS NULL OR response IN ('still_true', 'changed_mind', 'not_sure', 'no_longer_relevant')),
  responded_at TEXT
) STRICT;

CREATE TABLE chat_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('json', 'markdown')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  r2_key TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
) STRICT;

CREATE TABLE ingestion_jobs (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  workflow_instance_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE idempotency_keys (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, key)
) STRICT;

CREATE TABLE rate_limits (
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(actor_id, action, window_start)
) STRICT;

CREATE VIRTUAL TABLE item_search USING fts5(
  item_id UNINDEXED,
  user_id UNINDEXED,
  title,
  essence,
  summary,
  themes,
  personal_context,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE INDEX idx_items_user_saved ON items(user_id, saved_at DESC);
CREATE INDEX idx_items_user_status ON items(user_id, status, saved_at DESC);
CREATE INDEX idx_moments_item_seconds ON moments(item_id, seconds);
CREATE INDEX idx_connections_user_from ON connections(user_id, from_item_id);
CREATE INDEX idx_connections_user_to ON connections(user_id, to_item_id);
CREATE INDEX idx_signals_user_occurred ON personal_signals(user_id, occurred_at DESC);
CREATE INDEX idx_resurfacing_user_date ON resurfacing_events(user_id, surfaced_at DESC);
CREATE INDEX idx_chat_messages_thread_date ON chat_messages(thread_id, created_at);
CREATE INDEX idx_rate_limits_expiry ON rate_limits(expires_at);
