import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapPaseoRunToEvents } from "./map-run.js";
import { sendEvents } from "./lib.js";
import type { PaseoRunSnapshot } from "./types.js";

async function main(): Promise<void> {
  const fileArg = process.argv.indexOf("--file");
  const defaultPath = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/mock-run.json");
  const path = fileArg !== -1 ? process.argv[fileArg + 1] : defaultPath;
  if (!path) throw new Error("--file path required");
  const raw = JSON.parse(readFileSync(path, "utf8")) as PaseoRunSnapshot;
  const events = mapPaseoRunToEvents(raw);
  await sendEvents(events);
  console.log(JSON.stringify({ ok: true, session_id: raw.run_id, events: events.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
