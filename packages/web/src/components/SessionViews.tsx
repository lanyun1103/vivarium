import type { SessionDetail, SessionSummary } from "../api/types";
import { currentStepLabel, formatRelative, harnessEmoji, liveStatus, statusEmoji } from "../lib/sessionUi";
import { HandoffPanel } from "./HandoffPanel";
import { FlowStrip, StepsTimeline } from "./FlowAndSteps";
import { TranscriptReplay } from "./TranscriptReplay";

type CardProps = {
  session: SessionSummary;
  detail?: SessionDetail;
  selected: boolean;
  onSelect: () => void;
};

export function SessionCard({ session, detail, selected, onSelect }: CardProps) {
  const status = liveStatus(session);
  const agent = session.agent_id ?? session.session_id.slice(0, 8);
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
        {statusEmoji(status)}
      </div>
      <div className="session-card__body">
        <div className="session-card__row">
          <h2 className="session-card__title">{agent}</h2>
          <span className={`badge badge--${status}`}>{status}</span>
        </div>
        <p className="session-card__meta">
          <span>{harnessEmoji(session.harness)} {session.harness ?? "unknown"}</span>
          <span>·</span>
          <span>{session.model ?? "model ?"}</span>
          <span>·</span>
          <span>{formatRelative(session.updated_at)}</span>
        </p>
        <p className="session-card__task">{session.task ?? "No task summary"}</p>
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
};

export function SessionDetailPanel({ detail, loading, onClose }: DetailProps) {
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
          <h2>{s.agent_id ?? s.session_id}</h2>
          <p className="muted">
            {s.harness} · {s.model} · {status}
          </p>
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
