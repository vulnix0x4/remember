ALTER TABLE life_tasks ADD COLUMN source_item_id TEXT REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE life_tasks ADD COLUMN practice_outcome TEXT CHECK (practice_outcome IN ('helped', 'mixed', 'not_for_me'));
ALTER TABLE life_tasks ADD COLUMN practice_reflection TEXT NOT NULL DEFAULT '';
ALTER TABLE life_tasks ADD COLUMN reflected_at TEXT;

CREATE INDEX idx_life_tasks_user_practice_result
  ON life_tasks(user_id, source, practice_outcome, reflected_at DESC);
