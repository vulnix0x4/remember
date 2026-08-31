PRAGMA foreign_keys = ON;

CREATE TABLE life_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('health', 'work', 'relationships', 'environment', 'money', 'growth', 'direction')),
  vision TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE life_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES life_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  first_step TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL CHECK (area IN ('health', 'work', 'relationships', 'environment', 'money', 'growth', 'direction')),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'queued', 'active', 'waiting', 'done', 'removed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'must')),
  energy TEXT NOT NULL DEFAULT 'any' CHECK (energy IN ('low', 'medium', 'high', 'any')),
  duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (duration_minutes BETWEEN 2 AND 720),
  due_at TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'goal', 'mission', 'practice', 'calendar', 'health', 'floor')),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX idx_life_tasks_one_active ON life_tasks(user_id) WHERE status = 'active';

CREATE TABLE life_task_blockers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES life_tasks(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('big', 'unclear', 'time', 'place', 'irrelevant', 'different')),
  original_duration INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE life_floor_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('health', 'work', 'relationships', 'environment', 'money', 'growth', 'direction')),
  target INTEGER NOT NULL CHECK (target BETWEEN 1 AND 100),
  unit TEXT NOT NULL,
  completion_dates_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'apple', 'google', 'outlook', 'task')),
  calendar_name TEXT NOT NULL DEFAULT 'Personal',
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  url TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, source, external_id)
) STRICT;

CREATE TABLE health_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('steps', 'active_energy', 'exercise_minutes', 'sleep', 'weight', 'resting_heart_rate', 'heart_rate_variability', 'workout', 'water', 'mindful_minutes')),
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, source, external_id)
) STRICT;

CREATE TABLE finance_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'cash', 'loan', 'other')),
  balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'provider')),
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, source, external_id)
) STRICT;

CREATE TABLE finance_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES finance_accounts(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  merchant TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL DEFAULT 'Uncategorized',
  occurred_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('pending', 'posted')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, external_id)
) STRICT;

CREATE TABLE vault_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  folder TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_life_goals_user_status ON life_goals(user_id, status, updated_at DESC);
CREATE INDEX idx_life_tasks_user_status ON life_tasks(user_id, status, due_at, created_at);
CREATE INDEX idx_life_blockers_user_date ON life_task_blockers(user_id, created_at DESC);
CREATE INDEX idx_calendar_events_user_start ON calendar_events(user_id, start_at, end_at);
CREATE INDEX idx_health_metrics_user_type_date ON health_metrics(user_id, type, start_at DESC);
CREATE INDEX idx_finance_accounts_user ON finance_accounts(user_id, updated_at DESC);
CREATE INDEX idx_finance_transactions_user_date ON finance_transactions(user_id, occurred_at DESC);
CREATE INDEX idx_vault_files_user_date ON vault_files(user_id, created_at DESC);
