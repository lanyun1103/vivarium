import type { SessionStep, SessionSummary } from "../api/types";

export type LiveStatus = "running" | "stalled" | "idle";

const RUNNING_MS = 2 * 60 * 1000;
const STALLED_MS = 10 * 60 * 1000;

export function liveStatus(session: SessionSummary, now = Date.now()): LiveStatus {
  if (session.outcome || session.ended_at) return "idle";
  const age = now - Date.parse(session.updated_at);
  if (Number.isNaN(age)) return "stalled";
  if (age <= RUNNING_MS) return "running";
  if (age <= STALLED_MS) return "stalled";
  return "stalled";
}

export function currentStepLabel(steps: SessionStep[] | undefined): string {
  if (!steps?.length) return "—";
  const running = [...steps].reverse().find((s) => s.status === "running");
  if (running) return running.title;
  const pending = [...steps].reverse().find((s) => s.status === "pending");
  if (pending) return pending.title;
  const last = steps[steps.length - 1];
  return last?.title ?? "—";
}

export function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

export function harnessEmoji(harness: string | null): string {
  switch (harness) {
    case "claude-code":
      return "🌸";
    case "grok-bot":
      return "⚡";
    default:
      return "🌱";
  }
}

export function statusEmoji(status: LiveStatus): string {
  switch (status) {
    case "running":
      return "💫";
    case "stalled":
      return "🌙";
    default:
      return "💤";
  }
}
