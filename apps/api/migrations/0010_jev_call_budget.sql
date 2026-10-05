-- Jev's last answers, so timer-driven replans can reuse them instead of calling OpenRouter again.
ALTER TABLE life_brain ADD COLUMN judgments_json TEXT;
ALTER TABLE life_brain ADD COLUMN judged_at TEXT;
-- Stamped by API mutations; planning waits for a quiet moment so a burst of edits costs one call.
ALTER TABLE life_brain ADD COLUMN changed_at TEXT;
