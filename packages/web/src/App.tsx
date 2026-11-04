import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiBaseLabel,
  fetchAgent,
  fetchAgents,
  fetchSessionDetail,
  fetchSessions,
  patchAgent,
  suggestBrain,
} from "./api/client";
import type { AgentDetailResponse, AgentSummary, BrainSuggestResponse, SessionDetail, SessionSummary } from "./api/types";
import { AgentCard, BrainPanel, CreateAgentForm } from "./components/AgentViews";
import { EmptyState } from "./components/EmptyState";
import { PluginPicker } from "./components/PluginPicker";
import { SessionCard, SessionDetailPanel } from "./components/SessionViews";
import { usePoll } from "./hooks/usePoll";
import { liveStatus } from "./lib/sessionUi";

const POLL_MS = 4000;

type Mode = "lines" | "all";

type Dashboard = {
  sessions: SessionSummary[];
  agents: AgentSummary[];
};

export function App() {
  const [mode, setMode] = useState<Mode>("lines");
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stepCache, setStepCache] = useState<Record<string, SessionDetail>>({});

  const loadDashboard = useCallback(async (): Promise<Dashboard> => {
    const [sessionsRes, agentsRes] = await Promise.all([
      fetchSessions(80),
      fetchAgents(50, showArchived),
    ]);
    return { sessions: sessionsRes.sessions, agents: agentsRes.agents };
  }, [showArchived]);
  const { data, error, loading, refresh } = usePoll(loadDashboard, POLL_MS);

  const loadAgent = useCallback(async (): Promise<AgentDetailResponse | null> => {
    if (!openAgentId) return null;
    return fetchAgent(openAgentId);
  }, [openAgentId]);
  const agentPoll = usePoll(loadAgent, POLL_MS, Boolean(openAgentId));

  const loadBrain = useCallback(async (): Promise<BrainSuggestResponse | null> => {
    if (!openAgentId) return null;
    return suggestBrain({ agent_id: openAgentId });
  }, [openAgentId]);
  const brainPoll = usePoll(loadBrain, POLL_MS, Boolean(openAgentId));

  const sessions = data?.sessions ?? [];
  const agents = data?.agents ?? [];
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents) map.set(agent.agent_id, agent.display_name);
    if (agentPoll.data?.agent) map.set(agentPoll.data.agent.agent_id, agentPoll.data.agent.display_name);
    return map;
  }, [agents, agentPoll.data]);

  const visibleSessions = openAgentId ? (agentPoll.data?.sessions ?? []) : mode === "all" ? sessions : [];
  const runningIds = useMemo(
    () =>
      visibleSessions
        .filter((session) => liveStatus(session) !== "idle")
        .slice(0, 12)
        .map((session) => session.session_id),
    [visibleSessions],
  );

  useEffect(() => {
    let cancelled = false;
    if (!runningIds.length) return;
    void (async () => {
      const entries = await Promise.all(
        runningIds.map(async (id) => {
          try {
            const next = await fetchSessionDetail(id);
            return [id, next] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setStepCache((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [runningIds.join(",")]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const next = await fetchSessionDetail(selectedId);
        if (!cancelled) setDetail(next);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    const id = window.setInterval(() => {
      void fetchSessionDetail(selectedId).then((next) => {
        if (!cancelled) setDetail(next);
      });
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedId]);

  function openLines() {
    setMode("lines");
    setOpenAgentId(null);
    setSelectedId(null);
  }

  function openAll() {
    setMode("all");
    setOpenAgentId(null);
    setSelectedId(null);
  }

  const agentName = selectedId ? names.get(detail?.session.agent_id ?? "") : undefined;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Vivarium</h1>
          <p className="subtitle">活体台 · 产品线</p>
        </div>
        <div className="topbar__meta">
          <PluginPicker />
          <span className="pill">{apiBaseLabel()}</span>
          <button type="button" className="btn-ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="banner banner--error" role="alert">
          API unreachable: {error}. Run <code>pnpm dev:api</code> and check <code>VITE_VIVARIUM_URL</code>.
        </div>
      )}

      <div className="view-switch" role="tablist" aria-label="浏览方式">
        <button type="button" className={mode === "lines" && !openAgentId ? "is-active" : ""} onClick={openLines}>
          产品线
        </button>
        <button type="button" className={mode === "all" && !openAgentId ? "is-active" : ""} onClick={openAll}>
          全部会话
        </button>
        <label className="view-switch__check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          显示已归档
        </label>
      </div>

      <div className={selectedId ? "console" : "console console--single"}>
        <section className="console__list">
          {mode === "lines" && !openAgentId && (
            <>
              <div className="section-head">
                <h2>产品线</h2>
                {!loading && <span className="muted">{agents.length} 条线并行</span>}
              </div>
              {!loading && agents.length === 0 && (
                <EmptyState message="还没有产品线" hint="创建一条产品线，或启动 API 以载入内置的天眼 / 公司 / 待分拣。" />
              )}
              <div className="agent-grid">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.agent_id}
                    agent={agent}
                    onOpen={() => {
                      setOpenAgentId(agent.agent_id);
                      setSelectedId(null);
                    }}
                  />
                ))}
              </div>
              <CreateAgentForm onCreated={() => void refresh()} />
            </>
          )}

          {openAgentId && (
            <>
              <div className="section-head">
                <h2>
                  <button type="button" className="btn-ghost" onClick={openLines}>
                    ← 产品线
                  </button>{" "}
                  {agentPoll.data?.agent.display_name ?? openAgentId}
                </h2>
                <span className="section-head__actions">
                  {agentPoll.data?.agent && agentPoll.data.agent.agent_id !== "inbox" && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        const archived = !agentPoll.data?.agent.archived;
                        void patchAgent(openAgentId, { archived }).then(() => {
                          void refresh();
                          void agentPoll.refresh();
                        });
                      }}
                    >
                      {agentPoll.data.agent.archived ? "取消归档" : "归档"}
                    </button>
                  )}
                  <span className="muted">{agentPoll.data?.agent.line}</span>
                </span>
              </div>
              {agentPoll.data?.agent.description && <p className="agent-lead">{agentPoll.data.agent.description}</p>}
              <BrainPanel
                data={brainPoll.data}
                loading={brainPoll.loading}
                error={brainPoll.error}
                onApplied={() => {
                  void refresh();
                  void agentPoll.refresh();
                  void brainPoll.refresh();
                }}
              />
              {!agentPoll.loading && visibleSessions.length === 0 && (
                <EmptyState
                  message="这条产品线还没有会话"
                  hint="新会话会在 session.start 时由轻路由归线；对不上的进待分拣。"
                />
              )}
            </>
          )}

          {mode === "all" && !openAgentId && (
            <div className="section-head">
              <h2>全部会话</h2>
              {!loading && <span className="muted">{sessions.length} recent</span>}
            </div>
          )}

          {(openAgentId || mode === "all") && !loading && mode === "all" && sessions.length === 0 && (
            <EmptyState
              message="No sessions yet"
              hint="Run pnpm dev:api, then pnpm dry-run:claude — unmatched harness ids land in 待分拣."
            />
          )}

          {(openAgentId || mode === "all") && visibleSessions.length > 0 && (
            <div className="card-grid">
              {visibleSessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  kicker={
                    openAgentId
                      ? undefined
                      : (names.get(session.agent_id ?? "") ?? session.agent_id ?? undefined)
                  }
                  detail={
                    stepCache[session.session_id] ?? (selectedId === session.session_id ? detail ?? undefined : undefined)
                  }
                  selected={selectedId === session.session_id}
                  onSelect={() => setSelectedId(session.session_id)}
                />
              ))}
            </div>
          )}
        </section>
        {selectedId && (
          <SessionDetailPanel
            detail={detail}
            loading={detailLoading}
            agentName={agentName ?? (detail?.session.agent_id ? names.get(detail.session.agent_id) : undefined)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
