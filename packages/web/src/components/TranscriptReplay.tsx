import type { TranscriptTurn } from "../api/types";

type Props = { turns: TranscriptTurn[] };

export function TranscriptReplay({ turns }: Props) {
  if (!turns.length) {
    return <p className="muted">No transcript turns yet. Use Claude Code hooks or `pnpm dry-run:claude`.</p>;
  }

  return (
    <div className="transcript" role="log" aria-label="Transcript replay">
      {turns.map((turn, i) => (
        <article key={`${turn.at}-${i}`} className={`bubble bubble--${turn.role}`}>
          <header className="bubble__head">
            <span className="bubble__role">{turn.role}</span>
            <time className="bubble__time" dateTime={turn.at}>
              {turn.at}
            </time>
          </header>
          <p className="bubble__body">{turn.content}</p>
        </article>
      ))}
    </div>
  );
}
