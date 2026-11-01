import { z } from "zod";

export const harnessId = z.string().min(1);
export const sessionId = z.string().min(1);
export const agentId = z.string().min(1);

export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().min(1));

export const eventEnvelope = z.object({
  type: z.string(),
  session_id: sessionId,
  at: isoDateTime.optional(),
});

export const sessionStartEvent = eventEnvelope.extend({
  type: z.literal("session.start"),
  agent_id: agentId,
  harness: harnessId,
  model: z.string(),
  cwd: z.string(),
  task: z.string(),
  host: z.string(),
});

export const toolCall = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.unknown().optional(),
});

export const sessionTurnEvent = eventEnvelope.extend({
  type: z.literal("session.turn"),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  tool_calls: z.array(toolCall).optional(),
  model: z.string().optional(),
  tokens: z
    .object({
      prompt: z.number().int().nonnegative().optional(),
      completion: z.number().int().nonnegative().optional(),
      total: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const sessionStepEvent = eventEnvelope.extend({
  type: z.literal("session.step"),
  step_id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
  progress: z.number().min(0).max(1).optional(),
});

export const sessionLogEvent = eventEnvelope.extend({
  type: z.literal("session.log"),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
});

export const sessionHeartbeatEvent = eventEnvelope.extend({
  type: z.literal("session.heartbeat"),
  alive: z.boolean(),
  metrics: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const sessionHandoffEvent = eventEnvelope.extend({
  type: z.literal("session.handoff"),
  from_harness: harnessId,
  to_harness: harnessId,
  transcript_ref: z.string(),
  task_digest: z.string(),
});

export const sessionEndEvent = eventEnvelope.extend({
  type: z.literal("session.end"),
  outcome: z.enum(["success", "failed", "cancelled"]),
  summary: z.string().optional(),
});

export const vivariumEvent = z.discriminatedUnion("type", [
  sessionStartEvent,
  sessionTurnEvent,
  sessionStepEvent,
  sessionLogEvent,
  sessionHeartbeatEvent,
  sessionHandoffEvent,
  sessionEndEvent,
]);

export type VivariumEvent = z.infer<typeof vivariumEvent>;

export const ingestEventsRequest = z.object({
  events: z.array(vivariumEvent).min(1),
});

export type IngestEventsRequest = z.infer<typeof ingestEventsRequest>;

export const transcriptTurn = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  tool_calls: z.array(toolCall).optional(),
  model: z.string().optional(),
  at: isoDateTime.optional(),
});

export const transcript = z.object({
  session_id: sessionId,
  agent_id: agentId,
  harness: harnessId,
  turns: z.array(transcriptTurn),
});

export type Transcript = z.infer<typeof transcript>;

export const handoffPackage = z.object({
  version: z.literal(1),
  session_id: sessionId,
  agent_id: agentId,
  from_harness: harnessId,
  to_harness: harnessId,
  transcript_ref: z.string(),
  task_digest: z.string(),
  task: z.string().optional(),
  cwd_redacted: z.string().optional(),
  created_at: isoDateTime,
});

export type HandoffPackage = z.infer<typeof handoffPackage>;

export const pluginProvides = z.enum(["theme", "emoji", "avatar", "adapter"]);

export const pluginManifest = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().optional(),
  provides: z.array(pluginProvides).min(1),
  slots: z.record(z.string()),
  vivarium: z.string().optional(),
});

export type PluginManifest = z.infer<typeof pluginManifest>;

export function parseEvent(input: unknown): VivariumEvent {
  return vivariumEvent.parse(input);
}

export function parseEventsBatch(input: unknown): IngestEventsRequest {
  return ingestEventsRequest.parse(input);
}
