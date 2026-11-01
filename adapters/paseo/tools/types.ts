/**
 * Paseo daemon run snapshot (adapter contract).
 * Real daemon may expose different JSON — map into this shape before ingest.
 */
export type PaseoDialogueLine = {
  role: "user" | "assistant" | "system";
  content: string;
  at?: string;
};

export type PaseoStep = {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed";
  progress?: number;
};

export type PaseoRunSnapshot = {
  run_id: string;
  agent_id: string;
  host: string;
  status: "running" | "idle" | "done" | "failed";
  model?: string;
  cwd?: string;
  task?: string;
  started_at?: string;
  updated_at?: string;
  dialogue?: PaseoDialogueLine[];
  steps?: PaseoStep[];
};

/** Expected future HTTP shape (not wired to a known public API yet). */
export type PaseoDaemonRunResponse = {
  run: PaseoRunSnapshot;
};
