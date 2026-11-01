import {
  type IngestEventsRequest,
  type VivariumEvent,
  parseEventsBatch,
} from "@vivarium/schema";

export type VivariumClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export class VivariumClient {
  readonly #baseUrl: string;
  readonly #token?: string;
  readonly #fetch: typeof fetch;

  constructor(options: VivariumClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#token = options.token;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async postEvents(events: VivariumEvent[]): Promise<{ accepted: number }> {
    const body: IngestEventsRequest = { events };
    parseEventsBatch(body);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.#token) {
      headers.Authorization = `Bearer ${this.#token}`;
    }

    const res = await this.#fetch(`${this.#baseUrl}/v1/events`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Vivarium ingest failed (${res.status}): ${text}`);
    }

    return (await res.json()) as { accepted: number };
  }
}

export { type VivariumEvent } from "@vivarium/schema";
