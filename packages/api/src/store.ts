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
import {
  INBOX_AGENT_ID,
  mergePolicy,
  parsePolicy,
  policyJson,
  type LinePolicy,
  type PolicyPatch,
  type SummaryStyle,
} from "./lines.js";
import { ensureBuiltinAgents, migrate } from "./migrate.js";
import {
  NullLightModel,
  routeSession,
  type LightModelClassifier,
  type RouteCandidate,
} from "./router.js";

export class StoreError extends Error {
  readonly code: "invalid" | "conflict" | "not_found" | "protected" | "archived";

  constructor(code: StoreError["code"], message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

export type SessionSummary = {
  session_id: string;
  agent_id: string | null;
  reported_agent_id: string | null;
  harness: string | null;
  model: string | null;
  task: string | null;
  started_at: string | null;
  updated_at: string;
  ended_at: string | null;
  outcome: string | null;
  route_confidence: number | null;
  route_source: string | null;
  route_reason: string | null;
  agent_locked: boolean;
};

export type AgentSummary = {
  agent_id: string;
  display_name: string;
  line: string;
  avatar: string | null;
  archived: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
  session_count: number;
  running_count: number;
  last_session_id: string | null;
  preview_tasks: string[];
};

export type AgentDetail = AgentSummary & { policy: LinePolicy };

export type CreateAgentInput = {
  agent_id: string;
  display_name: string;
  line?: string;
  avatar?: string | null;
  description?: string | null;
  policy?: PolicyPatch;
};

export type UpdateAgentInput = {
  display_name?: string;
  line?: string;
  avatar?: string | null;
  description?: string | null;
  archived?: boolean;
  policy?: PolicyPatch;
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

type SessionRow = {
  session_id: string;
  agent_id: string | null;
  reported_agent_id: string | null;
  harness: string | null;
  model: string | null;
  task: string | null;
  cwd?: string | null;
  host?: string | null;
  summary?: string | null;
  started_at: string | null;
  updated_at: string;
  ended_at: string | null;
  outcome: string | null;
  route_confidence: number | null;
  route_source: string | null;
  route_reason: string | null;
  agent_locked: number;
};

type AgentRow = {
  agent_id: string;
  display_name: string;
  line: string;
  avatar: string | null;
  archived: number;
  description: string | null;
  policy_json: string | null;
  created_at: string;
  updated_at: string;
  session_count?: number;
  running_count?: number;
  last_session_id?: string | null;
  last_activity?: string | null;
};

const SLUG = /^[a-z][a-z0-9-]{0,63}$/;

const SESSION_COLUMNS = `
  session_id, agent_id, reported_agent_id, harness, model, task,
  started_at, updated_at, ended_at, outcome,
  route_confidence, route_source, route_reason, agent_locked
`;

function eventTimestamp(event: VivariumEvent, receivedAt: string): string {
  return event.at ?? receivedAt;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapSession(row: SessionRow): SessionSummary {
  return {
    session_id: row.session_id,
    agent_id: row.agent_id,
    reported_agent_id: row.reported_agent_id,
    harness: row.harness,
    model: row.model,
    task: row.task,
    started_at: row.started_at,
    updated_at: row.updated_at,
    ended_at: row.ended_at,
    outcome: row.outcome,
    route_confidence: row.route_confidence,
    route_source: row.route_source,
    route_reason: row.route_reason,
    agent_locked: row.agent_locked === 1,
  };
}

function requireSlug(value: string, field: string): string {
  const slug = value.trim();
  if (!SLUG.test(slug)) {
    throw new StoreError("invalid", `${field} must match ${SLUG.source}`);
  }
  return slug;
}

function requireDisplayName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 80) throw new StoreError("invalid", "display_name must be 1-80 characters");
  return name;
}

function cleanText(value: string | null | undefined, max: number, field: string): string | null {
  if (value == null) return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw new StoreError("invalid", `${field} must be at most ${max} characters`);
  return text;
}

export type StoreOptions = {
  classifier?: LightModelClassifier;
};

export class EventStore {
  readonly db: Database.Database;
  readonly classifier: LightModelClassifier;

  constructor(dbPath: string, opts: StoreOptions = {}) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    migrate(this.db);
    ensureBuiltinAgents(this.db);
    this.classifier = opts.classifier ?? new NullLightModel();
  }

  close(): void {
    this.db.close();
  }

  async insertEvents(events: VivariumEvent[]): Promise<number> {
    const parsed = events.map((raw) => vivariumEvent.parse(raw));
    const candidates = this.listRouteCandidates();
    const routes = new Map<number, Awaited<ReturnType<typeof routeSession>>>();
    for (let i = 0; i < parsed.length; i += 1) {
      const event = parsed[i];
      if (!event || event.type !== "session.start") continue;
      const start = sessionStartEvent.parse(event);
      routes.set(
        i,
        await routeSession(
          {
            reported_agent_id: start.agent_id,
            harness: start.harness,
            cwd: start.cwd,
            task: start.task,
          },
          candidates,
          { classifier: this.classifier },
        ),
      );
    }

    const insertEvent = this.db.prepare(
      `INSERT INTO events (session_id, type, at, payload) VALUES (@session_id, @type, @at, @payload)`,
    );
    const upsertSessionStart = this.db.prepare(`
      INSERT INTO sessions (
        session_id, agent_id, reported_agent_id, harness, model, cwd, task, host,
        started_at, updated_at, route_confidence, route_source, route_reason, agent_locked
      ) VALUES (
        @session_id, @agent_id, @reported_agent_id, @harness, @model, @cwd, @task, @host,
        @started_at, @updated_at, @route_confidence, @route_source, @route_reason, 0
      )
      ON CONFLICT(session_id) DO UPDATE SET
        agent_id = CASE WHEN sessions.agent_locked = 1 THEN sessions.agent_id ELSE excluded.agent_id END,
        reported_agent_id = excluded.reported_agent_id,
        harness = excluded.harness,
        model = excluded.model,
        cwd = excluded.cwd,
        task = excluded.task,
        host = excluded.host,
        route_confidence = CASE WHEN sessions.agent_locked = 1 THEN sessions.route_confidence ELSE excluded.route_confidence END,
        route_source = CASE WHEN sessions.agent_locked = 1 THEN sessions.route_source ELSE excluded.route_source END,
        route_reason = CASE WHEN sessions.agent_locked = 1 THEN sessions.route_reason ELSE excluded.route_reason END,
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
      INSERT INTO sessions (
        session_id, agent_id, updated_at, route_source, route_confidence, route_reason, agent_locked
      ) VALUES (
        @session_id, @agent_id, @updated_at, 'default', 0, 'no session.start yet', 0
      )
      ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at
    `);

    const tx = this.db.transaction((batch: VivariumEvent[]) => {
      for (let i = 0; i < batch.length; i += 1) {
        const event = batch[i];
        if (!event) continue;
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
          const decision = routes.get(i) ?? {
            agent_id: INBOX_AGENT_ID,
            confidence: 0,
            source: "inbox" as const,
            reason: "router missing",
          };
          upsertSessionStart.run({
            session_id: s.session_id,
            agent_id: decision.agent_id,
            reported_agent_id: s.agent_id,
            harness: s.harness,
            model: s.model,
            cwd: s.cwd,
            task: s.task,
            host: s.host,
            started_at: at,
            updated_at: at,
            route_confidence: decision.confidence,
            route_source: decision.source,
            route_reason: decision.reason,
          });
        } else if (event.type === "session.end") {
          const e = sessionEndEvent.parse(event);
          ensureSession.run({ session_id: e.session_id, agent_id: INBOX_AGENT_ID, updated_at: at });
          endSession.run({
            session_id: e.session_id,
            updated_at: at,
            ended_at: at,
            outcome: e.outcome,
            summary: e.summary ?? null,
          });
        } else {
          ensureSession.run({ session_id: event.session_id, agent_id: INBOX_AGENT_ID, updated_at: at });
          touchSession.run({ session_id: event.session_id, updated_at: at });
        }
      }
    });

    tx(parsed);
    return parsed.length;
  }

