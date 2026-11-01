import type { VivariumEvent } from "@vivarium/schema";
import type { PaseoRunSnapshot } from "./types.js";

const harness = "paseo";

function iso(value?: string): string {
  return value ?? new Date().toISOString();
}

export function mapPaseoRunToEvents(snapshot: PaseoRunSnapshot): VivariumEvent[] {
  const sid = snapshot.run_id;
  const events: VivariumEvent[] = [];

  events.push({
    type: "session.start",
    session_id: sid,
    at: iso(snapshot.started_at),
    agent_id: snapshot.agent_id,
    harness,
    model: snapshot.model ?? "paseo",
    cwd: snapshot.cwd ?? "~",
    task: snapshot.task ?? `Paseo run ${sid}`,
    host: snapshot.host,
  });

  for (const step of snapshot.steps ?? []) {
    events.push({
      type: "session.step",
      session_id: sid,
      at: iso(snapshot.updated_at),
      step_id: step.id,
      title: step.title,
      status: step.status,
      progress: step.progress,
    });
  }

  for (const line of snapshot.dialogue ?? []) {
    events.push({
      type: "session.turn",
      session_id: sid,
      at: iso(line.at),
      role: line.role,
      content: line.content,
    });
  }

  events.push({
    type: "session.log",
    session_id: sid,
    at: iso(snapshot.updated_at),
    level: "info",
    message: `Paseo sync status=${snapshot.status}`,
  });

  if (snapshot.status === "running" || snapshot.status === "idle") {
    events.push({
      type: "session.heartbeat",
      session_id: sid,
      at: iso(snapshot.updated_at),
      alive: snapshot.status === "running",
    });
  }

  if (snapshot.status === "done" || snapshot.status === "failed") {
    events.push({
      type: "session.end",
      session_id: sid,
      at: iso(snapshot.updated_at),
      outcome: snapshot.status === "done" ? "success" : "failed",
      summary: `Paseo run ${snapshot.status}`,
    });
  }

  return events;
}
