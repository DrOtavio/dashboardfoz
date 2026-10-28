CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
