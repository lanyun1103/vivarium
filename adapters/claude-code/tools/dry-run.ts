import { postEvents } from "./post-events.js";
import type { VivariumEvent } from "@vivarium/schema";

const sessionId = process.env.VIVARIUM_DRY_RUN_SESSION ?? `dry-run-${Date.now()}`;

export const dryRunFixture: VivariumEvent[] = [
  {
    type: "session.start",
    session_id: sessionId,
    at: new Date().toISOString(),
    agent_id: "claude-code:dry-run",
    harness: "claude-code",
    model: "fixture-model",
    cwd: "~/vivarium",
    task: "Dry-run fixture session (no Claude Code required)",
    host: "fixture",
  },
  {
    type: "session.turn",
    session_id: sessionId,
    at: new Date().toISOString(),
    role: "user",
    content: "Sample user prompt from fixture",
  },
  {
    type: "session.turn",
    session_id: sessionId,
    at: new Date().toISOString(),
    role: "assistant",
    content: "Sample assistant reply (fixture only — real turns need UserPromptSubmit hook)",
  },
  {
    type: "session.log",
    session_id: sessionId,
    at: new Date().toISOString(),
    level: "info",
    message: "dry-run fixture",
  },
  {
    type: "session.end",
    session_id: sessionId,
    at: new Date().toISOString(),
    outcome: "success",
    summary: "dry-run complete",
  },
];

async function main(): Promise<void> {
  const baseUrl = process.env.VIVARIUM_URL;
  if (!baseUrl) {
    console.error("Set VIVARIUM_URL to post the dry-run fixture (e.g. http://127.0.0.1:8787)");
    process.exit(1);
  }

  const ok = await postEvents(dryRunFixture, { softFail: false, validate: true });
  if (!ok) process.exit(1);
  console.log(JSON.stringify({ ok: true, session_id: sessionId }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
