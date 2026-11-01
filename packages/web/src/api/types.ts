export type SessionSummary = {
  session_id: string;
  agent_id: string | null;
  reported_agent_id: string | null;
  harness: string | null;
  model: string | null;
  task: string | null;
  started_at: string | null;
  updated_at: string;
  ended_at: string | null;
  outcome: string | null;
  route_confidence: number | null;
  route_source: string | null;
  route_reason: string | null;
  agent_locked: boolean;
};

export type LinePolicy = {
  id: string;
  summary_style: "ops" | "product" | "inbox";
  nudge_copy: string;
  handoff_hint: string;
  aliases: string[];
  cwd_hints: string[];
};

export type AgentSummary = {
  agent_id: string;
  display_name: string;
  line: string;
  avatar: string | null;
  archived: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
  session_count: number;
  running_count: number;
  last_session_id: string | null;
  preview_tasks: string[];
};

export type AgentDetail = AgentSummary & {
  policy: LinePolicy;
};

export type SuggestionKind = "reassign" | "nudge" | "summary" | "handoff";

export type BrainSuggestion = {
  kind: SuggestionKind;
  agent_id: string;
  session_id?: string;
  target_agent_id?: string;
  text: string;
  confidence: number;
};

export type ProgressSummary = {
  agent_id: string;
  display_name: string;
  text: string;
  running: number;
  ended: number;
  total: number;
  latest_tasks: string[];
  latest_step: string | null;
};

export type BrainSuggestResponse = {
  summary: ProgressSummary;
  suggestions: BrainSuggestion[];
};

export type AgentDetailResponse = {
  agent: AgentDetail;
  sessions: SessionSummary[];
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

export type HandoffPackage = {
  version: 1;
  session_id: string;
  agent_id: string;
  from_harness: string;
  to_harness: string;
  transcript_ref: string;
  task_digest: string;
  task?: string;
  cwd_redacted?: string;
  created_at: string;
  turns?: TranscriptTurn[];
  resume_prompt?: string;
};

export type HandoffResponse = {
  package: HandoffPackage;
  resume: {
    summary: string;
    claude_code: string;
    generic_curl: string;
  };
};

export type SessionsResponse = {
  sessions: SessionSummary[];
  count: number;
};

export type AgentsResponse = {
  agents: AgentSummary[];
};
