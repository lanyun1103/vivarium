import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import type { VivariumEvent } from "@vivarium/schema";
import { createApp } from "./app.js";
import { BUILTIN_LINES } from "./lines.js";
import {
  DeterministicLightModel,
  HttpLightModel,
  NullLightModel,
  createLightModelFromEnv,
  routeSession,
  type RouteCandidate,
} from "./router.js";
import { openStore, type EventStore } from "./store.js";

function candidates(extra: RouteCandidate[] = []): RouteCandidate[] {
  return [
    ...BUILTIN_LINES.map((line) => ({
      agent_id: line.agent_id,
      display_name: line.display_name,
      line: line.line,
      archived: false,
      aliases: line.policy.aliases,
      cwd_hints: line.policy.cwd_hints,
    })),
    ...extra,
  ];
}

function start(partial: Partial<VivariumEvent> & { session_id: string; task: string }): VivariumEvent {
  return {
    type: "session.start",
    at: "2026-11-01T00:00:00Z",
    agent_id: "claude-code:dry-run",
    harness: "claude-code",
    model: "fixture",
    cwd: "~/src/app",
    host: "local",
    ...partial,
  } as VivariumEvent;
}

function tempStore(classifier = new DeterministicLightModel()): { store: EventStore; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "vivarium-m7-"));
  const store = openStore(join(dir, "t.db"), { classifier });
  return { store, cleanup: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe("light router", () => {
  const lines = candidates();

  it("routes #tags and cwd and keywords before a harness-scoped id", async () => {
    const tagged = await routeSession(
      { reported_agent_id: "claude-code:dry-run", task: "排查告警 #天眼", cwd: "~/src/app", harness: "claude-code" },
      lines,
    );
    assert.equal(tagged.agent_id, "tianyan");
    assert.equal(tagged.source, "rule");
    assert.ok(tagged.confidence >= 0.6);

    const cwd = await routeSession(
      { reported_agent_id: "grok-bot:job", task: "hello", cwd: "~/src/company/api", harness: "grok-bot" },
      lines,
    );
    assert.equal(cwd.agent_id, "company");
    assert.match(cwd.reason, /cwd/);

    const keyword = await routeSession(
      { reported_agent_id: "paseo:demo-agent", task: "看看飞书告警", cwd: "~/misc", harness: "paseo" },
      lines,
    );
    assert.equal(keyword.agent_id, "feishu-monitor");
  });

  it("keeps an explicit product-line id and sends unknown harness ids to inbox", async () => {
    const explicit = await routeSession(
      { reported_agent_id: "tianyan", task: "plain task", cwd: "~/misc", harness: "claude-code" },
      lines,
    );
    assert.equal(explicit.agent_id, "tianyan");
    assert.equal(explicit.source, "explicit");

    const inbox = await routeSession(
      { reported_agent_id: "claude-code:dry-run", task: "plain task", cwd: "~/vivarium", harness: "claude-code" },
      lines,
      { classifier: new NullLightModel() },
    );
    assert.equal(inbox.agent_id, "inbox");
    assert.equal(inbox.source, "inbox");
  });

  it("does not assign a below-threshold model guess", async () => {
    const low = await routeSession(
      { reported_agent_id: "claude-code:x", task: "unrelated", cwd: "/tmp/llm:low:tianyan", harness: "claude-code" },
      lines,
      { classifier: new DeterministicLightModel() },
    );
    assert.equal(low.agent_id, "inbox");
    assert.match(low.reason, /tianyan/);
    assert.match(low.reason, /threshold/);

    const high = await routeSession(
      { reported_agent_id: "claude-code:x", task: "nothing to see", cwd: "/tmp/llm:company", harness: "claude-code" },
      lines,
      { classifier: new DeterministicLightModel() },
    );
    assert.equal(high.agent_id, "company");
    assert.equal(high.source, "model");

    const tagWins = await routeSession(
      { reported_agent_id: "claude-code:x", task: "#天眼 llm:company", cwd: "~/x", harness: "claude-code" },
      lines,
      { classifier: new DeterministicLightModel() },
    );
    assert.equal(tagWins.agent_id, "tianyan");
    assert.equal(tagWins.source, "rule");
  });

  it("refuses archived lines and unknown model ids", async () => {
    const archived = candidates().map((line) => (line.agent_id === "tianyan" ? { ...line, archived: true } : line));
    const decision = await routeSession({ task: "go #天眼", reported_agent_id: "claude-code:x" }, archived);
    assert.equal(decision.agent_id, "inbox");
    assert.match(decision.reason, /archived/);

    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ agent_id: "not-a-line", confidence: 0.99, reason: "nope" }), { status: 200 });
    const model = new HttpLightModel("http://model.test/classify", "secret", fetchImpl);
    const unknown = await routeSession(
      { reported_agent_id: "claude-code:x", task: "zzz", cwd: "~/x" },
      lines,
      { classifier: model },
    );
    assert.equal(unknown.agent_id, "inbox");
  });

  it("calls the light-model hook with candidates and ignores transport failures", async () => {
    let auth = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      auth = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ agent_id: "reverse", confidence: 0.8, reason: "hook" }), { status: 200 });
    };
    const model = new HttpLightModel("http://model.test/classify", "secret", fetchImpl);
    const ok = await routeSession({ task: "no keywords here", reported_agent_id: "claude-code:x", cwd: "~/x" }, lines, {
      classifier: model,
    });
    assert.equal(auth, "Bearer secret");
    assert.equal(ok.agent_id, "reverse");
    assert.equal(ok.source, "model");

    const down = new HttpLightModel("http://model.test/classify", "secret", async () => new Response("no", { status: 503 }));
    const missed = await down.classify({ task: "x" }, []);
    assert.equal(missed, null);
    assert.equal(createLightModelFromEnv({}).name, "none");
    assert.equal(createLightModelFromEnv({ VIVARIUM_LIGHT_MODEL: "stub" }).name, "deterministic-stub");
    assert.equal(
      createLightModelFromEnv({ VIVARIUM_LIGHT_MODEL_URL: "http://model.test", VIVARIUM_LIGHT_MODEL_API_KEY: "k" }).name,
      "http",
    );
  });
});

