import { Hono } from "hono";
import { cors } from "hono/cors";
import { parseEventsBatch } from "@vivarium/schema";
import { BrainService } from "./brain.js";
import { createHandoff } from "./handoff.js";
import type { SummaryStyle } from "./lines.js";
import { StoreError, type CreateAgentInput, type EventStore, type UpdateAgentInput } from "./store.js";

const API_VERSION = "0.7.0";

function authorize(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const expected = process.env.VIVARIUM_TOKEN;
  if (!expected) return true;
  const auth = c.req.header("Authorization");
  return auth === `Bearer ${expected}`;
}

function statusFor(err: StoreError): 400 | 404 | 409 {
  if (err.code === "not_found") return 404;
  if (err.code === "conflict") return 409;
  return 400;
}

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isStyle(value: unknown): value is SummaryStyle {
  return value === "ops" || value === "product" || value === "inbox";
}

function policyPatch(value: unknown): CreateAgentInput["policy"] {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const aliases = Array.isArray(rec.aliases) ? rec.aliases.filter((item): item is string => typeof item === "string") : undefined;
  const cwdHints = Array.isArray(rec.cwd_hints)
    ? rec.cwd_hints.filter((item): item is string => typeof item === "string")
    : undefined;
  return {
    summary_style: isStyle(rec.summary_style) ? rec.summary_style : undefined,
    nudge_copy: optionalString(rec.nudge_copy),
    handoff_hint: optionalString(rec.handoff_hint),
    aliases,
    cwd_hints: cwdHints,
  };
}

export function createApp(store: EventStore): Hono {
  const app = new Hono();
  const brain = new BrainService(store);

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
    const agentId = c.req.query("agent_id")?.trim() || undefined;
    const sessions = store.listSessions({ limit, agentId });
    return c.json({ sessions, count: store.countEvents() });
  });

  app.get("/v1/agents", (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
    const includeArchived = c.req.query("include_archived") === "1" || c.req.query("include_archived") === "true";
    const agents = store.listAgents({ limit, includeArchived });
    return c.json({ agents });
  });

  app.post("/v1/agents", async (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const body = asRecord(await readJson(c));
    if (!body || typeof body.agent_id !== "string" || typeof body.display_name !== "string") {
      return c.json({ error: "invalid", detail: "agent_id and display_name are required" }, 400);
    }
    try {
      const agent = store.createAgent({
        agent_id: body.agent_id,
        display_name: body.display_name,
        line: optionalString(body.line),
        avatar: body.avatar === null ? null : optionalString(body.avatar),
        description: body.description === null ? null : optionalString(body.description),
        policy: policyPatch(body.policy),
      });
      return c.json({ agent }, 201);
    } catch (err) {
      if (err instanceof StoreError) return c.json({ error: err.code, detail: err.message }, statusFor(err));
      return c.json({ error: "failed", detail: String(err) }, 500);
    }
  });

  app.get("/v1/agents/:agentId", (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const agent = store.getAgent(c.req.param("agentId"));
    if (!agent) return c.json({ error: "not_found" }, 404);
    const sessions = store.listSessions({ agentId: agent.agent_id, limit: 50 });
    return c.json({ agent, sessions });
  });

  app.patch("/v1/agents/:agentId", async (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const body = asRecord(await readJson(c));
    if (!body) return c.json({ error: "invalid", detail: "JSON object required" }, 400);
    const patch: UpdateAgentInput = {};
    if (typeof body.display_name === "string") patch.display_name = body.display_name;
    if (typeof body.line === "string") patch.line = body.line;
    if (body.avatar === null || typeof body.avatar === "string") patch.avatar = body.avatar;
    if (body.description === null || typeof body.description === "string") patch.description = body.description;
    if (typeof body.archived === "boolean") patch.archived = body.archived;
    if (body.policy !== undefined) patch.policy = policyPatch(body.policy);
    try {
      const agent = store.updateAgent(c.req.param("agentId"), patch);
      return c.json({ agent });
    } catch (err) {
      if (err instanceof StoreError) return c.json({ error: err.code, detail: err.message }, statusFor(err));
      return c.json({ error: "failed", detail: String(err) }, 500);
    }
  });

  app.get("/v1/sessions/:sessionId", (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const detail = store.getSession(c.req.param("sessionId"));
    if (!detail) return c.json({ error: "not_found" }, 404);
    return c.json(detail);
  });

  app.post("/v1/sessions/:sessionId/reassign", async (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const body = asRecord(await readJson(c));
    if (!body || typeof body.agent_id !== "string") {
      return c.json({ error: "invalid", detail: "agent_id is required" }, 400);
    }
    try {
      const session = brain.reassign(c.req.param("sessionId"), body.agent_id);
      return c.json({ session });
    } catch (err) {
      if (err instanceof StoreError) return c.json({ error: err.code, detail: err.message }, statusFor(err));
      return c.json({ error: "failed", detail: String(err) }, 500);
    }
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

  app.post("/v1/brain/suggest", async (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const body = asRecord(await readJson(c));
    if (!body) return c.json({ error: "invalid", detail: "JSON object required" }, 400);
    const agentId = optionalString(body.agent_id)?.trim();
    const sessionId = optionalString(body.session_id)?.trim();
    try {
      const result = await brain.suggest({ agent_id: agentId, session_id: sessionId });
      return c.json(result);
    } catch (err) {
      if (err instanceof StoreError) return c.json({ error: err.code, detail: err.message }, statusFor(err));
      return c.json({ error: "failed", detail: String(err) }, 500);
    }
  });

  app.post("/v1/events", async (c) => {
    if (!authorize(c)) return c.json({ error: "unauthorized" }, 401);
    const body = await readJson(c);
    if (body === undefined) return c.json({ error: "invalid_json" }, 400);

    let parsed;
    try {
      parsed = parseEventsBatch(body);
    } catch (err) {
      return c.json({ error: "validation_failed", detail: String(err) }, 400);
    }

    const accepted = await store.insertEvents(parsed.events);
    return c.json({ accepted });
  });

  return app;
}
