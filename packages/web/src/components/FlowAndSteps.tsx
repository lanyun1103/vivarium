import type { SessionStep } from "../api/types";

const FLOW = ["start", "step", "log", "handoff", "end"] as const;

type Props = {
  hasTurns: boolean;
  hasSteps: boolean;
  ended: boolean;
};

export function FlowStrip({ hasTurns, hasSteps, ended }: Props) {
  const active = ended ? "end" : hasSteps ? "step" : hasTurns ? "log" : "start";
  return (
    <div className="flow-strip" aria-label="Session flow">
      {FLOW.map((key) => (
        <span
          key={key}
          className={`flow-chip ${key === active ? "flow-chip--active" : key === "start" || (key === "step" && hasSteps) ? "flow-chip--done" : ""}`}
        >
          {key}
        </span>
      ))}
    </div>
  );
}

type StepProps = { steps: SessionStep[] };

export function StepsTimeline({ steps }: StepProps) {
  if (!steps.length) {
    return <p className="muted">No steps reported yet.</p>;
  }
  return (
    <ol className="steps-timeline">
      {steps.map((step) => (
        <li key={step.step_id} className={`steps-item steps-item--${step.status}`}>
          <span className="steps-dot" aria-hidden />
          <div>
            <div className="steps-title">{step.title}</div>
            <div className="steps-meta">
              <span className="steps-status">{step.status}</span>
              {step.progress != null && <span>{Math.round(step.progress * 100)}%</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
