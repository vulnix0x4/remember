ALTER TABLE life_tasks ADD COLUMN repeat_every_days INTEGER CHECK (repeat_every_days BETWEEN 1 AND 365);
ALTER TABLE life_tasks ADD COLUMN not_before TEXT;
ALTER TABLE life_tasks ADD COLUMN recurrence_parent_id TEXT;
CREATE UNIQUE INDEX life_task_occurrence ON life_tasks(user_id, recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

CREATE TABLE life_brain (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL,
  state_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  dirty INTEGER NOT NULL DEFAULT 1,
  next_check_at TEXT,
  lease_id TEXT,
  lease_until TEXT,
  committed_run TEXT,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX life_brain_due ON life_brain(next_check_at);

CREATE TRIGGER brain_life_tasks_insert AFTER INSERT ON life_tasks
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_life_tasks_update AFTER UPDATE ON life_tasks
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_life_tasks_delete AFTER DELETE ON life_tasks
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_life_goals_insert AFTER INSERT ON life_goals
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_life_goals_update AFTER UPDATE ON life_goals
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_life_goals_delete AFTER DELETE ON life_goals
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_life_floor_items_insert AFTER INSERT ON life_floor_items
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_life_floor_items_update AFTER UPDATE ON life_floor_items
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_life_floor_items_delete AFTER DELETE ON life_floor_items
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_calendar_events_insert AFTER INSERT ON calendar_events
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_calendar_events_update AFTER UPDATE ON calendar_events
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_calendar_events_delete AFTER DELETE ON calendar_events
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_health_metrics_insert AFTER INSERT ON health_metrics
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_health_metrics_update AFTER UPDATE ON health_metrics
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_health_metrics_delete AFTER DELETE ON health_metrics
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_candidate_principles_insert AFTER INSERT ON candidate_principles
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_candidate_principles_update AFTER UPDATE ON candidate_principles
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_candidate_principles_delete AFTER DELETE ON candidate_principles
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_personal_signals_insert AFTER INSERT ON personal_signals
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_personal_signals_update AFTER UPDATE ON personal_signals
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_personal_signals_delete AFTER DELETE ON personal_signals
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER brain_items_insert AFTER INSERT ON items
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_items_update AFTER UPDATE ON items
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER brain_items_delete AFTER DELETE ON items
BEGIN
  UPDATE life_brain SET revision = revision + 1, dirty = 1 WHERE user_id = OLD.user_id;
END;

