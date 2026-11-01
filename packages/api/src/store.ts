import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { VivariumEvent } from "@vivarium/schema";
import {
  sessionEndEvent,
  sessionStartEvent,
  sessionStepEvent,
  sessionTurnEvent,
  vivariumEvent,
} from "@vivarium/schema";
import { migrate } from "./migrate.js";

export type SessionSummary = {
  session_id: string;
  agent_id: string | null;
  harness: string | null;
  model: string | null;
  task: string | null;
  started_at: string | null;
  updated_at: string;
  ended_at: string | null;
  outcome: string | null;
};

export type AgentSummary = {
  agent_id: string;
  harness: string | null;
  last_session_id: string;
  updated_at: string;
  session_count: number;
};

export type SessionDetail = {
  session: SessionSummary & {
    cwd: string | null;
    host: string | null;
    summary: string | null;
  };
  steps: Array<{
    step_id: string;
    title: string;
    status: string;
    progress?: number;
    at: string;
  }>;
  turns: Array<{
    role: string;
    content: string;
    tool_calls?: unknown;
    model?: string;
    tokens?: unknown;
    at: string;
  }>;
};

function eventTimestamp(event: VivariumEvent, receivedAt: string): string {
  return event.at ?? receivedAt;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class EventStore {
  readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    migrate(this.db);
  }

  close(): void {
    this.db.close();
  }

  insertEvents(events: VivariumEvent[]): number {
    const insertEvent = this.db.prepare(
      `INSERT INTO events (session_id, type, at, payload) VALUES (@session_id, @type, @at, @payload)`,
    );
    const upsertSessionStart = this.db.prepare(`
      INSERT INTO sessions (
        session_id, agent_id, harness, model, cwd, task, host, started_at, updated_at
      ) VALUES (
        @session_id, @agent_id, @harness, @model, @cwd, @task, @host, @started_at, @updated_at
      )
      ON CONFLICT(session_id) DO UPDATE SET
        agent_id = excluded.agent_id,
        harness = excluded.harness,
        model = excluded.model,
        cwd = excluded.cwd,
        task = excluded.task,
        host = excluded.host,
        started_at = COALESCE(sessions.started_at, excluded.started_at),
        updated_at = excluded.updated_at
    `);
    const touchSession = this.db.prepare(
      `UPDATE sessions SET updated_at = @updated_at WHERE session_id = @session_id`,
    );
    const endSession = this.db.prepare(`
      UPDATE sessions SET
        updated_at = @updated_at,
        ended_at = @ended_at,
        outcome = @outcome,
        summary = @summary
      WHERE session_id = @session_id
    `);
    const ensureSession = this.db.prepare(`
      INSERT INTO sessions (session_id, updated_at) VALUES (@session_id, @updated_at)
      ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at
    `);

    const tx = this.db.transaction((batch: VivariumEvent[]) => {
      for (const raw of batch) {
        const event = vivariumEvent.parse(raw);
        const receivedAt = nowIso();
        const at = eventTimestamp(event, receivedAt);

        insertEvent.run({
          session_id: event.session_id,
          type: event.type,
          at,
          payload: JSON.stringify(event),
        });

        if (event.type === "session.start") {
          const s = sessionStartEvent.parse(event);
          upsertSessionStart.run({
            session_id: s.session_id,
            agent_id: s.agent_id,
            harness: s.harness,
            model: s.model,
            cwd: s.cwd,
            task: s.task,
            host: s.host,
            started_at: at,
            updated_at: at,
          });
        } else if (event.type === "session.end") {
          const e = sessionEndEvent.parse(event);
          ensureSession.run({ session_id: e.session_id, updated_at: at });
          endSession.run({
            session_id: e.session_id,
            updated_at: at,
            ended_at: at,
            outcome: e.outcome,
            summary: e.summary ?? null,
          });
        } else {
          ensureSession.run({ session_id: event.session_id, updated_at: at });
          touchSession.run({ session_id: event.session_id, updated_at: at });
        }
      }
    });

    tx(events);
    return events.length;
  }

  listSessions(limit = 50): SessionSummary[] {
    const rows = this.db
      .prepare(
        `
        SELECT session_id, agent_id, harness, model, task, started_at, updated_at, ended_at, outcome
        FROM sessions
        ORDER BY updated_at DESC
        LIMIT ?
      `,
      )
      .all(limit) as SessionSummary[];
    return rows;
  }

  listAgents(limit = 50): AgentSummary[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          agent_id,
          harness,
          session_id AS last_session_id,
          updated_at,
          COUNT(*) OVER (PARTITION BY agent_id) AS session_count
        FROM sessions
        WHERE agent_id IS NOT NULL
        ORDER BY updated_at DESC
      `,
      )
      .all() as AgentSummary[];

    const seen = new Set<string>();
    const out: AgentSummary[] = [];
    for (const row of rows) {
      if (seen.has(row.agent_id)) continue;
      seen.add(row.agent_id);
      out.push(row);
      if (out.length >= limit) break;
    }
    return out;
  }

  getSession(sessionId: string): SessionDetail | null {
    const session = this.db
      .prepare(
        `
        SELECT session_id, agent_id, harness, model, cwd, task, host,
               started_at, updated_at, ended_at, outcome, summary
        FROM sessions WHERE session_id = ?
      `,
      )
      .get(sessionId) as SessionDetail["session"] | undefined;

    if (!session) {
      const anyEvent = this.db
        .prepare(`SELECT 1 FROM events WHERE session_id = ? LIMIT 1`)
        .get(sessionId);
      if (!anyEvent) return null;
    }

    const stepRows = this.db
      .prepare(
        `
        SELECT payload FROM events
        WHERE session_id = ? AND type = 'session.step'
        ORDER BY id ASC
      `,
      )
      .all(sessionId) as { payload: string }[];

    const stepsById = new Map<string, SessionDetail["steps"][number]>();
    for (const row of stepRows) {
      const parsed = sessionStepEvent.parse(JSON.parse(row.payload));
      stepsById.set(parsed.step_id, {
        step_id: parsed.step_id,
        title: parsed.title,
        status: parsed.status,
        progress: parsed.progress,
        at: parsed.at ?? nowIso(),
      });
    }

    const turnRows = this.db
      .prepare(
        `
        SELECT payload FROM events
        WHERE session_id = ? AND type = 'session.turn'
        ORDER BY id ASC
      `,
      )
      .all(sessionId) as { payload: string }[];

    const turns = turnRows.map((row) => {
      const t = sessionTurnEvent.parse(JSON.parse(row.payload));
      return {
        role: t.role,
        content: t.content,
        tool_calls: t.tool_calls,
        model: t.model,
        tokens: t.tokens,
        at: t.at ?? nowIso(),
      };
    });

    const baseSession: SessionDetail["session"] = session ?? {
      session_id: sessionId,
      agent_id: null,
      harness: null,
      model: null,
      cwd: null,
      task: null,
      host: null,
      started_at: null,
      updated_at: turns[0]?.at ?? nowIso(),
      ended_at: null,
      outcome: null,
      summary: null,
    };

    return {
      session: baseSession,
      steps: [...stepsById.values()],
      turns,
    };
  }

  countEvents(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM events`).get() as { c: number };
    return row.c;
  }
}

export function openStore(dbPath: string): EventStore {
  return new EventStore(dbPath);
}
