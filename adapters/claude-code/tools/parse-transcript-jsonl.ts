/**
 * Best-effort parser for Claude Code session JSONL (transcript_path).
 * Format varies by version; we extract user/assistant/tool text only.
 */
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { redactPath, redactSecrets, truncate } from "./hook-lib.js";

export type ParsedTurn = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  at?: string;
  tool_calls?: { id: string; name: string; arguments?: unknown }[];
};

export type ParseOptions = {
  maxLines?: number;
  maxTurnChars?: number;
  home?: string;
};

function expandPath(path: string, home?: string): string {
  if (path.startsWith("~/") && home) return `${home}${path.slice(1)}`;
  return path;
}

function contentFromMessage(message: unknown): { text: string; tool_calls?: ParsedTurn["tool_calls"] } {
  if (!message || typeof message !== "object") return { text: "" };
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") return { text: content };
  if (!Array.isArray(content)) return { text: "" };

  const parts: string[] = [];
  const tool_calls: ParsedTurn["tool_calls"] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
    if (b.type === "tool_use" && typeof b.name === "string") {
      tool_calls.push({
        id: String(b.id ?? b.name),
        name: b.name,
        arguments: b.input ?? b.arguments,
      });
      parts.push(`[tool:${b.name}]`);
    }
    if (b.type === "tool_result" && typeof b.content === "string") {
      parts.push(`[tool_result] ${b.content}`);
    }
  }

  return {
    text: parts.join("\n").trim(),
    tool_calls: tool_calls.length ? tool_calls : undefined,
  };
}

function mapLineToTurn(line: Record<string, unknown>, opts: ParseOptions): ParsedTurn | null {
  const ts =
    (typeof line.timestamp === "string" && line.timestamp) ||
    (typeof line.created_at === "string" && line.created_at) ||
    undefined;

  if (line.message && typeof line.message === "object") {
    const msg = line.message as Record<string, unknown>;
    const roleRaw = msg.role ?? line.type;
    const role =
      roleRaw === "user" || roleRaw === "assistant" || roleRaw === "system" || roleRaw === "tool"
        ? roleRaw
        : line.type === "user" || line.type === "assistant"
          ? line.type
          : null;
    if (!role) return null;
    const { text, tool_calls } = contentFromMessage(msg);
    if (!text && !tool_calls?.length) return null;
    const content = truncate(
      redactSecrets(redactPath(text, opts.home)),
      opts.maxTurnChars ?? 8000,
    );
    return { role, content, at: ts, tool_calls };
  }

  if (line.type === "user" || line.type === "assistant") {
    const { text, tool_calls } = contentFromMessage({ role: line.type, content: line.content ?? line.text });
    if (!text && !tool_calls?.length) return null;
    return {
      role: line.type,
      content: truncate(redactSecrets(text), opts.maxTurnChars ?? 8000),
      at: ts,
      tool_calls,
    };
  }

  return null;
}

export async function parseTranscriptJsonlFile(
  transcriptPath: string,
  opts: ParseOptions = {},
): Promise<ParsedTurn[]> {
  const resolved = expandPath(transcriptPath, opts.home);
  if (!existsSync(resolved)) return [];

  const maxLines = opts.maxLines ?? 400;
  const turns: ParsedTurn[] = [];
  const rl = createInterface({ input: createReadStream(resolved), crlfDelay: Infinity });

  let linesRead = 0;
  for await (const line of rl) {
    linesRead++;
    if (linesRead > maxLines) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const turn = mapLineToTurn(obj, opts);
      if (turn) turns.push(turn);
    } catch {
      /* skip malformed lines */
    }
  }

  return turns;
}

export function parsedTurnsToEvents(
  sessionId: string,
  turns: ParsedTurn[],
): import("@vivarium/schema").VivariumEvent[] {
  return turns.map((t) => ({
    type: "session.turn" as const,
    session_id: sessionId,
    at: t.at ?? new Date().toISOString(),
    role: t.role,
    content: t.content,
    tool_calls: t.tool_calls,
  }));
}