  listSessions(opts: { limit?: number; agentId?: string } = {}): SessionSummary[] {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const rows = this.db
      .prepare(
        `
        SELECT ${SESSION_COLUMNS}
        FROM sessions
        WHERE (@agent_id IS NULL OR agent_id = @agent_id)
        ORDER BY updated_at DESC
        LIMIT @limit
      `,
      )
      .all({ agent_id: opts.agentId ?? null, limit }) as SessionRow[];
    return rows.map(mapSession);
  }

  listAgents(opts: { limit?: number; includeArchived?: boolean } = {}): AgentSummary[] {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const rows = this.db
      .prepare(
        `
        SELECT
          a.agent_id, a.display_name, a.line, a.avatar, a.archived, a.description,
          a.policy_json, a.created_at, a.updated_at,
          COALESCE((SELECT COUNT(*) FROM sessions s WHERE s.agent_id = a.agent_id), 0) AS session_count,
          COALESCE((
            SELECT COUNT(*) FROM sessions s
            WHERE s.agent_id = a.agent_id AND s.ended_at IS NULL AND s.outcome IS NULL
          ), 0) AS running_count,
          (
            SELECT s.session_id FROM sessions s
            WHERE s.agent_id = a.agent_id
            ORDER BY s.updated_at DESC LIMIT 1
          ) AS last_session_id,
          (SELECT MAX(s.updated_at) FROM sessions s WHERE s.agent_id = a.agent_id) AS last_activity
        FROM agents a
        WHERE (@include_archived = 1 OR a.archived = 0)
        ORDER BY running_count DESC, COALESCE(last_activity, a.updated_at) DESC
        LIMIT @limit
      `,
      )
      .all({ include_archived: opts.includeArchived ? 1 : 0, limit }) as AgentRow[];
    const previews = this.previewTasks(rows.map((row) => row.agent_id));
    return rows.map((row) => this.toSummary(row, previews.get(row.agent_id) ?? []));
  }

