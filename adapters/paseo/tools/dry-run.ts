import { mapPaseoRunToEvents } from "./map-run.js";
import { sendEvents } from "./lib.js";
import type { PaseoRunSnapshot } from "./types.js";

const sessionId = process.env.VIVARIUM_DRY_RUN_SESSION ?? `paseo-dry-run-${Date.now()}`;

const mock: PaseoRunSnapshot = {
  run_id: sessionId,
  agent_id: "paseo:demo-agent",
  host: "paseo-host-1",
  status: "done",
  model: "paseo-fixture",
  cwd: "~/workspace/demo",
  task: "Paseo dry-run — maps daemon snapshot to Vivarium events",
  started_at: new Date(Date.now() - 60_000).toISOString(),
  updated_at: new Date().toISOString(),
  steps: [
    { id: "connect", title: "Connect daemon", status: "done" },
    { id: "dialogue", title: "Sync dialogue", status: "done" },
  ],
  dialogue: [
    { role: "user", content: "Run the deployment checklist.", at: new Date(Date.now() - 45_000).toISOString() },
    {
      role: "assistant",
      content: "Checklist complete; 3 items verified.",
      at: new Date(Date.now() - 30_000).toISOString(),
    },
  ],
};

async function main(): Promise<void> {
  await sendEvents(mapPaseoRunToEvents(mock));
  console.log(JSON.stringify({ ok: true, session_id: sessionId, harness: "paseo" }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
