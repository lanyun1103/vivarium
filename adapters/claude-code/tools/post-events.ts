import { readFileSync } from "node:fs";
import { VivariumClient } from "@vivarium/sdk";
import { parseEventsBatch, type VivariumEvent } from "@vivarium/schema";

export type PostOptions = {
  baseUrl?: string;
  token?: string;
  validate?: boolean;
  /** Never throw; for hook subprocesses */
  softFail?: boolean;
};

export async function postEvents(events: VivariumEvent[], options: PostOptions = {}): Promise<boolean> {
  const baseUrl = options.baseUrl ?? process.env.VIVARIUM_URL;
  if (!baseUrl) {
    if (options.softFail) return false;
    throw new Error("VIVARIUM_URL is not set");
  }

  if (options.validate !== false) {
    parseEventsBatch({ events });
  }

  const client = new VivariumClient({
    baseUrl,
    token: options.token ?? process.env.VIVARIUM_TOKEN,
  });

  try {
    await client.postEvents(events);
    return true;
  } catch (err) {
    if (options.softFail) {
      console.error("[vivarium]", err instanceof Error ? err.message : String(err));
      return false;
    }
    throw err;
  }
}

export function readEventsArg(argv: string[]): VivariumEvent[] {
  const flag = argv.indexOf("--events");
  if (flag === -1) throw new Error("usage: post-events.ts --events '<json array>'");
  const raw = argv[flag + 1];
  if (!raw) throw new Error("missing --events JSON");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("events must be a JSON array");
  return parseEventsBatch({ events: parsed }).events;
}

export function readEventsFile(path: string): VivariumEvent[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("events file must be a JSON array");
  return parseEventsBatch({ events: parsed }).events;
}
