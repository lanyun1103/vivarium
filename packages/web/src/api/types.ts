export type SessionSummary = {
  session_id: string;
  agent_id: string | null;
  harness: string | null;
  model: string | null;
  task: string | null;
  started_at: string | null;
  updated_at: string;
  ended_at: string | null;
  outcome: string | null;
};

export type AgentSummary = {
  agent_id: string;
  harness: string | null;
  last_session_id: string;
  updated_at: string;
  session_count: number;
};

export type SessionStep = {
  step_id: string;
  title: string;
  status: string;
  progress?: number;
  at: string;
};

export type TranscriptTurn = {
  role: string;
  content: string;
  tool_calls?: unknown;
  model?: string;
  at: string;
};

export type SessionDetail = {
  session: SessionSummary & {
    cwd: string | null;
    host: string | null;
    summary: string | null;
  };
  steps: SessionStep[];
  turns: TranscriptTurn[];
};

export type SessionsResponse = {
  sessions: SessionSummary[];
  count: number;
};

export type AgentsResponse = {
  agents: AgentSummary[];
};
