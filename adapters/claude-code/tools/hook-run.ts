import type { VivariumEvent } from "@vivarium/schema";
import {
  buildAssistantTurnFromStop,
  buildSessionEndEvents,
  buildSessionStartEvents,
  buildUserTurnEvent,
  isoNow,
  readStdinJson,
  type SessionEndInput,
  type SessionStartInput,
  type StopInput,
  type UserPromptSubmitInput,
} from "./hook-lib.js";
import { parseTranscriptJsonlFile, parsedTurnsToEvents } from "./parse-transcript-jsonl.js";
import { postEvents } from "./post-events.js";

const maxTurnChars = Number(process.env.VIVARIUM_MAX_TURN_CHARS ?? 8000);

async function appendTranscriptFromPath(
  events: VivariumEvent[],
  sessionId: string,
  transcriptPath: string | undefined,
): Promise<void> {
  if (!transcriptPath || process.env.VIVARIUM_SKIP_TRANSCRIPT === "1") return;
  const maxLines = Number(process.env.VIVARIUM_TRANSCRIPT_MAX_LINES ?? 400);
  try {
    const turns = await parseTranscriptJsonlFile(transcriptPath, {
      maxLines,
      maxTurnChars,
      home: process.env.HOME,
    });
    if (!turns.length) return;
    const sid = sessionId || "unknown";
    events.push(...parsedTurnsToEvents(sid, turns));
    events.push({
      type: "session.log",
      session_id: sid,
      at: isoNow(),
      level: "info",
      message: `Transcript JSONL ingest: ${turns.length} turns from ${transcriptPath}`,
    });
  } catch (err) {
    events.push({
      type: "session.log",
      session_id: sessionId || "unknown",
      at: isoNow(),
      level: "warn",
      message: `Transcript ingest skipped: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function main(): Promise<void> {
  const hook = process.argv[2];
  if (!hook) {
    console.error("usage: hook-run.ts <SessionStart|SessionEnd|UserPromptSubmit|Stop>");
    process.exit(0);
  }

  let events: VivariumEvent[] = [];
  switch (hook) {
    case "SessionStart": {
      const input = readStdinJson<SessionStartInput>() ?? {};
      events = buildSessionStartEvents(input);
      break;
    }
    case "SessionEnd": {
      const input = readStdinJson<SessionEndInput>() ?? {};
      events = buildSessionEndEvents(input);
      await appendTranscriptFromPath(events, input.session_id ?? "unknown", input.transcript_path);
      break;
    }
    case "UserPromptSubmit": {
      const input = readStdinJson<UserPromptSubmitInput>() ?? {};
      const turn = buildUserTurnEvent(input, { maxTurnChars });
      events = turn ? [turn] : [];
      break;
    }
    case "Stop": {
      const input = readStdinJson<StopInput>() ?? {};
      const turn = buildAssistantTurnFromStop(input, { maxTurnChars });
      events = turn ? [turn] : [];
      break;
    }
    default:
      console.error("[vivarium] unknown hook:", hook);
      process.exit(0);
  }

  if (events.length === 0) process.exit(0);
  await postEvents(events, { softFail: true, validate: true });
}

main().catch((err) => {
  console.error("[vivarium]", err instanceof Error ? err.message : String(err));
  process.exit(0);
});
