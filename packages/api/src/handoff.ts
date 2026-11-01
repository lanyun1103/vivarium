import {
  handoffPackage,
  type HandoffPackage,
  type VivariumEvent,
} from "@vivarium/schema";
import type { EventStore, SessionDetail } from "./store.js";

export type CreateHandoffInput = {
  sessionId: string;
  toHarness: string;
  maxTurns?: number;
};

export type HandoffResult = {
  package: HandoffPackage;
  event: VivariumEvent;
  resume: {
    summary: string;
    claude_code: string;
    generic_curl: string;
  };
};

function taskDigest(detail: SessionDetail, maxLen = 240): string {
  const base =
    detail.session.task?.trim() ||
    [...detail.turns].reverse().find((t) => t.role === "user")?.content ||
    "Continue the Vivarium session.";
  const oneLine = base.replace(/\s+/g, " ").trim();
  return oneLine.length <= maxLen ? oneLine : `${oneLine.slice(0, maxLen - 1)}…`;
}

function buildResumePrompt(detail: SessionDetail, digest: string, maxTurns: number): string {
  const turns = detail.turns.slice(-maxTurns);
  const lines = [
    "You are resuming work from another harness via Vivarium handoff.",
    `Task: ${digest}`,
  ];
  if (detail.session.cwd) lines.push(`Workspace (redacted): ${detail.session.cwd}`);
  lines.push("", "Recent conversation:");
  for (const t of turns) {
    lines.push(`${t.role}: ${t.content}`);
  }
  lines.push("", "Continue from here without re-asking for context already above.");
  return lines.join("\n");
}

export function createHandoff(store: EventStore, input: CreateHandoffInput): HandoffResult {
  const detail = store.getSession(input.sessionId);
  if (!detail) {
    throw new Error("not_found");
  }

  const maxTurns = Math.min(Math.max(input.maxTurns ?? 20, 1), 100);
  const toHarness = input.toHarness.trim() || "generic";
  const fromHarness = detail.session.harness ?? "unknown";
  const agentId = detail.session.agent_id ?? "unknown";
  const digest = taskDigest(detail);
  const createdAt = new Date().toISOString();
  const transcriptRef = `vivarium://${input.sessionId}?turns=${detail.turns.length}`;

  const turns = detail.turns.slice(-maxTurns).map((t) => ({
    role: t.role as "user" | "assistant" | "system" | "tool",
    content: t.content,
    model: t.model,
    at: t.at,
  }));

  const resumePrompt = buildResumePrompt(detail, digest, maxTurns);

  const pkg = handoffPackage.parse({
    version: 1,
    session_id: input.sessionId,
    agent_id: agentId,
    from_harness: fromHarness,
    to_harness: toHarness,
    transcript_ref: transcriptRef,
    task_digest: digest,
    task: detail.session.task ?? undefined,
    cwd_redacted: detail.session.cwd ?? undefined,
    created_at: createdAt,
    turns,
    resume_prompt: resumePrompt,
  });

  const event: VivariumEvent = {
    type: "session.handoff",
    session_id: input.sessionId,
    at: createdAt,
    from_harness: fromHarness,
    to_harness: toHarness,
    transcript_ref: transcriptRef,
    task_digest: digest,
  };

  store.insertEvents([event]);

  const escapedDigest = digest.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const resume = {
    summary: `Handoff ${fromHarness} → ${toHarness} (${turns.length} turns in package)`,
    claude_code: [
      "# Save downloaded handoff JSON as handoff.json, then:",
      'claude "Continue this Vivarium handoff:" "$(jq -r .resume_prompt handoff.json)"',
      "# Or paste the resume_prompt field into a new session.",
    ].join("\n"),
    generic_curl: [
      `# Optional: start a stub session on another Vivarium server`,
      `curl -s -X POST "$VIVARIUM_URL/v1/events" -H "Content-Type: application/json" \\`,
      `  -d '{"events":[{"type":"session.start","session_id":"handoff-continue","agent_id":"${agentId}","harness":"${toHarness}","model":"unknown","cwd":"~/project","task":"${escapedDigest}","host":"handoff"}]}'`,
    ].join("\n"),
  };

  return { package: pkg, event, resume };
}
