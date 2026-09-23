ALTER TABLE items ADD COLUMN memory_kind TEXT NOT NULL DEFAULT 'source'
  CHECK (memory_kind IN ('source', 'thought'));

ALTER TABLE items ADD COLUMN note_text TEXT;

CREATE INDEX idx_items_user_memory_kind_saved
  ON items(user_id, memory_kind, saved_at DESC);
