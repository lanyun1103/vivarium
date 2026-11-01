#!/usr/bin/env node
/**
 * Poll Paseo daemon for a run and ingest into Vivarium.
 *
 * Env:
 *   PASEO_DAEMON_URL  e.g. http://127.0.0.1:7741 (hypothetical)
 *   PASEO_RUN_ID      run to fetch
 *   PASEO_DAEMON_TOKEN optional Bearer
 *
 * Expected endpoint (adapter contract): GET {PASEO_DAEMON_URL}/v1/runs/{run_id}
 * Response: { "run": PaseoRunSnapshot }
 *
 * If the request fails, exits non-zero — use dry-run for CI without a daemon.
 */
import { mapPaseoRunToEvents } from "./map-run.js";
import { sendEvents } from "./lib.js";
import type { PaseoDaemonRunResponse } from "./types.js";

async function main(): Promise<void> {
  const base = process.env.PASEO_DAEMON_URL;
  const runId = process.env.PASEO_RUN_ID;
  if (!base || !runId) {
    console.error("Set PASEO_DAEMON_URL and PASEO_RUN_ID");
    process.exit(1);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.PASEO_DAEMON_TOKEN) {
    headers.Authorization = `Bearer ${process.env.PASEO_DAEMON_TOKEN}`;
  }

  const url = `${base.replace(/\/$/, "")}/v1/runs/${encodeURIComponent(runId)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Paseo daemon ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as PaseoDaemonRunResponse;
  if (!body.run) throw new Error("invalid response: missing run");
  await sendEvents(mapPaseoRunToEvents(body.run));
  console.log(JSON.stringify({ ok: true, session_id: body.run.run_id }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
