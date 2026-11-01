import { Hono } from "hono";
import { cors } from "hono/cors";
import { parseEventsBatch } from "@vivarium/schema";
import { createHandoff } from "./handoff.js";
import type { EventStore } from "./store.js";

const API_VERSION = "0.3.0";

function authorize(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const expected = process.env.VIVARIUM_TOKEN;
  if (!expected) return true;
  const auth = c.req.header("Authorization");
  return auth === `Bearer ${expected}`;
}

export function createApp(store: EventStore): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["Authorization", "Content-Type"],
    }),
  );

  app.get("/health", (c) =>
    c.json({ ok: true, service: "vivarium-api", version: API_VERSION, storage: "sqlite" }),
  );

  app.get("/v1/sessions", (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
    const sessions = store.listSessions(limit);
    return c.json({ sessions, count: store.countEvents() });
  });

  app.get("/v1/agents", (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
    const agents = store.listAgents(limit);
    return c.json({ agents });
  });

  app.get("/v1/sessions/:sessionId", (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const detail = store.getSession(c.req.param("sessionId"));
    if (!detail) return c.json({ error: "not_found" }, 404);
    return c.json(detail);
  });

  app.post("/v1/sessions/:sessionId/handoff", async (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    let body: { to_harness?: string; max_turns?: number } = {};
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      body = {};
    }
    const toHarness = body.to_harness ?? c.req.query("to_harness") ?? "generic";
    const maxTurns = Number(body.max_turns ?? c.req.query("max_turns") ?? 20);
    try {
      const result = createHandoff(store, {
        sessionId: c.req.param("sessionId"),
        toHarness: String(toHarness),
        maxTurns: Number.isFinite(maxTurns) ? maxTurns : 20,
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "not_found") {
        return c.json({ error: "not_found" }, 404);
      }
      return c.json({ error: "handoff_failed", detail: String(err) }, 500);
    }
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

    const accepted = store.insertEvents(parsed.events);
    return c.json({ accepted });
  });

  return app;
}
