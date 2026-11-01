type Props = { message: string; hint?: string };

export function EmptyState({ message, hint }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__emoji" aria-hidden>
        🪴
      </div>
      <p className="empty-state__title">{message}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
    </div>
  );
}
