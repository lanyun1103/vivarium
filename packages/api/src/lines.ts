/** Product-line policy contribution. Plugin-shaped: id + aliases + copy hooks. */
export type SummaryStyle = "ops" | "product" | "inbox";

export type LinePolicy = {
  id: string;
  summary_style: SummaryStyle;
  nudge_copy: string;
  handoff_hint: string;
  aliases: string[];
  cwd_hints: string[];
};

export type PolicyPatch = {
  summary_style?: SummaryStyle;
  nudge_copy?: string;
  handoff_hint?: string;
  aliases?: string[];
  cwd_hints?: string[];
};

export type BuiltinLine = {
  agent_id: string;
  line: string;
  display_name: string;
  avatar: string;
  description: string;
  policy: LinePolicy;
};

export const INBOX_AGENT_ID = "inbox";

export const BUILTIN_LINES: BuiltinLine[] = [
  {
    agent_id: INBOX_AGENT_ID,
    line: "inbox",
    display_name: "待分拣",
    avatar: "📥",
    description: "置信度不够时的收件箱。轻路由不会把会话盲分到某条产品线。",
    policy: {
      id: INBOX_AGENT_ID,
      summary_style: "inbox",
      nudge_copy: "这条会话还在待分拣。补一个 #产品线 标签，或手动归线。",
      handoff_hint: "待分拣里的会话先归线，再考虑换马。",
      aliases: ["待分拣", "inbox", "unsorted"],
      cwd_hints: [],
    },
  },
  {
    agent_id: "tianyan",
    line: "tianyan",
    display_name: "天眼",
    avatar: "👁️",
    description: "观测与进度线。关注步骤是否还在推进。",
    policy: {
      id: "tianyan",
      summary_style: "ops",
      nudge_copy: "天眼关注观测与进度：核对步骤是否仍在推进，必要时补一条心跳。",
      handoff_hint: "观测线交接时带上步骤状态和最近 transcript。",
      aliases: ["天眼", "tianyan", "observatory"],
      cwd_hints: ["tianyan"],
    },
  },
  {
    agent_id: "company",
    line: "company",
    display_name: "公司",
    avatar: "🏢",
    description: "业务交付线。用一句话说明对内对外的下一步。",
    policy: {
      id: "company",
      summary_style: "product",
      nudge_copy: "公司线偏业务交付：用一句话说明对客户或内部的下一步。",
      handoff_hint: "交接时写清业务目标，而不是工具调用细节。",
      aliases: ["公司", "company", "corp"],
      cwd_hints: ["company", "corp"],
    },
  },
  {
    agent_id: "reverse",
    line: "reverse",
    display_name: "逆向",
    avatar: "🔍",
    description: "逆向分析线。记录当前假设，避免重复拆同一路径。",
    policy: {
      id: "reverse",
      summary_style: "ops",
      nudge_copy: "逆向线：记录当前假设和已确认的入口，避免重复拆同一路径。",
      handoff_hint: "交接时写明已确认入口和尚未验证的假设。",
      aliases: ["逆向", "reverse", "反编译"],
      cwd_hints: ["reverse"],
    },
  },
  {
    agent_id: "feishu-monitor",
    line: "feishu-monitor",
    display_name: "飞书监控",
    avatar: "💬",
    description: "飞书监控线。这里只产生文案建议，不外发消息。",
    policy: {
      id: "feishu-monitor",
      summary_style: "ops",
      nudge_copy: "飞书监控：确认告警是否已记录。本骨架只给文案，不外发消息。",
      handoff_hint: "交接时附上告警对象和当前是否仍未恢复。",
      aliases: ["飞书", "飞书监控", "feishu", "feishu-monitor", "lark"],
      cwd_hints: ["feishu", "feishu-monitor", "lark"],
    },
  },
  {
    agent_id: "grok-product",
    line: "grok-product",
    display_name: "Grok 产品",
    avatar: "✨",
    description: "Grok 产品线。用用户可感知的结果描述进度。",
    policy: {
      id: "grok-product",
      summary_style: "product",
      nudge_copy: "Grok 产品线：用用户可感知的结果描述进度。",
      handoff_hint: "交接时写清用户可见的未完成结果。",
      aliases: ["grok-product", "grok产品", "grok 产品"],
      cwd_hints: ["grok-product"],
    },
  },
];

export function defaultPolicy(agentId: string, displayName: string): LinePolicy {
  const builtin = BUILTIN_LINES.find((line) => line.agent_id === agentId);
  if (builtin) return { ...builtin.policy, aliases: [...builtin.policy.aliases], cwd_hints: [...builtin.policy.cwd_hints] };
  return {
    id: agentId,
    summary_style: "product",
    nudge_copy: `${displayName}：看一下这条产品线还卡在哪一步，补一句下一步。`,
    handoff_hint: `若要换马，为 ${displayName} 写清未完成目标。`,
    aliases: [],
    cwd_hints: [agentId],
  };
}

function isStyle(value: unknown): value is SummaryStyle {
  return value === "ops" || value === "product" || value === "inbox";
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export function parsePolicy(agentId: string, displayName: string, raw: string | null): LinePolicy {
  const base = defaultPolicy(agentId, displayName);
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== "object") return base;
  return mergePolicy(base, parsed as PolicyPatch);
}

export function mergePolicy(base: LinePolicy, patch: PolicyPatch): LinePolicy {
  const aliases = stringList(patch.aliases);
  const cwdHints = stringList(patch.cwd_hints);
  return {
    id: base.id,
    summary_style: isStyle(patch.summary_style) ? patch.summary_style : base.summary_style,
    nudge_copy: typeof patch.nudge_copy === "string" && patch.nudge_copy.trim() ? patch.nudge_copy.trim() : base.nudge_copy,
    handoff_hint: typeof patch.handoff_hint === "string" ? patch.handoff_hint.trim() : base.handoff_hint,
    aliases: aliases ?? base.aliases,
    cwd_hints: cwdHints ?? base.cwd_hints,
  };
}

export function policyJson(policy: LinePolicy): string {
  return JSON.stringify(policy);
}
