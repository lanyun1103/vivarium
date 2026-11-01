import { VivariumClient } from "@vivarium/sdk";
import { parseEventsBatch, type VivariumEvent } from "@vivarium/schema";

export function requireVivariumUrl(): string {
  const url = process.env.VIVARIUM_URL;
  if (!url) throw new Error("VIVARIUM_URL is required");
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