  getAgent(agentId: string): AgentDetail | null {
    const row = this.db
      .prepare(
        `
        SELECT
          a.agent_id, a.display_name, a.line, a.avatar, a.archived, a.description,
          a.policy_json, a.created_at, a.updated_at,
          COALESCE((SELECT COUNT(*) FROM sessions s WHERE s.agent_id = a.agent_id), 0) AS session_count,
          COALESCE((
            SELECT COUNT(*) FROM sessions s
            WHERE s.agent_id = a.agent_id AND s.ended_at IS NULL AND s.outcome IS NULL
          ), 0) AS running_count,
          (
            SELECT s.session_id FROM sessions s
            WHERE s.agent_id = a.agent_id
            ORDER BY s.updated_at DESC LIMIT 1
          ) AS last_session_id,
          (SELECT MAX(s.updated_at) FROM sessions s WHERE s.agent_id = a.agent_id) AS last_activity
        FROM agents a
        WHERE a.agent_id = ?
      `,
      )
      .get(agentId) as AgentRow | undefined;
    if (!row) return null;
    const summary = this.toSummary(row, this.previewTasks([row.agent_id]).get(row.agent_id) ?? []);
    return { ...summary, policy: parsePolicy(row.agent_id, row.display_name, row.policy_json) };
  }

  createAgent(input: CreateAgentInput): AgentDetail {
    const agentId = requireSlug(input.agent_id, "agent_id");
    if (agentId === INBOX_AGENT_ID) throw new StoreError("conflict", "inbox already exists");
    const displayName = requireDisplayName(input.display_name);
    const line = input.line == null || input.line.trim() === "" ? agentId : requireSlug(input.line, "line");
    const avatar = cleanText(input.avatar, 200, "avatar");
    const description = cleanText(input.description, 500, "description");
    const existing = this.db.prepare(`SELECT 1 AS ok FROM agents WHERE agent_id = ?`).get(agentId);
    if (existing) throw new StoreError("conflict", "agent already exists");
    const policy = mergePolicy(
      {
        id: agentId,
        summary_style: "product" satisfies SummaryStyle,
        nudge_copy: `${displayName}：看一下这条产品线还卡在哪一步，补一句下一步。`,
        handoff_hint: `若要换马，为 ${displayName} 写清未完成目标。`,
        aliases: [],
        cwd_hints: [agentId],
      },
      input.policy ?? {},
    );
    const now = nowIso();
    this.db
      .prepare(
        `
        INSERT INTO agents (
          agent_id, display_name, line, avatar, archived, description, policy_json, created_at, updated_at
        ) VALUES (
          @agent_id, @display_name, @line, @avatar, 0, @description, @policy_json, @created_at, @updated_at
        )
      `,
      )
      .run({
        agent_id: agentId,
        display_name: displayName,
        line,
        avatar,
        description,
        policy_json: policyJson(policy),
        created_at: now,
        updated_at: now,
      });
    const created = this.getAgent(agentId);
    if (!created) throw new StoreError("not_found", "agent missing after insert");
    return created;
  }

