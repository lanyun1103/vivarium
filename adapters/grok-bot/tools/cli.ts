#!/usr/bin/env node
/**
 * Grok Bot / Cursor Temporal-style ingest helper.
 *
 * Examples:
 *   VIVARIUM_URL=http://127.0.0.1:8787 tsx tools/cli.ts start --task "Ship feature"
 *   tsx tools/cli.ts turn --session-id abc --role user --content "hello"
 *   tsx tools/cli.ts end --session-id abc --outcome success
 *   tsx tools/cli.ts post --json '[{"type":"session.start",...}]'
 */
import type { VivariumEvent } from "@vivarium/schema";
import { isoNow, redactPath, sendEvents } from "./lib.js";

const harness = "grok-bot";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function sessionId(): string {
  return arg("--session-id") ?? process.env.VIVARIUM_SESSION_ID ?? `grok-${Date.now()}`;
}

async function cmdStart(): Promise<void> {
  const sid = sessionId();
  const cwd = redactPath(arg("--cwd") ?? process.cwd());
  const events: VivariumEvent[] = [
    {
      type: "session.start",
      session_id: sid,
      at: isoNow(),
      agent_id: arg("--agent-id") ?? process.env.VIVARIUM_AGENT_ID ?? `grok-bot:${cwd.split("/").pop() ?? "agent"}`,
      harness,
      model: arg("--model") ?? process.env.VIVARIUM_MODEL ?? "grok",
      cwd,
      task: arg("--task") ?? "Grok Bot session",
      host: arg("--host") ?? process.env.VIVARIUM_HOST ?? "local",
    },
    {
      type: "session.log",
      session_id: sid,
      at: isoNow(),
      level: "info",
      message: "grok-bot CLI session.start",
    },
  ];
  await sendEvents(events);
  console.log(JSON.stringify({ ok: true, session_id: sid }));
}

async function cmdTurn(): Promise<void> {
  const sid = sessionId();
  const role = (arg("--role") ?? "user") as "user" | "assistant" | "system" | "tool";
  const content = arg("--content") ?? "";
  if (!content) throw new Error("--content required");
  await sendEvents([
    {
      type: "session.turn",
      session_id: sid,
      at: isoNow(),
      role,
      content,
      model: arg("--model"),
    },
  ]);
  console.log(JSON.stringify({ ok: true, session_id: sid }));
}

async function cmdStep(): Promise<void> {
  const sid = sessionId();
  await sendEvents([
    {
      type: "session.step",
      session_id: sid,
      at: isoNow(),
      step_id: arg("--step-id") ?? "step-1",
      title: arg("--title") ?? "Working",
      status: (arg("--status") ?? "running") as "pending" | "running" | "done" | "failed",
    },
  ]);
  console.log(JSON.stringify({ ok: true, session_id: sid }));
}

async function cmdLog(): Promise<void> {
  const sid = sessionId();
  await sendEvents([
    {
      type: "session.log",
      session_id: sid,
      at: isoNow(),
      level: (arg("--level") ?? "info") as "debug" | "info" | "warn" | "error",
      message: arg("--message") ?? "log",
    },
  ]);
  console.log(JSON.stringify({ ok: true, session_id: sid }));
}

async function cmdHeartbeat(): Promise<void> {
  const sid = sessionId();
  await sendEvents([
    {
      type: "session.heartbeat",
      session_id: sid,
      at: isoNow(),
      alive: arg("--alive") !== "false",
    },
  ]);
  console.log(JSON.stringify({ ok: true, session_id: sid }));
}

async function cmdEnd(): Promise<void> {
  const sid = sessionId();
  await sendEvents([
    {
      type: "session.end",
      session_id: sid,
      at: isoNow(),
      outcome: (arg("--outcome") ?? "success") as "success" | "failed" | "cancelled",
      summary: arg("--summary"),
    },
  ]);
  console.log(JSON.stringify({ ok: true, session_id: sid }));
}

async function cmdPost(): Promise<void> {
  const raw = arg("--json");
  if (!raw) throw new Error("--json required");
  const parsed = JSON.parse(raw) as VivariumEvent[];
  await sendEvents(parsed);
  console.log(JSON.stringify({ ok: true, accepted: parsed.length }));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "start":
      await cmdStart();
      break;
    case "turn":
      await cmdTurn();
      break;
    case "step":
      await cmdStep();
      break;
    case "log":
      await cmdLog();
      break;
    case "heartbeat":
      await cmdHeartbeat();
      break;
    case "end":
      await cmdEnd();
      break;
    case "post":
      await cmdPost();
      break;
    default:
      console.error(
        "usage: cli.ts <start|turn|step|log|heartbeat|end|post> [flags]\n" +
          "  start --task --model --cwd --session-id --agent-id\n" +
          "  turn --session-id --role user|assistant --content\n" +
          "  post --json '[{...}]'",
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
