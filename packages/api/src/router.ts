import { INBOX_AGENT_ID } from "./lines.js";

export const ROUTE_CONFIDENCE_THRESHOLD = 0.6;

export type RouteCandidate = {
  agent_id: string;
  display_name: string;
  line: string;
  archived: boolean;
  aliases: string[];
  cwd_hints: string[];
};

export type RouteInput = {
  reported_agent_id?: string | null;
  harness?: string | null;
  cwd?: string | null;
  task?: string | null;
};

export type RouteSource = "rule" | "explicit" | "model" | "inbox";

export type RouteDecision = {
  agent_id: string;
  confidence: number;
  source: RouteSource;
  reason: string;
};

export type LightClassifyResult = {
  agent_id: string;
  confidence: number;
  reason: string;
};

export type LightCandidate = {
  agent_id: string;
  display_name: string;
  aliases: string[];
};

/** Optional one-shot classifier. Implementations must not track session progress. */
export interface LightModelClassifier {
  readonly name: string;
  classify(input: RouteInput, candidates: LightCandidate[]): Promise<LightClassifyResult | null>;
}

export class NullLightModel implements LightModelClassifier {
  readonly name = "none";

  async classify(): Promise<LightClassifyResult | null> {
    return null;
  }
}

/**
 * Deterministic stand-in for a light model.
 * `llm:<slug>` → confidence 0.74; `llm:low:<slug>` → 0.35 (must fall through to inbox).
 */
export class DeterministicLightModel implements LightModelClassifier {
  readonly name = "deterministic-stub";

  async classify(input: RouteInput, candidates: LightCandidate[]): Promise<LightClassifyResult | null> {
    const blob = `${input.task ?? ""}\n${input.cwd ?? ""}`;
    const low = blob.match(/(?:^|[^a-z0-9])llm:low:([a-z0-9-]+)/i);
    const known = new Set(candidates.map((c) => c.agent_id));
    if (low?.[1]) {
      const agentId = low[1].toLowerCase();
      if (!known.has(agentId)) return null;
      return { agent_id: agentId, confidence: 0.35, reason: `stub low confidence for ${agentId}` };
    }
    const hit = blob.match(/(?:^|[^a-z0-9])llm:([a-z0-9-]+)/i);
    if (!hit?.[1]) return null;
    const agentId = hit[1].toLowerCase();
    if (!known.has(agentId)) return null;
    return { agent_id: agentId, confidence: 0.74, reason: `stub matched llm:${agentId}` };
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Generic JSON hook. Used only when URL and API key are both set. Failures abstain. */
export class HttpLightModel implements LightModelClassifier {
  readonly name = "http";

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async classify(input: RouteInput, candidates: LightCandidate[]): Promise<LightClassifyResult | null> {
    try {
      const res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          input: {
            reported_agent_id: input.reported_agent_id ?? null,
            harness: input.harness ?? null,
            cwd: input.cwd ?? null,
            task: input.task ?? null,
          },
          candidates: candidates.map((c) => ({
            agent_id: c.agent_id,
            display_name: c.display_name,
            aliases: c.aliases,
          })),
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { agent_id?: unknown; confidence?: unknown; reason?: unknown };
      if (typeof json.agent_id !== "string" || !json.agent_id.trim()) return null;
      const confidence = Number(json.confidence);
      if (!Number.isFinite(confidence)) return null;
      return {
        agent_id: json.agent_id.trim(),
        confidence: Math.min(1, Math.max(0, confidence)),
        reason: typeof json.reason === "string" && json.reason.trim() ? json.reason.trim() : "light-model",
      };
    } catch {
      return null;
    }
  }
}

export function createLightModelFromEnv(env: NodeJS.ProcessEnv = process.env): LightModelClassifier {
  const mode = (env.VIVARIUM_LIGHT_MODEL ?? "").trim().toLowerCase();
  if (mode === "stub" || mode === "deterministic" || mode === "fake") {
    return new DeterministicLightModel();
  }
  const url = env.VIVARIUM_LIGHT_MODEL_URL?.trim();
  const key = env.VIVARIUM_LIGHT_MODEL_API_KEY?.trim();
  if (url && key) return new HttpLightModel(url, key);
  return new NullLightModel();
}

type Hit = {
  agent_id: string;
  confidence: number;
  source: RouteSource;
  reason: string;
  archived?: boolean;
};

function inbox(confidence: number, reason: string): RouteDecision {
  return { agent_id: INBOX_AGENT_ID, confidence, source: "inbox", reason };
}

function tagTokens(task: string): string[] {
  const out: string[] = [];
  const re = /#([^\s#]{1,64})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(task))) {
    let token = match[1] ?? "";
    token = token.replace(/[.,，。!！?？)）]+$/g, "");
    const lower = token.toLowerCase();
    if (lower.startsWith("line:") || lower.startsWith("agent:")) {
      token = token.slice(token.indexOf(":") + 1);
    }
    if (token) out.push(token);
  }
  return out;
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function candidateTerms(candidate: RouteCandidate): string[] {
  return [candidate.agent_id, candidate.line, candidate.display_name, ...candidate.aliases];
}

function termEquals(token: string, candidate: RouteCandidate): boolean {
  const needle = norm(token);
  if (!needle) return false;
  return candidateTerms(candidate).some((term) => norm(term) === needle);
}

function containsTerm(haystack: string, term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length < 2) return false;
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.toLowerCase().includes(trimmed.toLowerCase());
}

