import type { SemanticEmojiKey } from "@vivarium/schema";
import { usePlugins } from "../plugins/PluginContext";

type Props = {
  semanticKey: SemanticEmojiKey;
  className?: string;
  alt?: string;
};

export function SemanticIcon({ semanticKey, className, alt }: Props) {
  const { resolveEmojiUrl, resolveEmojiGlyph } = usePlugins();
  const url = resolveEmojiUrl(semanticKey);
  if (url) {
    return <img src={url} alt={alt ?? semanticKey} className={className ?? "semantic-icon"} />;
  }
  return (
    <span className={className ?? "semantic-icon semantic-icon--glyph"} aria-hidden>
      {resolveEmojiGlyph(semanticKey)}
    </span>
  );
}