  updateAgent(agentId: string, patch: UpdateAgentInput): AgentDetail {
    const current = this.getAgent(agentId);
    if (!current) throw new StoreError("not_found", "agent not found");
    if (patch.archived === true && agentId === INBOX_AGENT_ID) {
      throw new StoreError("protected", "inbox cannot be archived");
    }
    const sets: string[] = [];
    const params: Record<string, string | number | null> = { agent_id: agentId, updated_at: nowIso() };
    if (patch.display_name !== undefined) {
      sets.push("display_name = @display_name");
      params.display_name = requireDisplayName(patch.display_name);
    }
    if (patch.line !== undefined) {
      sets.push("line = @line");
      params.line = requireSlug(patch.line, "line");
    }
    if (patch.avatar !== undefined) {
      sets.push("avatar = @avatar");
      params.avatar = cleanText(patch.avatar, 200, "avatar");
    }
    if (patch.description !== undefined) {
      sets.push("description = @description");
      params.description = cleanText(patch.description, 500, "description");
    }
    if (patch.archived !== undefined) {
      sets.push("archived = @archived");
      params.archived = patch.archived ? 1 : 0;
    }
    if (patch.policy) {
      sets.push("policy_json = @policy_json");
      params.policy_json = policyJson(mergePolicy(current.policy, patch.policy));
    }
    if (sets.length) {
      sets.push("updated_at = @updated_at");
      this.db.prepare(`UPDATE agents SET ${sets.join(", ")} WHERE agent_id = @agent_id`).run(params);
    }
    const updated = this.getAgent(agentId);
    if (!updated) throw new StoreError("not_found", "agent not found");
    return updated;
  }

