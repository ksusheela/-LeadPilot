import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * LeadPilot automation boundary. Three modes, picked from env (first match wins):
 *
 * 1. "claude-mcp" — Web App → Claude → MCP → n8n.
 *    Needs ANTHROPIC_API_KEY, N8N_MCP_URL and N8N_MCP_TOKEN (the n8n
 *    instance-level MCP server URL + access token from n8n Settings).
 *    Claude connects to n8n through the Messages API MCP connector, runs the
 *    "LeadPilot — Qualify Lead" workflow and reports its output.
 *
 * 2. "webhook" — Web App → n8n webhook directly. Needs N8N_LEADPILOT_WEBHOOK_URL.
 *
 * 3. "demo" — nothing configured. A local keyword heuristic; never calls
 *    Claude or n8n and is always labelled as simulated.
 */

export type QualifyLeadInput = { lead: string };

export type LeadResult = {
  category: string;
  priority: string;
  summary: string;
  nextAction: string;
};

export type AutomationMode = "claude-mcp" | "webhook" | "demo";

export type QualifyLeadResponse = {
  mode: AutomationMode;
  result: LeadResult;
  executionId?: string;
};

const env = (k: string) => process.env[k]?.trim() || undefined;

const WORKFLOW_NAME = "LeadPilot — Qualify Lead";

export function automationMode(): AutomationMode {
  if (env("ANTHROPIC_API_KEY") && env("N8N_MCP_URL")) return "claude-mcp";
  if (env("N8N_LEADPILOT_WEBHOOK_URL")) return "webhook";
  return "demo";
}

export async function qualifyLead(
  input: QualifyLeadInput,
): Promise<QualifyLeadResponse> {
  const lead = input.lead.trim();
  if (!lead) throw new Error("Lead text is empty.");

  switch (automationMode()) {
    case "claude-mcp":
      return viaClaudeMcp(lead);
    case "webhook":
      return { mode: "webhook", result: await viaWebhook(lead) };
    default:
      return { mode: "demo", result: demoQualify(lead) };
  }
}

// ---------------------------------------------------------------------------
// Mode 1: Claude → MCP → n8n

const SYSTEM = `You are the orchestrator for LeadPilot. You have tools from an n8n MCP server.

Your only job is to run the n8n workflow named "${WORKFLOW_NAME}" on the lead text you are given and report what the workflow returned:
1. Find the workflow (search for it by name unless you are given its ID) and read its details to learn its trigger and input format.
2. Execute it with the lead text as input.
3. Retrieve the execution and read the workflow's output.

Do not qualify the lead yourself. Every field you report must come from the workflow's execution output. If any step fails, set "executed" to false and explain in "error".

Reply with only one JSON object, no prose and no code fence:
{"executed": boolean, "executionId": string | null, "category": string, "priority": string, "summary": string, "nextAction": string, "error": string | null}`;

type ClaudeReport = Partial<LeadResult> & {
  executed?: boolean;
  executionId?: string | null;
  error?: string | null;
};

async function viaClaudeMcp(lead: string): Promise<QualifyLeadResponse> {
  const client = new Anthropic({ timeout: 120_000 });
  const workflowId = env("N8N_WORKFLOW_ID");

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content:
        (workflowId ? `Workflow ID: ${workflowId}\n\n` : "") +
        `Lead text:\n"""\n${lead}\n"""`,
    },
  ];

  const toolCalls: Anthropic.Beta.BetaMCPToolUseBlock[] = [];
  let response: Anthropic.Beta.BetaMessage | undefined;

  // Server-side tool loops may pause; resume a few times at most.
  for (let turn = 0; turn < 4; turn++) {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["mcp-client-2025-11-20", "server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      mcp_servers: [
        {
          type: "url",
          name: "n8n",
          url: env("N8N_MCP_URL")!,
          authorization_token: env("N8N_MCP_TOKEN") ?? null,
        },
      ],
      tools: [{ type: "mcp_toolset", mcp_server_name: "n8n" }],
      messages,
    });

    for (const block of response.content) {
      if (block.type === "mcp_tool_use") toolCalls.push(block);
    }
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  if (!response) throw new Error("No response from Claude.");
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request.");
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Claude did not return a result.");

  let report: ClaudeReport;
  try {
    report = JSON.parse(json) as ClaudeReport;
  } catch {
    throw new Error("Claude returned an unreadable result.");
  }

  // Only treat the result as real if Claude actually called an n8n execute tool.
  const executedViaMcp = toolCalls.some((c) => /execut|run/i.test(c.name));
  if (!report.executed || !executedViaMcp) {
    throw new Error(
      `n8n workflow was not executed via MCP${report.error ? `: ${report.error}` : "."}`,
    );
  }

  return {
    mode: "claude-mcp",
    result: normalize(report),
    executionId: report.executionId ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Mode 2: direct n8n webhook

async function viaWebhook(lead: string): Promise<LeadResult> {
  const res = await fetch(env("N8N_LEADPILOT_WEBHOOK_URL")!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`n8n webhook responded with HTTP ${res.status}.`);
  }
  return normalize(await res.json());
}

// n8n may return a single object or an array of items.
function normalize(data: unknown): LeadResult {
  const item = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = item?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const result = {
    category: pick("category", "Category"),
    priority: pick("priority", "Priority"),
    summary: pick("summary", "Summary"),
    nextAction: pick("nextAction", "next_action", "recommendedNextAction"),
  };
  if (!result.category || !result.priority) {
    throw new Error(
      "n8n output is missing category/priority. Check the workflow's final node.",
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mode 3: demo heuristic (no Claude, no n8n)

function demoQualify(lead: string): LeadResult {
  const t = lead.toLowerCase();
  const isSales = /demo|pricing|price|quote|buy|purchase|trial|interested/.test(t);
  const isSupport = /bug|error|broken|not working|issue|help with|refund/.test(t);
  const size = Number(t.match(/(\d+)[\s-]*(person|people|employee|staff)/)?.[1]);

  const category = isSales ? "Sales" : isSupport ? "Support" : "Other";
  const priority =
    isSales && (size >= 10 || /next week|asap|urgent/.test(t))
      ? "High"
      : isSales || isSupport
        ? "Medium"
        : "Low";
  const nextAction = /demo/.test(t)
    ? "Schedule product demo."
    : isSales
      ? "Send pricing and follow up."
      : isSupport
        ? "Route to support team."
        : "Review manually.";

  const who = Number.isFinite(size) ? `${size}-person company` : "Prospect";
  const topic = /support/.test(t)
    ? "automating customer support"
    : /automat/.test(t)
      ? "workflow automation"
      : "your product";
  const summary =
    category === "Sales"
      ? `${who} interested in ${topic}.`
      : category === "Support"
        ? `${who} reporting a support issue.`
        : `${who} sent a general inquiry.`;

  return { category, priority, summary, nextAction };
}