describe("agents and ingest", () => {
  it("migrates harness-scoped ids onto inbox and keeps real lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "vivarium-m7-mig-"));
    const dbPath = join(dir, "old.db");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE sessions (
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
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      INSERT INTO schema_migrations (version) VALUES (1);
    `);
    db.prepare(
      `INSERT INTO sessions (session_id, agent_id, harness, model, cwd, task, host, started_at, updated_at)
       VALUES ('legacy', 'claude-code:dry-run', 'claude-code', 'm', '~/x', 'old', 'local', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO sessions (session_id, agent_id, harness, model, cwd, task, host, started_at, updated_at)
       VALUES ('kept', 'tianyan', 'claude-code', 'm', '~/tianyan', 'keep', 'local', '2026-11-01T00:00:00Z', '2026-11-01T00:00:01Z')`,
    ).run();
    db.close();

    const store = openStore(dbPath);
    try {
      const legacy = store.getSession("legacy");
      const kept = store.getSession("kept");
      assert.equal(legacy?.session.agent_id, "inbox");
      assert.equal(legacy?.session.reported_agent_id, "claude-code:dry-run");
      assert.equal(legacy?.session.route_source, "migrate");
      assert.equal(kept?.session.agent_id, "tianyan");
      const version = store.db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number };
      assert.equal(version.v, 2);
      assert.ok(store.getAgent("inbox"));
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("routes new sessions, preserves the reported id, and locks brain reassignment", async () => {
    const { store, cleanup } = tempStore();
    try {
      const app = createApp(store);
      const created = await app.request("/v1/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_id: "billing",
          display_name: "账单",
          avatar: "🧾",
          policy: { aliases: ["billing"], nudge_copy: "账单线：对一下金额。" },
        }),
      });
      assert.equal(created.status, 201);
      const dup = await app.request("/v1/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: "billing", display_name: "再次" }),
      });
      assert.equal(dup.status, 409);
      const protect = await app.request("/v1/agents/inbox", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      assert.equal(protect.status, 400);

      const archived = await app.request("/v1/agents/reverse", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      assert.equal(archived.status, 200);
      const hidden = await app.request("/v1/agents");
      const hiddenBody = (await hidden.json()) as { agents: Array<{ agent_id: string; display_name: string }> };
      assert.equal(hiddenBody.agents.some((agent) => agent.agent_id === "reverse"), false);
      assert.equal(hiddenBody.agents.some((agent) => agent.display_name === "天眼"), true);
      const shown = await app.request("/v1/agents?include_archived=1");
      const shownBody = (await shown.json()) as { agents: Array<{ agent_id: string }> };
      assert.equal(shownBody.agents.some((agent) => agent.agent_id === "reverse"), true);

      const accepted = await app.request("/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          events: [
            start({ session_id: "tagged", task: "排查 #天眼" }),
            start({ session_id: "loose", task: "please handle billing export" }),
            { type: "session.turn", session_id: "orphan", at: "2026-11-01T00:00:02Z", role: "user", content: "hi" },
          ],
        }),
      });
      assert.equal(accepted.status, 200);

      const tagged = store.getSession("tagged");
      assert.equal(tagged?.session.agent_id, "tianyan");
      assert.equal(tagged?.session.reported_agent_id, "claude-code:dry-run");
      const payload = store.db.prepare(`SELECT payload FROM events WHERE session_id = 'tagged' AND type = 'session.start'`).get() as {
        payload: string;
      };
      assert.equal(JSON.parse(payload.payload).agent_id, "claude-code:dry-run");

      const loose = store.getSession("loose");
      assert.equal(loose?.session.agent_id, "billing");
      const orphan = store.getSession("orphan");
      assert.equal(orphan?.session.agent_id, "inbox");

      const moved = await app.request("/v1/sessions/tagged/reassign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: "company" }),
      });
      assert.equal(moved.status, 200);
      const again = await app.request("/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: [start({ session_id: "tagged", task: "still #天眼" })] }),
      });
      assert.equal(again.status, 200);
      assert.equal(store.getSession("tagged")?.session.agent_id, "company");
      assert.equal(store.getSession("tagged")?.session.agent_locked, true);
      assert.equal(store.getSession("tagged")?.session.route_source, "brain");
    } finally {
      cleanup();
    }
  });
});

describe("brain skeleton", () => {
  it("summarizes with per-line policy and only suggests, until reassign is called", async () => {
    const { store, cleanup } = tempStore();
    try {
      const app = createApp(store);
      await store.insertEvents([
        start({ session_id: "ty", task: "watch dogs #天眼" }),
        {
          type: "session.step",
          session_id: "ty",
          at: "2026-11-01T00:00:01Z",
          step_id: "s1",
          title: "采样",
          status: "running",
        },
        start({ session_id: "co", task: "launch notes", agent_id: "company", cwd: "~/notes" }),
        {
          type: "session.end",
          session_id: "co",
          at: "2026-11-01T00:00:03Z",
          outcome: "success",
          summary: "shipped",
        },
      ]);

      const tianyan = await app.request("/v1/brain/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: "tianyan" }),
      });
      assert.equal(tianyan.status, 200);
      const tyBody = (await tianyan.json()) as {
        summary: { text: string; running: number; latest_step: string | null };
        suggestions: Array<{ kind: string; text: string; session_id?: string; target_agent_id?: string }>;
      };
      assert.match(tyBody.summary.text, /天眼/);
      assert.match(tyBody.summary.text, /关注步骤/);
      assert.equal(tyBody.summary.running, 1);
      assert.equal(tyBody.summary.latest_step, "采样");
      assert.ok(tyBody.suggestions.some((item) => item.kind === "summary"));
      assert.ok(tyBody.suggestions.some((item) => item.kind === "nudge" && item.text.includes("天眼")));
      assert.equal(store.getSession("ty")?.session.agent_id, "tianyan");

      const company = await app.request("/v1/brain/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: "company" }),
      });
      const coBody = (await company.json()) as {
        summary: { text: string };
        suggestions: Array<{ kind: string; text: string }>;
      };
      assert.match(coBody.summary.text, /并行/);
      assert.equal(coBody.summary.text.includes("关注步骤"), false);
      assert.ok(coBody.suggestions.some((item) => item.kind === "handoff" && item.text.includes("业务目标")));
      const eventsBefore = store.countEvents();
      const again = await app.request("/v1/brain/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: "co" }),
      });
      assert.equal(again.status, 200);
      assert.equal(store.countEvents(), eventsBefore);

      await store.insertEvents([start({ session_id: "box", task: "needs a home" })]);
      await store.createAgent({
        agent_id: "desk",
        display_name: "前台",
        policy: { aliases: ["needs a home"] },
      });
      const box = await app.request("/v1/brain/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: "box" }),
      });
      const boxBody = (await box.json()) as { suggestions: Array<{ kind: string; target_agent_id?: string }> };
      assert.ok(boxBody.suggestions.some((item) => item.kind === "reassign" && item.target_agent_id === "desk"));
      assert.equal(store.getSession("box")?.session.agent_id, "inbox");
      const applied = await app.request("/v1/sessions/box/reassign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: "desk" }),
      });
      assert.equal(applied.status, 200);
      assert.equal(store.getSession("box")?.session.agent_id, "desk");

      const patched = await app.request("/v1/agents/company", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy: { nudge_copy: "公司线自定义轻推。" } }),
      });
      assert.equal(patched.status, 200);
      const detail = (await (await app.request("/v1/agents/company")).json()) as {
        agent: { policy: { nudge_copy: string } };
        sessions: Array<{ session_id: string }>;
      };
      assert.equal(detail.agent.policy.nudge_copy, "公司线自定义轻推。");
      assert.ok(detail.sessions.some((session) => session.session_id === "co"));
    } finally {
      cleanup();
    }
  });
});
