/**
 * Smoke test: persist events, reopen DB, read back via store API.
 * Run: pnpm --filter @vivarium/api smoke
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VivariumEvent } from "@vivarium/schema";
import { openStore } from "./store.js";

const sessionId = `smoke-${Date.now()}`;
const events: VivariumEvent[] = [
  {
    type: "session.start",
    session_id: sessionId,
    at: "2026-11-01T04:00:00Z",
    agent_id: "smoke-agent",
    harness: "test",
    model: "test-model",
    cwd: "~/vivarium",
    task: "persistence smoke",
    host: "ci",
  },
  {
    type: "session.step",
    session_id: sessionId,
    at: "2026-11-01T04:00:01Z",
    step_id: "s1",
    title: "Write DB",
    status: "running",
  },
  {
    type: "session.turn",
    session_id: sessionId,
    at: "2026-11-01T04:00:02Z",
    role: "user",
    content: "hello",
  },
  {
    type: "session.turn",
    session_id: sessionId,
    at: "2026-11-01T04:00:03Z",
    role: "assistant",
    content: "world",
  },
  {
    type: "session.step",
    session_id: sessionId,
    at: "2026-11-01T04:00:04Z",
    step_id: "s1",
    title: "Write DB",
    status: "done",
  },
  {
    type: "session.end",
    session_id: sessionId,
    at: "2026-11-01T04:00:05Z",
    outcome: "success",
    summary: "smoke ok",
  },
];

const dir = mkdtempSync(join(tmpdir(), "vivarium-smoke-"));
const dbPath = join(dir, "test.db");

try {
  {
    const store = openStore(dbPath);
    store.insertEvents(events);
    store.close();
  }

  const store2 = openStore(dbPath);
  const sessions = store2.listSessions(10);
  if (!sessions.some((s) => s.session_id === sessionId)) {
    throw new Error("session not listed after reopen");
  }
  const detail = store2.getSession(sessionId);
  if (!detail) throw new Error("getSession returned null");
  if (detail.turns.length !== 2) {
    throw new Error(`expected 2 turns, got ${detail.turns.length}`);
  }
  if (detail.steps.length !== 1 || detail.steps[0]?.status !== "done") {
    throw new Error("expected single merged step with status done");
  }
  if (detail.session.outcome !== "success") {
    throw new Error("expected outcome success");
  }
  const agents = store2.listAgents(10);
  if (!agents.some((a) => a.agent_id === "smoke-agent")) {
    throw new Error("agent not listed");
  }
  store2.close();

  console.log("smoke-persistence: OK", sessionId);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
