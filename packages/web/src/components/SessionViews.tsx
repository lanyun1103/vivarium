import type { SessionDetail, SessionSummary } from "../api/types";
import { currentStepLabel, formatRelative, harnessEmoji, liveStatus } from "../lib/sessionUi";
import { HandoffPanel } from "./HandoffPanel";
import { FlowStrip, StepsTimeline } from "./FlowAndSteps";
import { SemanticIcon } from "./SemanticIcon";
import { liveStatusToSemantic } from "../plugins/semantic";
import { TranscriptReplay } from "./TranscriptReplay";

type CardProps = {
  session: SessionSummary;
  detail?: SessionDetail;
  selected: boolean;
  onSelect: () => void;
  kicker?: string;
};

export function SessionCard({ session, detail, selected, onSelect, kicker }: CardProps) {
  const status = liveStatus(session);
  const title = session.task?.trim() || session.session_id;
  const step = currentStepLabel(detail?.steps);
  const hasTurns = (detail?.turns.length ?? 0) > 0;
  const hasSteps = (detail?.steps.length ?? 0) > 0;
  const ended = Boolean(session.outcome || session.ended_at);

  return (
    <button
      type="button"
      className={`session-card session-card--${status} ${selected ? "session-card--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="session-card__avatar" aria-hidden>
        <SemanticIcon semanticKey={liveStatusToSemantic(status)} className="session-card__semantic" />
      </div>
      <div className="session-card__body">
        {kicker && <p className="session-card__kicker">{kicker}</p>}
        <div className="session-card__row">
          <h2 className="session-card__title">{title}</h2>
          <span className={`badge badge--${status}`}>{status}</span>
        </div>
        <p className="session-card__meta">
          <span>{harnessEmoji(session.harness)} {session.harness ?? "unknown"}</span>
          <span>·</span>
          <span>{session.model ?? "model ?"}</span>
          <span>·</span>
          <span>{session.session_id}</span>
          <span>·</span>
          <span>{formatRelative(session.updated_at)}</span>
        </p>
        <p className="session-card__step">
          <span className="label">Step</span> {step}
        </p>
        <FlowStrip hasTurns={hasTurns} hasSteps={hasSteps} ended={ended} />
      </div>
    </button>
  );
}

type DetailProps = {
  detail: SessionDetail | null;
  loading: boolean;
  onClose: () => void;
  agentName?: string;
};

export function SessionDetailPanel({ detail, loading, onClose, agentName }: DetailProps) {
  if (loading && !detail) {
    return (
      <aside className="detail-panel">
        <p className="muted">Loading session…</p>
      </aside>
    );
  }
  if (!detail) {
    return (
      <aside className="detail-panel detail-panel--empty">
        <p>Select a session card to replay steps and transcript.</p>
      </aside>
    );
  }

  const s = detail.session;
  const status = liveStatus(s);

  return (
    <aside className="detail-panel">
      <header className="detail-panel__head">
        <div>
          <h2>{s.task?.trim() || agentName || s.session_id}</h2>
          <p className="muted">
            {agentName ?? s.agent_id} · {s.harness} · {s.model} · {status}
          </p>
          {s.route_reason && (
            <p className="muted">
              路由 {s.route_source ?? "?"} · {s.route_reason}
              {s.agent_locked ? " · 已锁定" : ""}
            </p>
          )}
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </header>
      <section className="detail-section">
        <h3>Task</h3>
        <p>{s.task ?? "—"}</p>
        {s.summary && (
          <>
            <h3>Outcome</h3>
            <p>
              {s.outcome}: {s.summary}
            </p>
          </>
        )}
      </section>
      <section className="detail-section">
        <h3>Steps</h3>
        <StepsTimeline steps={detail.steps} />
      </section>
      <section className="detail-section">
        <h3>Transcript</h3>
        <TranscriptReplay turns={detail.turns} />
      </section>
      <HandoffPanel sessionId={s.session_id} defaultHarness={s.harness} />
    </aside>
  );
}
