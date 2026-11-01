import { useState } from "react";
import { createHandoff } from "../api/client";
import type { HandoffPackage } from "../api/types";

type Props = {
  sessionId: string;
  defaultHarness?: string | null;
};

export function HandoffPanel({ sessionId, defaultHarness }: Props) {
  const [toHarness, setToHarness] = useState(defaultHarness ?? "claude-code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<HandoffPackage | null>(null);
  const [resume, setResume] = useState<{
    claude_code: string;
    generic_curl: string;
    summary: string;
  } | null>(null);

  async function onHandoff() {
    setLoading(true);
    setError(null);
    try {
      const result = await createHandoff(sessionId, toHarness.trim() || "generic");
      setPkg(result.package);
      setResume(result.resume);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function downloadJson() {
    if (!pkg) return;
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vivarium-handoff-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="detail-section handoff-panel">
      <h3>换马 / Handoff</h3>
      <p className="muted">Package context for another harness (PoC — manual resume).</p>
      <div className="handoff-row">
        <label className="handoff-label">
          Target harness
          <input
            className="handoff-input"
            value={toHarness}
            onChange={(e) => setToHarness(e.target.value)}
            placeholder="claude-code"
          />
        </label>
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void onHandoff()}>
          {loading ? "Building…" : "Generate handoff"}
        </button>
      </div>
      {error && <p className="handoff-error">{error}</p>}
      {pkg && resume && (
        <div className="handoff-result">
          <p>{resume.summary}</p>
          <div className="handoff-actions">
            <button type="button" className="btn-ghost" onClick={downloadJson}>
              Download JSON
            </button>
          </div>
          <h4>Claude Code</h4>
          <pre className="handoff-pre">{resume.claude_code}</pre>
          <h4>Generic / curl</h4>
          <pre className="handoff-pre">{resume.generic_curl}</pre>
          {pkg.resume_prompt && (
            <>
              <h4>resume_prompt</h4>
              <pre className="handoff-pre">{pkg.resume_prompt}</pre>
            </>
          )}
        </div>
      )}
    </section>
  );
}
