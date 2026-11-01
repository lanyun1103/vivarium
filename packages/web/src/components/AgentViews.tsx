import { useState } from "react";
import type { AgentSummary, BrainSuggestResponse, SuggestionKind } from "../api/types";
import { createAgent, reassignSession } from "../api/client";
import { formatRelative } from "../lib/sessionUi";

const KIND_LABEL: Record<SuggestionKind, string> = {
  reassign: "重新分拣",
  nudge: "轻推",
  summary: "摘要",
  handoff: "换马",
};

function Avatar({ value, label }: { value: string | null; label: string }) {
  const safeImage =
    value && (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/"));
  return (
    <div className="agent-card__avatar" aria-hidden>
      {safeImage ? <img src={value} alt="" /> : <span>{value || label.slice(0, 1)}</span>}
    </div>
  );
}

export function AgentCard({ agent, onOpen }: { agent: AgentSummary; onOpen: () => void }) {
  const busy = agent.running_count > 0;
  return (
    <button
      type="button"
      className={`agent-card ${agent.agent_id === "inbox" ? "agent-card--inbox" : ""} ${busy ? "agent-card--busy" : ""} ${agent.archived ? "agent-card--archived" : ""}`}
      onClick={onOpen}
    >
      <Avatar value={agent.avatar} label={agent.display_name} />
      <div className="agent-card__body">
        <div className="session-card__row">
          <h2 className="session-card__title">{agent.display_name}</h2>
          <span className={`badge ${busy ? "badge--running" : "badge--idle"}`}>
            {agent.running_count} 进行中
          </span>
        </div>
        <p className="session-card__meta">
          <span>{agent.line}</span>
          <span>·</span>
          <span>{agent.session_count} 会话</span>
          {agent.last_activity && (
            <>
              <span>·</span>
              <span>{formatRelative(agent.last_activity)}</span>
            </>
          )}
        </p>
        {agent.description && <p className="agent-card__desc">{agent.description}</p>}
        {agent.preview_tasks.length > 0 && (
          <ul className="agent-card__tasks">
            {agent.preview_tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        )}
      </div>
    </button>
  );
}

export function CreateAgentForm({ onCreated }: { onCreated: () => void }) {
  const [agentId, setAgentId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="create-agent"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        void createAgent({ agent_id: agentId.trim(), display_name: displayName.trim() })
          .then(() => {
            setAgentId("");
            setDisplayName("");
            onCreated();
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
          .finally(() => setPending(false));
      }}
    >
      <h3>新建产品线</h3>
      <div className="create-agent__row">
        <label>
          slug
          <input
            className="handoff-input"
            value={agentId}
            pattern="[a-z][a-z0-9-]{0,63}"
            required
            placeholder="billing"
            onChange={(event) => setAgentId(event.target.value)}
          />
        </label>
        <label>
          显示名
          <input
            className="handoff-input"
            value={displayName}
            required
            maxLength={80}
            placeholder="账单"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "创建中…" : "创建"}
        </button>
      </div>
      {error && <p className="handoff-error">{error}</p>}
    </form>
  );
}

export function BrainPanel({
  data,
  loading,
  error,
  onApplied,
}: {
  data: BrainSuggestResponse | null;
  loading: boolean;
  error: string | null;
  onApplied: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  return (
    <section className="brain-panel">
      <div className="section-head">
        <h3>进度与建议</h3>
        <span className="muted">只生成文案，不外发</span>
      </div>
      {loading && !data && <p className="muted">正在整理这条产品线…</p>}
      {error && <p className="handoff-error">{error}</p>}
      {data && (
        <>
          <p className="brain-panel__summary">{data.summary.text}</p>
          <ul className="brain-list">
            {data.suggestions
              .filter((item) => item.kind !== "summary")
              .map((item, index) => (
              <li key={`${item.kind}-${item.session_id ?? "agent"}-${index}`}>
                <span className="badge">{KIND_LABEL[item.kind]}</span>
                <p>{item.text}</p>
                {item.kind === "reassign" && item.session_id && item.target_agent_id && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={pendingId === item.session_id}
                    onClick={() => {
                      const sessionId = item.session_id;
                      const target = item.target_agent_id;
                      if (!sessionId || !target) return;
                      setPendingId(sessionId);
                      setApplyError(null);
                      void reassignSession(sessionId, target)
                        .then(onApplied)
                        .catch((err: unknown) => setApplyError(err instanceof Error ? err.message : String(err)))
                        .finally(() => setPendingId(null));
                    }}
                  >
                    归到 {item.target_agent_id}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {applyError && <p className="handoff-error">{applyError}</p>}
        </>
      )}
    </section>
  );
}