  reassignSession(sessionId: string, agentId: string): SessionSummary {
    const agent = this.db.prepare(`SELECT agent_id, archived FROM agents WHERE agent_id = ?`).get(agentId) as
      | { agent_id: string; archived: number }
      | undefined;
    if (!agent) throw new StoreError("not_found", "agent not found");
    if (agent.archived === 1) throw new StoreError("archived", "agent is archived");
    const existing = this.db.prepare(`SELECT session_id FROM sessions WHERE session_id = ?`).get(sessionId);
    if (!existing) throw new StoreError("not_found", "session not found");
    const at = nowIso();
    this.db
      .prepare(
        `
        UPDATE sessions SET
          agent_id = @agent_id,
          agent_locked = 1,
          route_source = 'brain',
          route_confidence = 1,
          route_reason = 'brain reassign',
          updated_at = @updated_at
        WHERE session_id = @session_id
      `,
      )
      .run({ agent_id: agentId, session_id: sessionId, updated_at: at });
    const row = this.db.prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE session_id = ?`).get(sessionId) as SessionRow;
    return mapSession(row);
  }

  listRouteCandidates(): RouteCandidate[] {
    const rows = this.db
      .prepare(
        `SELECT agent_id, display_name, line, archived, policy_json FROM agents`,
      )
      .all() as Array<Pick<AgentRow, "agent_id" | "display_name" | "line" | "archived" | "policy_json">>;
    return rows.map((row) => {
      const policy = parsePolicy(row.agent_id, row.display_name, row.policy_json);
      return {
        agent_id: row.agent_id,
        display_name: row.display_name,
        line: row.line,
        archived: row.archived === 1,
        aliases: policy.aliases,
        cwd_hints: policy.cwd_hints,
      };
    });
  }

  agentProgress(agentId: string): {
    running: number;
    ended: number;
    total: number;
    latest_tasks: string[];
    latest_step: string | null;
  } {
    const counts = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN ended_at IS NULL AND outcome IS NULL THEN 1 ELSE 0 END), 0) AS running,
          COALESCE(SUM(CASE WHEN ended_at IS NOT NULL OR outcome IS NOT NULL THEN 1 ELSE 0 END), 0) AS ended
        FROM sessions WHERE agent_id = ?
      `,
      )
      .get(agentId) as { total: number; running: number; ended: number };
    const tasks = this.db
      .prepare(
        `
        SELECT task FROM sessions
        WHERE agent_id = ? AND task IS NOT NULL AND trim(task) != ''
        ORDER BY updated_at DESC LIMIT 3
      `,
      )
      .all(agentId) as { task: string }[];
    const step = this.db
      .prepare(
        `
        SELECT json_extract(e.payload, '$.title') AS title
        FROM events e
        WHERE e.type = 'session.step'
          AND e.session_id IN (
            SELECT session_id FROM sessions WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 5
          )
        ORDER BY e.id DESC
        LIMIT 1
      `,
      )
      .get(agentId) as { title: string | null } | undefined;
    return {
      running: Number(counts.running) || 0,
      ended: Number(counts.ended) || 0,
      total: Number(counts.total) || 0,
      latest_tasks: tasks.map((row) => row.task),
      latest_step: step?.title ?? null,
    };
  }

  sessionIdsWithFailedSteps(sessionIds: string[]): string[] {
    if (!sessionIds.length) return [];
    const placeholders = sessionIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT session_id FROM events
        WHERE type = 'session.step'
          AND session_id IN (${placeholders})
          AND json_extract(payload, '$.status') = 'failed'
      `,
      )
      .all(...sessionIds) as { session_id: string }[];
    return rows.map((row) => row.session_id);
  }

  sessionCwd(sessionId: string): string | null {
    const row = this.db.prepare(`SELECT cwd FROM sessions WHERE session_id = ?`).get(sessionId) as
      | { cwd: string | null }
      | undefined;
    return row?.cwd ?? null;
  }

  getSession(sessionId: string): SessionDetail | null {
    const session = this.db
      .prepare(
        `
        SELECT ${SESSION_COLUMNS}, cwd, host, summary
        FROM sessions WHERE session_id = ?
      `,
      )
      .get(sessionId) as SessionRow | undefined;

    if (!session) {
      const anyEvent = this.db.prepare(`SELECT 1 FROM events WHERE session_id = ? LIMIT 1`).get(sessionId);
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

    const base = session
      ? {
          ...mapSession(session),
          cwd: session.cwd ?? null,
          host: session.host ?? null,
          summary: session.summary ?? null,
        }
      : {
          session_id: sessionId,
          agent_id: INBOX_AGENT_ID,
          reported_agent_id: null,
          harness: null,
          model: null,
          task: null,
          cwd: null,
          host: null,
          summary: null,
          started_at: null,
          updated_at: turns[0]?.at ?? nowIso(),
          ended_at: null,
          outcome: null,
          route_confidence: 0,
          route_source: "inbox",
          route_reason: "session row missing",
          agent_locked: false,
        };

    return { session: base, steps: [...stepsById.values()], turns };
  }

  countEvents(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM events`).get() as { c: number };
    return row.c;
  }

  private previewTasks(agentIds: string[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    if (!agentIds.length) return map;
    const placeholders = agentIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
        SELECT agent_id, task FROM sessions
        WHERE agent_id IN (${placeholders}) AND task IS NOT NULL AND trim(task) != ''
        ORDER BY updated_at DESC
      `,
      )
      .all(...agentIds) as { agent_id: string; task: string }[];
    for (const row of rows) {
      const list = map.get(row.agent_id) ?? [];
      if (list.length >= 2 || list.includes(row.task)) continue;
      list.push(row.task);
      map.set(row.agent_id, list);
    }
    return map;
  }

  private toSummary(row: AgentRow, previewTasks: string[]): AgentSummary {
    return {
      agent_id: row.agent_id,
      display_name: row.display_name,
      line: row.line,
      avatar: row.avatar,
      archived: row.archived === 1,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_activity: row.last_activity ?? null,
      session_count: Number(row.session_count) || 0,
      running_count: Number(row.running_count) || 0,
      last_session_id: row.last_session_id ?? null,
      preview_tasks: previewTasks,
    };
  }
}

export function openStore(dbPath: string, opts: StoreOptions = {}): EventStore {
  return new EventStore(dbPath, opts);
}
