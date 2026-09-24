-- Commitments (college study, gym) and chores (laundry) that recur on their own.
-- Each day's occurrence is a normal task linked back by commitment_id + occurrence_date,
-- so Jev plans them together with everything else.
CREATE TABLE life_commitments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('commitment', 'chore')),
  days INTEGER NOT NULL DEFAULT 127 CHECK (days BETWEEN 1 AND 127),
  every_days INTEGER CHECK (every_days BETWEEN 1 AND 365),
  fixed_start TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 5 AND 720),
  importance TEXT NOT NULL DEFAULT 'high' CHECK (importance IN ('must', 'high', 'normal')),
  steps_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX life_commitments_user ON life_commitments(user_id, active);

ALTER TABLE life_tasks ADD COLUMN commitment_id TEXT REFERENCES life_commitments(id) ON DELETE SET NULL;
ALTER TABLE life_tasks ADD COLUMN occurrence_date TEXT;
ALTER TABLE life_tasks ADD COLUMN actual_minutes INTEGER CHECK (actual_minutes >= 0);
CREATE UNIQUE INDEX life_task_commitment_occurrence ON life_tasks(user_id, commitment_id, occurrence_date) WHERE commitment_id IS NOT NULL;

CREATE TRIGGER brain_life_commitments_insert AFTER INSERT ON life_commitments
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;
CREATE TRIGGER brain_life_commitments_update AFTER UPDATE ON life_commitments
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;
CREATE TRIGGER brain_life_commitments_delete AFTER DELETE ON life_commitments
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;
