import type { AgentsResponse, HandoffResponse, SessionDetail, SessionsResponse } from "./types";

const baseUrl = (import.meta.env.VITE_VIVARIUM_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const token = import.meta.env.VITE_VIVARIUM_TOKEN as string | undefined;

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} → ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export function apiBaseLabel(): string {
  return baseUrl || "(dev proxy → :8787)";
}

export async function fetchSessions(limit = 50): Promise<SessionsResponse> {
  return getJson(`/v1/sessions?limit=${limit}`);
}

export async function fetchAgents(limit = 50): Promise<AgentsResponse> {
  return getJson(`/v1/agents?limit=${limit}`);
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  return getJson(`/v1/sessions/${encodeURIComponent(sessionId)}`);
}

export async function fetchHealth(): Promise<{ ok: boolean }> {
  return getJson("/health");
}

export async function createHandoff(
  sessionId: string,
  toHarness: string,
  maxTurns = 20,
): Promise<HandoffResponse> {
  const res = await fetch(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/handoff`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ to_harness: toHarness, max_turns: maxTurns }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`handoff → ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<HandoffResponse>;
}
