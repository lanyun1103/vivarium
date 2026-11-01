/**
 * M0 ingest stub — events are validated and kept in memory only.
 *
 * M1 persistence (planned):
 * - Local: better-sqlite3 or libsql with tables `sessions`, `events` (JSON blob + indexed columns).
 * - Edge: Cloudflare D1 with the same schema; large transcript blobs in R2.
 * - Retention: configurable TTL per tenant.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { parseEventsBatch, type VivariumEvent } from "@vivarium/schema";

const app = new Hono();

const events: VivariumEvent[] = [];

function authorize(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const expected = process.env.VIVARIUM_TOKEN;
  if (!expected) return true;
  const auth = c.req.header("Authorization");
  return auth === `Bearer ${expected}`;
}

app.get("/health", (c) => c.json({ ok: true, service: "vivarium-api", version: "0.1.0" }));

app.get("/v1/sessions", (c) => {
  if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
  const ids = [...new Set(events.map((e) => e.session_id))];
  return c.json({ sessions: ids, count: events.length });
});

app.post("/v1/events", async (c) => {
  if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  let parsed;
  try {
    parsed = parseEventsBatch(body);
  } catch (err) {
    return c.json({ error: "validation_failed", detail: String(err) }, 400);
  }

  events.push(...parsed.events);
  return c.json({ accepted: parsed.events.length });
});

const port = Number(process.env.PORT ?? 8787);
console.log(`Vivarium API listening on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port });
