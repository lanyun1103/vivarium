#!/usr/bin/env node
import { postEvents, readEventsArg } from "./post-events.js";

const soft = process.argv.includes("--soft") || process.env.VIVARIUM_SOFT_FAIL !== "0";

async function main(): Promise<void> {
  const events = readEventsArg(process.argv);
  await postEvents(events, { softFail: soft, validate: true });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[vivarium]", err instanceof Error ? err.message : String(err));
    process.exit(soft ? 0 : 1);
  });
