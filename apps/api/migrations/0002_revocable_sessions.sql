CREATE TABLE login_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;

CREATE INDEX idx_login_sessions_user_active ON login_sessions(user_id, expires_at, revoked_at);
