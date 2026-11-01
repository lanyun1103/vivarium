type Props = {
  agentId: string;
  harness: string;
  task: string;
  running: boolean;
  currentStep: string;
};

export function AgentCardPlaceholder({ agentId, harness, task, running, currentStep }: Props) {
  return (
    <article className={`card ${running ? "card--live" : ""}`}>
      <div className="card__avatar" aria-hidden>
        {running ? "🌱" : "💤"}
      </div>
      <div className="card__body">
        <div className="card__row">
          <h2 className="card__title">{agentId}</h2>
          <span className={`badge ${running ? "badge--ok" : ""}`}>{running ? "running" : "idle"}</span>
        </div>
        <p className="card__meta">
          <span>{harness}</span>
          <span>·</span>
          <span>{currentStep}</span>
        </p>
        <p className="card__task">{task}</p>
        <div className="card__flow">
          <span className="flow-step done">start</span>
          <span className="flow-step active">step</span>
          <span className="flow-step">log</span>
          <span className="flow-step">handoff</span>
          <span className="flow-step">end</span>
        </div>
      </div>
    </article>
  );
}
