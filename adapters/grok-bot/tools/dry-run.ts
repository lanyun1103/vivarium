import type { VivariumEvent } from "@vivarium/schema";
import { isoNow, sendEvents } from "./lib.js";

const sessionId = process.env.VIVARIUM_DRY_RUN_SESSION ?? `grok-dry-run-${Date.now()}`;

const events: VivariumEvent[] = [
  {
    type: "session.start",
    session_id: sessionId,
    at: isoNow(),
    agent_id: "grok-bot:dry-run",
    harness: "grok-bot",
    model: "grok-3-fixture",
    cwd: "~/project",
    task: "Grok Bot dry-run — visible in Vivarium web UI",
    host: "fixture",
  },
  {
    type: "session.step",
    session_id: sessionId,
    at: isoNow(),
    step_id: "plan",
    title: "Plan response",
    status: "running",
  },
  {
    type: "session.turn",
    session_id: sessionId,
    at: isoNow(),
    role: "user",
    content: "Summarize the Vivarium adapter layout.",
  },
  {
    type: "session.turn",
    session_id: sessionId,
    at: isoNow(),
    role: "assistant",
    content: "Grok Bot posts session.* events via the grok-bot CLI helper.",
  },
  {
    type: "session.heartbeat",
    session_id: sessionId,
    at: isoNow(),
    alive: true,
    metrics: { source: "dry-run" },
  },
  {
    type: "session.step",
    session_id: sessionId,
    at: isoNow(),
    step_id: "plan",
    title: "Plan response",
    status: "done",
  },
  {
    type: "session.log",
    session_id: sessionId,
    at: isoNow(),
    level: "info",
    message: "grok-bot dry-run complete",
  },
  {
    type: "session.end",
    session_id: sessionId,
    at: isoNow(),
    outcome: "success",
    summary: "dry-run",
  },
];

async function main(): Promise<void> {
  await sendEvents(events);
  console.log(JSON.stringify({ ok: true, session_id: sessionId, harness: "grok-bot" }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
