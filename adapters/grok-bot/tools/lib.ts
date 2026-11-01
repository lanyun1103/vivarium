import { VivariumClient } from "@vivarium/sdk";
import { parseEventsBatch, type VivariumEvent } from "@vivarium/schema";

export function requireVivariumUrl(): string {
  const url = process.env.VIVARIUM_URL;
  if (!url) {
    throw new Error("VIVARIUM_URL is required (e.g. http://127.0.0.1:8787)");
  }
  return url;
}

export async function sendEvents(events: VivariumEvent[]): Promise<void> {
  parseEventsBatch({ events });
  const client = new VivariumClient({
    baseUrl: requireVivariumUrl(),
    token: process.env.VIVARIUM_TOKEN,
  });
  await client.postEvents(events);
}

export function redactPath(input: string): string {
  const home = process.env.HOME;
  let out = input;
  if (home && out.includes(home)) out = out.split(home).join("~");
  return out.replace(/\/Users\/[^/]+/g, "~").replace(/\/home\/[^/]+/g, "~");
}

export function isoNow(): string {
  return new Date().toISOString();
}
