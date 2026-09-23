ALTER TABLE items ADD COLUMN return_cue TEXT CHECK (
  return_cue IS NULL OR return_cue IN ('stuck', 'focus', 'decision', 'date')
);

ALTER TABLE items ADD COLUMN return_at TEXT;

CREATE INDEX idx_items_user_return_cue ON items(user_id, return_cue, return_at);
