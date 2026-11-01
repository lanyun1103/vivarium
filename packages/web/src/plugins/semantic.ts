import type { LiveStatus } from "../lib/sessionUi";
import type { SemanticEmojiKey } from "@vivarium/schema";

export function liveStatusToSemantic(status: LiveStatus): SemanticEmojiKey {
  switch (status) {
    case "running":
      return "agent.running";
    case "stalled":
      return "agent.stalled";
    default:
      return "agent.idle";
  }
}

export const FALLBACK_GLYPH: Record<SemanticEmojiKey, string> = {
  "agent.happy": "😊",
  "agent.thinking": "🤔",
  "agent.blocked": "🚫",
  "agent.idle": "💤",
  "agent.running": "💫",
  "agent.stalled": "🌙",
  "agent.success": "✅",
  "status.running": "▶",
  "status.stalled": "⏸",
  "status.idle": "⏹",
  "step.running": "…",
  "step.done": "✓",
};