function matchTag(task: string | null | undefined, candidates: RouteCandidate[]): Hit | null {
  if (!task) return null;
  for (const token of tagTokens(task)) {
    const hits = candidates.filter((candidate) => termEquals(token, candidate));
    const hit = hits.find((candidate) => !candidate.archived) ?? hits[0];
    if (!hit) continue;
    return {
      agent_id: hit.agent_id,
      confidence: 0.96,
      source: "rule",
      reason: `task tag #${token} matches ${hit.agent_id}`,
      archived: hit.archived,
    };
  }
  return null;
}

function matchExplicit(reported: string | null | undefined, byId: Map<string, RouteCandidate>): Hit | null {
  if (!reported) return null;
  if (reported.includes(":")) return null;
  const hit = byId.get(reported);
  if (!hit) return null;
  return {
    agent_id: hit.agent_id,
    confidence: 0.92,
    source: "explicit",
    reason: `reported agent_id matches product line ${hit.agent_id}`,
    archived: hit.archived,
  };
}

function matchKeyword(task: string | null | undefined, candidates: RouteCandidate[]): Hit | null {
  if (!task?.trim()) return null;
  let best: { candidate: RouteCandidate; term: string } | null = null;
  for (const candidate of candidates) {
    if (candidate.agent_id === INBOX_AGENT_ID || candidate.archived) continue;
    for (const term of candidateTerms(candidate)) {
      if (!containsTerm(task, term)) continue;
      if (!best || term.trim().length > best.term.trim().length) {
        best = { candidate, term: term.trim() };
      }
    }
  }
  if (!best) return null;
  return {
    agent_id: best.candidate.agent_id,
    confidence: 0.82,
    source: "rule",
    reason: `task keyword "${best.term}" matches ${best.candidate.agent_id}`,
    archived: best.candidate.archived,
  };
}

function pathSegments(cwd: string): string[] {
  return cwd
    .split(/[/\\]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part && part !== "~" && part !== "." && part !== "..");
}

function matchCwd(cwd: string | null | undefined, candidates: RouteCandidate[]): Hit | null {
  if (!cwd?.trim()) return null;
  const segments = new Set(pathSegments(cwd));
  if (!segments.size) return null;
  for (const candidate of candidates) {
    if (candidate.agent_id === INBOX_AGENT_ID || candidate.archived) continue;
    const hints = [candidate.agent_id, candidate.line, ...candidate.cwd_hints]
      .map((hint) => hint.trim().toLowerCase())
      .filter((hint) => hint.length >= 2 && !hint.includes(" "));
    if (hints.some((hint) => segments.has(hint))) {
      return {
        agent_id: candidate.agent_id,
        confidence: 0.78,
        source: "rule",
        reason: `cwd segment matches ${candidate.agent_id}`,
        archived: false,
      };
    }
  }
  return null;
}

function applyThreshold(hit: Hit, threshold: number): RouteDecision {
  if (hit.archived) {
    return inbox(hit.confidence, `line ${hit.agent_id} is archived; not assigned`);
  }
  if (hit.agent_id === INBOX_AGENT_ID) {
    return {
      agent_id: INBOX_AGENT_ID,
      confidence: hit.confidence,
      source: hit.source === "inbox" ? "inbox" : hit.source,
      reason: hit.reason,
    };
  }
  if (hit.confidence < threshold) {
    return inbox(hit.confidence, `below threshold (${hit.confidence.toFixed(2)} < ${threshold}); ${hit.reason}`);
  }
  return { agent_id: hit.agent_id, confidence: hit.confidence, source: hit.source, reason: hit.reason };
}

export async function routeSession(
  input: RouteInput,
  candidates: RouteCandidate[],
  opts: { classifier?: LightModelClassifier; threshold?: number } = {},
): Promise<RouteDecision> {
  const threshold = opts.threshold ?? ROUTE_CONFIDENCE_THRESHOLD;
  const byId = new Map(candidates.map((candidate) => [candidate.agent_id, candidate]));
  const tag = matchTag(input.task, candidates);
  if (tag) return applyThreshold(tag, threshold);
  const explicit = matchExplicit(input.reported_agent_id, byId);
  if (explicit) return applyThreshold(explicit, threshold);
  const keyword = matchKeyword(input.task, candidates);
  if (keyword) return applyThreshold(keyword, threshold);
  const cwd = matchCwd(input.cwd, candidates);
  if (cwd) return applyThreshold(cwd, threshold);

  const classifier = opts.classifier;
  if (classifier) {
    const openLines = candidates.filter((candidate) => !candidate.archived && candidate.agent_id !== INBOX_AGENT_ID);
    try {
      const model = await classifier.classify(
        input,
        openLines.map((candidate) => ({
          agent_id: candidate.agent_id,
          display_name: candidate.display_name,
          aliases: candidate.aliases,
        })),
      );
      if (model) {
        const chosen = byId.get(model.agent_id);
        if (!chosen || chosen.archived || chosen.agent_id === INBOX_AGENT_ID) {
          return inbox(model.confidence, `light model suggested unknown line; ${model.reason}`);
        }
        return applyThreshold(
          {
            agent_id: chosen.agent_id,
            confidence: model.confidence,
            source: "model",
            reason: `light-model: ${model.reason}`,
          },
          threshold,
        );
      }
    } catch {
      return inbox(0, "light model failed; left in inbox");
    }
  }

  return inbox(0, "no rule matched; light model abstained");
}
