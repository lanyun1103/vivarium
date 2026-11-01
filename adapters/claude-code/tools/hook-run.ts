import {
  buildSessionEndEvents,
  buildSessionStartEvents,
  buildUserTurnEvent,
  buildAssistantTurnFromStop,
  readStdinJson,
  type SessionEndInput,
  type SessionStartInput,
  type StopInput,
  type UserPromptSubmitInput,
} from "./hook-lib.js";
import { postEvents } from "./post-events.js";

const maxTurnChars = Number(process.env.VIVARIUM_MAX_TURN_CHARS ?? 8000);

async function main(): Promise<void> {
  const hook = process.argv[2];
  if (!hook) {
    console.error("usage: hook-run.ts <SessionStart|SessionEnd|UserPromptSubmit>");
    process.exit(0);
  }

  let events;
  switch (hook) {
    case "SessionStart": {
      const input = readStdinJson<SessionStartInput>() ?? {};
      events = buildSessionStartEvents(input);
      break;
    }
    case "SessionEnd": {
      const input = readStdinJson<SessionEndInput>() ?? {};
      events = buildSessionEndEvents(input);
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
