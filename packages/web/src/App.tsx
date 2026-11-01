import { AgentCardPlaceholder } from "./AgentCardPlaceholder";

export function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Vivarium</h1>
        <p className="subtitle">活体台 · Agent lifecycle observatory</p>
      </header>
      <main className="grid">
        <AgentCardPlaceholder
          agentId="demo-agent"
          harness="claude-code"
          task="Scaffold M0 monorepo"
          running
          currentStep="Typecheck packages"
        />
        <AgentCardPlaceholder
          agentId="handoff-demo"
          harness="grok-bot"
          task="Continue conversation after handoff"
          running={false}
          currentStep="Idle"
        />
      </main>
      <footer className="footer">
        M0 shell — connect adapters to <code>POST /v1/events</code>
      </footer>
    </div>
  );
}
