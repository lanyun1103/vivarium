import type Database from "better-sqlite3";
import { BUILTIN_LINES, INBOX_AGENT_ID, policyJson } from "./lines.js";

const V1_SQL = `
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

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

function currentVersion(db: Database.Database): number {
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null } | undefined;
  return row?.v ?? 0;
}

function addColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((col) => col.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function ensureBuiltinAgents(db: Database.Database, now = new Date().toISOString()): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO agents (
      agent_id, display_name, line, avatar, archived, description, policy_json, created_at, updated_at
    ) VALUES (
      @agent_id, @display_name, @line, @avatar, 0, @description, @policy_json, @created_at, @updated_at
    )
  `);
  for (const line of BUILTIN_LINES) {
    stmt.run({
      agent_id: line.agent_id,
      display_name: line.display_name,
      line: line.line,
      avatar: line.avatar,
      description: line.description,
      policy_json: policyJson(line.policy),
      created_at: now,
      updated_at: now,
    });
  }
}

function applyV2(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      line TEXT NOT NULL,
      avatar TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      policy_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  addColumn(db, "sessions", "reported_agent_id", "TEXT");
  addColumn(db, "sessions", "route_confidence", "REAL");
  addColumn(db, "sessions", "route_source", "TEXT");
  addColumn(db, "sessions", "route_reason", "TEXT");
  addColumn(db, "sessions", "agent_locked", "INTEGER NOT NULL DEFAULT 0");
  ensureBuiltinAgents(db);
  db.prepare(`
    UPDATE sessions
    SET
      reported_agent_id = COALESCE(reported_agent_id, agent_id),
      agent_id = ?,
      route_source = 'migrate',
      route_confidence = 0,
      route_reason = 'legacy agent_id was not a product line; moved to inbox'
    WHERE agent_id IS NULL
       OR agent_id NOT IN (SELECT agent_id FROM agents)
  `).run(INBOX_AGENT_ID);
}

/** Additive migrations. v1 = events/sessions, v2 = product-line agents. */
export function migrate(db: Database.Database): void {
  db.exec(V1_SQL);
  if (currentVersion(db) < 1) {
    db.prepare("INSERT INTO schema_migrations (version) VALUES (1)").run();
  }
  if (currentVersion(db) < 2) {
    applyV2(db);
    db.prepare("INSERT INTO schema_migrations (version) VALUES (2)").run();
  }
}
