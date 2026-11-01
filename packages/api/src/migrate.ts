import type Database from "better-sqlite3";

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    agent_id TEXT,
    harness TEXT,
    model TEXT,
    cwd TEXT,
    task TEXT,
    host TEXT,
    started_at TEXT,
    updated_at TEXT NOT NULL,
    ended_at TEXT,
    outcome TEXT,
    summary TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id, updated_at DESC);
  `,
  `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    at TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id, id);
  CREATE INDEX IF NOT EXISTS idx_events_session_type ON events(session_id, type, id);
  `,
  `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,
];

export function migrate(db: Database.Database): void {
  db.exec(MIGRATIONS.join("\n"));
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as
    | { v: number | null }
    | undefined;
  const current = row?.v ?? 0;
  const target = 1;
  if (current < target) {
    db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(target);
  }
}
