import { readFileSync } from "node:fs";
import type { VivariumEvent } from "@vivarium/schema";

export type HookCommonInput = {
  session_id?: string;
  cwd?: string;
  transcript_path?: string;
  hook_event_name?: string;
};

export type SessionStartInput = HookCommonInput & {
  source?: string;
  model?: string;
  agent_type?: string;
  session_title?: string;
};

export type SessionEndInput = HookCommonInput & {
  reason?: string;
};

export type UserPromptSubmitInput = HookCommonInput & {
  prompt?: string;
  session_title?: string;
};

export type StopInput = HookCommonInput & {
  last_assistant_message?: string;
  stop_hook_active?: boolean;
};

export function readStdinJson<T>(): T | null {
  try {
    const raw = readStdin();
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readStdin(): string {
  return readFileSync(0, "utf8");
}

export function redactPath(input: string, home?: string): string {
  let out = input;
  if (home && out.includes(home)) {
    out = out.split(home).join("~");
  }
  out = out.replace(/\/Users\/[^/]+/g, "~");
  out = out.replace(/\/home\/[^/]+/g, "~");
  return out;
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /ghp_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

export function defaultAgentId(cwd: string): string {
  const base = cwd.split(/[/\\]/).filter(Boolean).pop() ?? "project";
  return `claude-code:${base}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export type BuildEventsOptions = {
  maxTurnChars: number;
};

export function buildSessionStartEvents(input: SessionStartInput): VivariumEvent[] {
  const sessionId = input.session_id ?? `unknown-${Date.now()}`;
  const cwd = redactPath(input.cwd ?? process.cwd(), process.env.HOME);
  const task = redactSecrets(
    input.session_title?.trim() || process.env.VIVARIUM_TASK || "Claude Code session",
  );
  const model = input.model ?? process.env.VIVARIUM_MODEL ?? "unknown";
  const agentId = process.env.VIVARIUM_AGENT_ID ?? defaultAgentId(cwd);
  const host = process.env.VIVARIUM_HOST ?? "local";
  const at = isoNow();
  const source = input.source ?? "unknown";

  return [
    {
      type: "session.start",
      session_id: sessionId,
      at,
      agent_id: agentId,
      harness: "claude-code",
      model,
      cwd,
      task: truncate(task, 500),
      host,
    },
    {
      type: "session.log",
      session_id: sessionId,
      at,
      level: "info",
      message: `SessionStart (${source})`,
    },
  ];
}

export function buildSessionEndEvents(input: SessionEndInput): VivariumEvent[] {
  const sessionId = input.session_id ?? process.env.VIVARIUM_SESSION_ID ?? "unknown";
  const at = isoNow();
  const reason = input.reason ?? "other";
  const outcome =
    reason === "prompt_input_exit" || reason === "logout" ? "cancelled" : "success";

  return [
    {
      type: "session.end",
      session_id: sessionId,
      at,
      outcome,
      summary: `SessionEnd (${reason})`,
    },
  ];
}

export function buildUserTurnEvent(
  input: UserPromptSubmitInput,
  opts: BuildEventsOptions,
): VivariumEvent | null {
  if (!input.session_id || !input.prompt?.trim()) return null;
  const content = truncate(redactSecrets(redactPath(input.prompt, process.env.HOME)), opts.maxTurnChars);
  return {
    type: "session.turn",
    session_id: input.session_id,
    at: isoNow(),
    role: "user",
    content,
  };
}

export function buildAssistantTurnFromStop(
  input: StopInput,
  opts: BuildEventsOptions,
): VivariumEvent | null {
  if (!input.session_id || !input.last_assistant_message?.trim()) return null;
  if (input.stop_hook_active) return null;
  const content = truncate(
    redactSecrets(input.last_assistant_message),
    opts.maxTurnChars,
  );
  return {
    type: "session.turn",
    session_id: input.session_id,
    at: isoNow(),
    role: "assistant",
    content,
  };
}
