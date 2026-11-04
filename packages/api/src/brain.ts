import { INBOX_AGENT_ID, type LinePolicy } from "./lines.js";
import { routeSession, type RouteDecision } from "./router.js";
import { StoreError, type EventStore, type SessionSummary } from "./store.js";

export type SuggestionKind = "reassign" | "nudge" | "summary" | "handoff";

export type BrainSuggestion = {
  kind: SuggestionKind;
  agent_id: string;
  session_id?: string;
  target_agent_id?: string;
  text: string;
  confidence: number;
};

export type ProgressSummary = {
  agent_id: string;
  display_name: string;
  text: string;
  running: number;
  ended: number;
  total: number;
  latest_tasks: string[];
  latest_step: string | null;
};

export type BrainSuggestResult = {
  summary: ProgressSummary;
  suggestions: BrainSuggestion[];
};

function renderSummary(
  displayName: string,
  policy: LinePolicy,
  stats: { running: number; ended: number; total: number; latest_tasks: string[]; latest_step: string | null },
): string {
  const tasks = stats.latest_tasks.length ? stats.latest_tasks.join("；") : "（还没有任务描述）";
  const step = stats.latest_step ? `最近一步「${stats.latest_step}」。` : "";
  if (policy.summary_style === "inbox") {
    return `待分拣里有 ${stats.total} 条会话，其中 ${stats.running} 条未结束。它们还没有被确信地归到产品线。最近任务：${tasks}。${step}`;
  }
  if (policy.summary_style === "ops") {
    return `${displayName}：${stats.running} 个会话进行中，${stats.ended} 个已结束（共 ${stats.total}）。最近任务：${tasks}。${step}关注步骤是否还在推进。`;
  }
  return `${displayName}：并行 ${stats.running} 条产品会话（共 ${stats.total}，已结束 ${stats.ended}）。最近在做：${tasks}。${step}`;
}

function isOpen(session: SessionSummary): boolean {
  return !session.ended_at && !session.outcome;
}

export class BrainService {
  constructor(private readonly store: EventStore) {}

  reassign(sessionId: string, agentId: string): SessionSummary {
    return this.store.reassignSession(sessionId, agentId);
  }

  summarize(agentId: string): ProgressSummary {
    const agent = this.store.getAgent(agentId);
    if (!agent) throw new StoreError("not_found", "agent not found");
    const stats = this.store.agentProgress(agentId);
    return {
      agent_id: agent.agent_id,
      display_name: agent.display_name,
      text: renderSummary(agent.display_name, agent.policy, stats),
      ...stats,
    };
  }

  /**
   * Emit suggestions only. Does not send mail, chat, or harness commands.
   * `reassign` is a suggestion until something calls {@link reassign}.
   */
  async suggest(input: { agent_id?: string; session_id?: string }): Promise<BrainSuggestResult> {
    let agentId = input.agent_id;
    let sessions: SessionSummary[];
    if (input.session_id) {
      const detail = this.store.getSession(input.session_id);
      if (!detail) throw new StoreError("not_found", "session not found");
      if (agentId && detail.session.agent_id && agentId !== detail.session.agent_id) {
        throw new StoreError("invalid", "session is not on that agent");
      }
      agentId = detail.session.agent_id ?? INBOX_AGENT_ID;
      sessions = [detail.session];
    } else if (agentId) {
      if (!this.store.getAgent(agentId)) throw new StoreError("not_found", "agent not found");
      sessions = this.store.listSessions({ agentId, limit: 20 });
    } else {
      throw new StoreError("invalid", "agent_id or session_id is required");
    }

    const summary = this.summarize(agentId);
    const policy = this.store.getAgent(agentId)?.policy;
    const candidates = this.store.listRouteCandidates();
    const names = new Map(candidates.map((candidate) => [candidate.agent_id, candidate.display_name]));
    const failed = new Set(this.store.sessionIdsWithFailedSteps(sessions.map((session) => session.session_id)));

    const suggestions: BrainSuggestion[] = [
      {
        kind: "summary",
        agent_id: agentId,
        text: summary.text,
        confidence: 1,
      },
    ];

    for (const session of sessions) {
      const decision = await this.decide(session, candidates);
      if (
        decision.agent_id !== INBOX_AGENT_ID &&
        decision.agent_id !== session.agent_id &&
        decision.confidence >= 0.6 &&
        decision.source !== "inbox"
      ) {
        const targetName = names.get(decision.agent_id) ?? decision.agent_id;
        const locked = session.agent_locked ? "会话已锁定，需要手动归线。" : "尚未执行。";
        suggestions.push({
          kind: "reassign",
          agent_id: agentId,
          session_id: session.session_id,
          target_agent_id: decision.agent_id,
          text: `建议将会话从 ${names.get(session.agent_id ?? "") ?? session.agent_id ?? "未归线"} 归到 ${targetName}（${decision.reason}）。${locked}`,
          confidence: decision.confidence,
        });
      }

      if (isOpen(session) && policy) {
        const prefix = failed.has(session.session_id) ? "有失败步骤。" : "";
        suggestions.push({
          kind: "nudge",
          agent_id: agentId,
          session_id: session.session_id,
          text: `${prefix}${policy.nudge_copy}`,
          confidence: 0.5,
        });
      }

      if (session.outcome === "success" && policy?.handoff_hint) {
        const task = session.task ? ` 任务：${session.task}` : "";
        suggestions.push({
          kind: "handoff",
          agent_id: agentId,
          session_id: session.session_id,
          text: `${policy.handoff_hint}${task}（仅建议，未生成外发。）`,
          confidence: 0.4,
        });
      }
    }

    const summarySuggestion = suggestions[0]!;
    const rest = suggestions.slice(1, 12);
    return { summary, suggestions: [summarySuggestion, ...rest] };
  }

  private async decide(
    session: SessionSummary,
    candidates: ReturnType<EventStore["listRouteCandidates"]>,
  ): Promise<RouteDecision> {
    return routeSession(
      {
        reported_agent_id: session.reported_agent_id,
        harness: session.harness,
        cwd: this.store.sessionCwd(session.session_id),
        task: session.task,
      },
      candidates,
      { classifier: this.store.classifier },
    );
  }
}
