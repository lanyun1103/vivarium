import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiBaseLabel,
  fetchAgents,
  fetchSessionDetail,
  fetchSessions,
} from "./api/client";
import type { AgentSummary, SessionDetail, SessionSummary } from "./api/types";
import { EmptyState } from "./components/EmptyState";
import { SessionCard, SessionDetailPanel } from "./components/SessionViews";
import { usePoll } from "./hooks/usePoll";
import { liveStatus } from "./lib/sessionUi";
import { applyThemeVariables, defaultTheme } from "./theme/skin";

const POLL_MS = 4000;

type Dashboard = {
  sessions: SessionSummary[];
  agents: AgentSummary[];
};

export function App() {
  useEffect(() => {
    applyThemeVariables(defaultTheme);
  }, []);

  const loadDashboard = useCallback(async (): Promise<Dashboard> => {
    const [sessionsRes, agentsRes] = await Promise.all([fetchSessions(50), fetchAgents(50)]);
    return { sessions: sessionsRes.sessions, agents: agentsRes.agents };
  }, []);
  const { data, error, loading, refresh } = usePoll(loadDashboard, POLL_MS);

  const sessions = data?.sessions ?? [];
  const agents = data?.agents ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stepCache, setStepCache] = useState<Record<string, SessionDetail>>({});

  const runningIds = useMemo(
    () =>
      sessions
        .filter((s) => liveStatus(s) !== "idle")
        .slice(0, 12)
        .map((s) => s.session_id),
    [sessions],
  );

  useEffect(() => {
    let cancelled = false;
    if (!runningIds.length) return;
    void (async () => {
      const entries = await Promise.all(
        runningIds.map(async (id) => {
          try {
            const d = await fetchSessionDetail(id);
            return [id, d] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setStepCache((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          if (e) next[e[0]] = e[1];
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
        const d = await fetchSessionDetail(selectedId);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    const id = window.setInterval(() => {
      void fetchSessionDetail(selectedId).then((d) => {
        if (!cancelled) setDetail(d);
      });
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedId]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Vivarium</h1>
          <p className="subtitle">活体台 · Agent observatory</p>
        </div>
        <div className="topbar__meta">
          <span className="pill">{apiBaseLabel()}</span>
          <button type="button" className="btn-ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="banner banner--error" role="alert">
          API unreachable: {error}. Run <code>pnpm dev:api</code> and check{" "}
          <code>VITE_VIVARIUM_URL</code>.
        </div>
      )}

      <div className="console">
        <section className="console__list">
          {agents.length > 0 && (
            <div className="agents-row" aria-label="Agents">
              {agents.slice(0, 12).map((a) => (
                <span key={a.agent_id} className="agent-chip">
                  {a.agent_id} · {a.session_count} session{a.session_count === 1 ? "" : "s"}
                </span>
              ))}
            </div>
          )}
          <div className="section-head">
            <h2>Sessions</h2>
            {!loading && <span className="muted">{sessions.length} recent</span>}
          </div>
          {!loading && sessions.length === 0 && (
            <EmptyState
              message="No sessions yet"
              hint="Run pnpm dev:api, then pnpm dry-run:claude — or install Claude Code hooks."
            />
          )}
          <div className="card-grid">
            {sessions.map((s: SessionSummary) => (
              <SessionCard
                key={s.session_id}
                session={s}
                detail={stepCache[s.session_id] ?? (selectedId === s.session_id ? detail ?? undefined : undefined)}
                selected={selectedId === s.session_id}
                onSelect={() => setSelectedId(s.session_id)}
              />
            ))}
          </div>
        </section>
        <SessionDetailPanel
          detail={selectedId ? detail : null}
          loading={detailLoading}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
