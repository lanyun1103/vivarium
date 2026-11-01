import type {
  AgentDetailResponse,
  AgentsResponse,
  BrainSuggestResponse,
  HandoffResponse,
  SessionDetail,
  SessionsResponse,
} from "./types";

const baseUrl = (import.meta.env.VITE_VIVARIUM_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const token = import.meta.env.VITE_VIVARIUM_TOKEN as string | undefined;

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} → ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
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

export async function fetchSessions(limit = 50, agentId?: string): Promise<SessionsResponse> {
  const agent = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : "";
  return getJson(`/v1/sessions?limit=${limit}${agent}`);
}

export async function fetchAgents(limit = 50, includeArchived = false): Promise<AgentsResponse> {
  const archived = includeArchived ? "&include_archived=1" : "";
  return getJson(`/v1/agents?limit=${limit}${archived}`);
}

export async function fetchAgent(agentId: string): Promise<AgentDetailResponse> {
  return getJson(`/v1/agents/${encodeURIComponent(agentId)}`);
}

export async function createAgent(input: {
  agent_id: string;
  display_name: string;
  avatar?: string;
}): Promise<{ agent: AgentDetailResponse["agent"] }> {
  return postJson("/v1/agents", input);
}

export async function patchAgent(
  agentId: string,
  patch: { archived?: boolean; display_name?: string },
): Promise<{ agent: AgentDetailResponse["agent"] }> {
  const res = await fetch(`${baseUrl}/v1/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`patch agent → ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<{ agent: AgentDetailResponse["agent"] }>;
}

export async function suggestBrain(body: { agent_id?: string; session_id?: string }): Promise<BrainSuggestResponse> {
  return postJson("/v1/brain/suggest", body);
}

export async function reassignSession(sessionId: string, agentId: string): Promise<void> {
  await postJson(`/v1/sessions/${encodeURIComponent(sessionId)}/reassign`, { agent_id: agentId });
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
