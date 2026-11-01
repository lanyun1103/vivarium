import { parseTranscriptJsonlFile } from "./parse-transcript-jsonl.js";
import { join } from "node:path";

const fixture = join(import.meta.dirname, "../fixtures/sample-transcript.jsonl");
const turns = await parseTranscriptJsonlFile(fixture, { maxLines: 50, maxTurnChars: 8000 });
if (turns.length < 2) {
  console.error("expected >= 2 turns, got", turns.length);
  process.exit(1);
}
console.log("test-parse-transcript: OK", turns.length);
