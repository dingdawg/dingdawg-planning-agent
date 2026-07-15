#!/usr/bin/env node
/**
 * dingdawg-planning-agent v2 — Thin Client MCP Server
 *
 * FREE tier: basic local effort estimation + risk scoring (the hook)
 * PAID tier: LLM-powered deep project planning via DingDawg API
 *
 * Install: npx dingdawg-planning-agent
 * Claude Code: claude mcp add dingdawg-planning-agent npx dingdawg-planning-agent
 *
 * Set DINGDAWG_API_KEY for paid features:
 *   export DINGDAWG_API_KEY=your_key
 *
 * Optional: DINGDAWG_MODEL to choose the analysis model (default: gpt-4o-mini)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_ENDPOINT = "https://api.dingdawg.com/v1/govern/execute";
const API_KEY = process.env.DINGDAWG_API_KEY || "";
const MODEL = process.env.DINGDAWG_MODEL || "gpt-4o-mini";

// ---------------------------------------------------------------------------
// Persistent rate limiting
// ---------------------------------------------------------------------------

const FREE_TIER_LIMIT = 100;
const RATE_FILE = path.join(os.homedir(), ".dingdawg", "usage.json");

const MACHINE_ID = crypto.createHash("sha256")
  .update(`${os.hostname()}-${os.userInfo().username}-${os.platform()}-${os.arch()}`)
  .digest("hex").slice(0, 16);

function checkFreeRateLimit(tool: string): { allowed: boolean; remaining: number } {
  const key = `${MACHINE_ID}_planning_${tool}`;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let store: Record<string, { count: number; resetAt: number }> = {};
  try {
    const dir = path.dirname(RATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(RATE_FILE)) {
      store = JSON.parse(fs.readFileSync(RATE_FILE, "utf-8"));
    }
  } catch { /* fresh start */ }

  const entry = store[key];
  if (!entry || now > entry.resetAt) {
    store[key] = { count: 1, resetAt: now + dayMs };
  } else if (entry.count >= FREE_TIER_LIMIT) {
    try { fs.writeFileSync(RATE_FILE, JSON.stringify(store)); } catch {}
    return { allowed: false, remaining: 0 };
  } else {
    store[key].count++;
  }

  try { fs.writeFileSync(RATE_FILE, JSON.stringify(store)); } catch {}

  const current = store[key].count;
  return { allowed: true, remaining: FREE_TIER_LIMIT - current };
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

interface ApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

async function callApi(
  tool: string,
  input: Record<string, unknown>,
): Promise<ApiResponse> {
  if (!API_KEY) {
    return { success: false, error: "no_api_key" };
  }

  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agent: "planning",
        tool,
        input,
        model: MODEL,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `API returned ${res.status}: ${body}` };
    }

    const data = await res.json() as Record<string, unknown>;
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `API request failed: ${message}` };
  }
}

function upgradeMessage(): string {
  return [
    "",
    "━━━ Upgrade to DingDawg Pro ━━━",
    "Get LLM-powered project planning, AI decision matrices,",
    "risk mitigation strategies, and intelligent retrospectives.",
    "",
    "  export DINGDAWG_API_KEY=your_key",
    "",
    "Get your key at: https://dingdawg.com/developers",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "dingdawg-planning-agent",
  version: "2.0.0",
});

// ---------------------------------------------------------------------------
// plan_project — PAID (calls API, free shows teaser)
// ---------------------------------------------------------------------------

server.tool(
  "plan_project",
  "Generate a structured project plan with phases, milestones, dependencies, and resource allocation. " +
  "Requires DINGDAWG_API_KEY for LLM-powered planning.",
  {
    project_description: z.string().min(10).describe("Describe the project to plan"),
    team_size: z.number().optional().describe("Team size"),
    deadline: z.string().optional().describe("Target deadline (YYYY-MM-DD)"),
    methodology: z.enum(["agile", "waterfall", "hybrid"]).optional().describe("Project methodology"),
  },
  async ({ project_description, team_size, deadline, methodology }) => {
    const apiResult = await callApi("plan_project", {
      project_description, team_size: team_size || 1,
      deadline: deadline || "", methodology: methodology || "agile",
    });

    if (apiResult.success && apiResult.data) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: true,
          powered_by: "DingDawg Planning API",
          ...apiResult.data,
          receipt_id: `plan_${Date.now().toString(36)}`,
          governed: true,
        }, null, 2) }],
      };
    }

    if (!API_KEY) {
      const wordCount = project_description.split(/\s+/).length;
      const estimatedWeeks = Math.max(2, Math.ceil(wordCount / 10));
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: false,
          requires_api_key: true,
          message: "Full project planning requires LLM-powered analysis via our API.",
          preview: {
            project_complexity: wordCount > 50 ? "HIGH" : wordCount > 20 ? "MEDIUM" : "LOW",
            rough_timeline: `~${estimatedWeeks} weeks (rough estimate)`,
            methodology: methodology || "agile",
            team_size: team_size || "not specified",
          },
          what_you_get: [
            "Phased plan with milestones and dependencies",
            "Task breakdown with effort estimates",
            "Risk register and mitigation strategies",
            "Resource allocation recommendations",
          ],
          setup: [
            "1. Get your API key at https://dingdawg.com/developers",
            "2. export DINGDAWG_API_KEY=your_key",
            "3. Run plan_project again",
          ],
          free_alternative: "Use estimate_effort for free basic effort estimation (no API key needed).",
          governed: true,
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: false, error: apiResult.error,
        suggestion: "Check your API key. Contact support@dingdawg.com if the issue persists.",
        governed: true,
      }, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// estimate_effort — FREE local estimation + API upgrade
// ---------------------------------------------------------------------------

server.tool(
  "estimate_effort",
  "Free AI effort estimation with complexity scoring and PERT ranges. " +
  "Deep LLM-powered subtask breakdown and confidence analysis with API key.",
  {
    task: z.string().min(5).describe("Task or feature to estimate"),
    context: z.string().optional().describe("Project context, tech stack, constraints"),
    team_experience: z.enum(["junior", "mid", "senior", "mixed"]).optional().describe("Team experience level"),
  },
  async ({ task, context, team_experience }) => {
    const rateCheck = checkFreeRateLimit("estimate_effort");
    if (!rateCheck.allowed) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          error: "Free tier limit reached (100/day). Resets automatically.",
          upgrade: "Get unlimited: export DINGDAWG_API_KEY=your_key — https://dingdawg.com/developers",
          governed: true,
        }) }],
      };
    }

    if (API_KEY) {
      const apiResult = await callApi("estimate_effort", {
        task, context: context || "", team_experience: team_experience || "mid",
      });
      if (apiResult.success && apiResult.data) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            mode: "deep_analysis",
            powered_by: "DingDawg Planning API",
            ...apiResult.data,
            receipt_id: `est_${Date.now().toString(36)}`,
            governed: true,
          }, null, 2) }],
        };
      }
    }

    const taskLower = task.toLowerCase();
    const complexityIndicators = [
      "integration", "migration", "security", "authentication", "real-time",
      "distributed", "scale", "performance", "refactor", "legacy",
    ];
    const simpleIndicators = [
      "button", "page", "style", "color", "text", "label", "rename", "typo",
    ];

    const complexHits = complexityIndicators.filter(k => taskLower.includes(k)).length;
    const simpleHits = simpleIndicators.filter(k => taskLower.includes(k)).length;

    const experienceMultiplier = team_experience === "junior" ? 1.8 :
      team_experience === "senior" ? 0.7 : team_experience === "mixed" ? 1.2 : 1.0;

    let baseHours = 8;
    if (complexHits >= 2) baseHours = 40;
    else if (complexHits === 1) baseHours = 24;
    else if (simpleHits >= 1) baseHours = 4;

    const adjustedHours = Math.round(baseHours * experienceMultiplier);
    const optimistic = Math.round(adjustedHours * 0.6);
    const pessimistic = Math.round(adjustedHours * 2.2);
    const expected = Math.round((optimistic + 4 * adjustedHours + pessimistic) / 6);

    const complexity = complexHits >= 2 ? "HIGH" : complexHits === 1 ? "MEDIUM" : "LOW";

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        mode: "local_basic",
        complexity,
        estimate_hours: adjustedHours,
        pert: { optimistic, expected, pessimistic },
        confidence: complexity === "HIGH" ? "LOW — complex task, deep analysis recommended" :
          complexity === "MEDIUM" ? "MEDIUM — some complexity detected" : "HIGH — straightforward task",
        team_experience: team_experience || "mid (default)",
        teaser: "Get detailed subtask breakdown, dependency analysis, and AI confidence scoring: export DINGDAWG_API_KEY=your_key",
        upgrade_url: "https://dingdawg.com/developers",
        receipt_id: `est_${Date.now().toString(36)}`,
        free_checks_remaining: rateCheck.remaining,
        governed: true,
      }, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// risk_analyze — FREE local basic + API deep
// ---------------------------------------------------------------------------

server.tool(
  "risk_analyze",
  "Free AI project risk analysis with risk matrix scoring. " +
  "Deep LLM-powered mitigation strategies and contingency plans with API key.",
  {
    project_description: z.string().min(10).describe("Project or initiative to analyze for risks"),
    known_risks: z.string().optional().describe("Known risks or concerns"),
  },
  async ({ project_description, known_risks }) => {
    const rateCheck = checkFreeRateLimit("risk_analyze");
    if (!rateCheck.allowed) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          error: "Free tier limit reached (100/day).",
          upgrade: "Get unlimited: export DINGDAWG_API_KEY=your_key — https://dingdawg.com/developers",
          governed: true,
        }) }],
      };
    }

    if (API_KEY) {
      const apiResult = await callApi("risk_analyze", {
        project_description, known_risks: known_risks || "",
      });
      if (apiResult.success && apiResult.data) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            mode: "deep_analysis",
            powered_by: "DingDawg Planning API",
            ...apiResult.data,
            receipt_id: `risk_${Date.now().toString(36)}`,
            governed: true,
          }, null, 2) }],
        };
      }
    }

    const desc = project_description.toLowerCase();
    const risks: string[] = [];

    const riskPatterns: Array<{ keyword: string; risk: string; severity: string }> = [
      { keyword: "deadline", risk: "Schedule pressure — risk of scope creep", severity: "HIGH" },
      { keyword: "new technology", risk: "Technology risk — unfamiliar stack", severity: "HIGH" },
      { keyword: "integration", risk: "Integration risk — third-party dependencies", severity: "MEDIUM" },
      { keyword: "migration", risk: "Data migration risk — potential data loss", severity: "HIGH" },
      { keyword: "team", risk: "Resource risk — team coordination overhead", severity: "MEDIUM" },
      { keyword: "security", risk: "Security risk — requires audit and compliance", severity: "HIGH" },
      { keyword: "scale", risk: "Scalability risk — performance under load", severity: "MEDIUM" },
      { keyword: "legacy", risk: "Legacy system risk — technical debt", severity: "MEDIUM" },
      { keyword: "regulation", risk: "Compliance risk — regulatory requirements", severity: "HIGH" },
      { keyword: "budget", risk: "Budget risk — cost overruns possible", severity: "MEDIUM" },
    ];

    for (const { keyword, risk, severity } of riskPatterns) {
      if (desc.includes(keyword)) {
        risks.push(`${severity}: ${risk}`);
      }
    }

    if (known_risks) {
      risks.push(`USER-IDENTIFIED: ${known_risks}`);
    }

    const highCount = risks.filter(r => r.startsWith("HIGH")).length;
    const riskLevel = highCount >= 2 ? "HIGH" : highCount === 1 ? "MEDIUM" : "LOW";

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        mode: "local_basic",
        overall_risk: riskLevel,
        risks_identified: risks.length,
        top_risks: risks.slice(0, 5),
        teaser: risks.length > 0
          ? `Found ${risks.length} risk(s). Get mitigation strategies and contingency plans: export DINGDAWG_API_KEY=your_key`
          : "Get comprehensive risk analysis with Monte Carlo simulation: export DINGDAWG_API_KEY=your_key",
        upgrade_url: "https://dingdawg.com/developers",
        receipt_id: `risk_${Date.now().toString(36)}`,
        free_checks_remaining: rateCheck.remaining,
        governed: true,
      }, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// decision_matrix — PAID
// ---------------------------------------------------------------------------

server.tool(
  "decision_matrix",
  "AI-powered structured decision making with weighted scoring, bias detection, and assumption tracking. " +
  "Requires DINGDAWG_API_KEY.",
  {
    decision: z.string().describe("Decision to evaluate"),
    options: z.string().describe("Options to compare (comma-separated or described)"),
    criteria: z.string().optional().describe("Evaluation criteria (comma-separated)"),
  },
  async ({ decision, options, criteria }) => {
    const apiResult = await callApi("decision_matrix", {
      decision, options, criteria: criteria || "",
    });

    if (apiResult.success && apiResult.data) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: true, ...apiResult.data, governed: true,
        }, null, 2) }],
      };
    }

    if (!API_KEY) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: false,
          requires_api_key: true,
          message: "Decision matrix analysis requires LLM-powered reasoning via our API.",
          what_you_get: [
            "Weighted scoring matrix across all criteria",
            "Cognitive bias detection",
            "Assumption tracking and validation",
            "Sensitivity analysis",
          ],
          setup: [
            "1. Get your API key at https://dingdawg.com/developers",
            "2. export DINGDAWG_API_KEY=your_key",
            "3. Run decision_matrix again",
          ],
          free_alternative: "Use estimate_effort or risk_analyze for free (no API key needed).",
          governed: true,
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: false, error: apiResult.error,
        suggestion: "Check your API key. Contact support@dingdawg.com if the issue persists.",
        governed: true,
      }, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// retrospective — PAID
// ---------------------------------------------------------------------------

server.tool(
  "retrospective",
  "AI project retrospective — what went well, what didn't, action items, pattern identification. " +
  "Requires DINGDAWG_API_KEY.",
  {
    project: z.string().describe("Project name or description"),
    went_well: z.string().optional().describe("What went well"),
    went_poorly: z.string().optional().describe("What went poorly"),
    team_feedback: z.string().optional().describe("Team feedback or notes"),
  },
  async ({ project, went_well, went_poorly, team_feedback }) => {
    const apiResult = await callApi("retrospective", {
      project, went_well: went_well || "", went_poorly: went_poorly || "",
      team_feedback: team_feedback || "",
    });

    if (apiResult.success && apiResult.data) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: true, ...apiResult.data, governed: true,
        }, null, 2) }],
      };
    }

    if (!API_KEY) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: false,
          requires_api_key: true,
          message: "AI retrospectives require LLM-powered pattern analysis via our API.",
          setup: [
            "1. Get your API key at https://dingdawg.com/developers",
            "2. export DINGDAWG_API_KEY=your_key",
            "3. Run retrospective again",
          ],
          free_alternative: "Use estimate_effort or risk_analyze for free (no API key needed).",
          governed: true,
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: false, error: apiResult.error,
        suggestion: "Check your API key. Contact support@dingdawg.com if the issue persists.",
        governed: true,
      }, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// standup_summary — PAID
// ---------------------------------------------------------------------------

server.tool(
  "standup_summary",
  "AI standup summary from team updates — blocker detection, dependency alerts, velocity tracking. " +
  "Requires DINGDAWG_API_KEY.",
  {
    updates: z.string().describe("Team standup updates (paste all updates)"),
    sprint_goal: z.string().optional().describe("Current sprint goal"),
  },
  async ({ updates, sprint_goal }) => {
    const apiResult = await callApi("standup_summary", {
      updates, sprint_goal: sprint_goal || "",
    });

    if (apiResult.success && apiResult.data) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: true, ...apiResult.data, governed: true,
        }, null, 2) }],
      };
    }

    if (!API_KEY) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          success: false,
          requires_api_key: true,
          message: "Standup summaries require LLM-powered analysis via our API.",
          setup: [
            "1. Get your API key at https://dingdawg.com/developers",
            "2. export DINGDAWG_API_KEY=your_key",
            "3. Run standup_summary again",
          ],
          free_alternative: "Use estimate_effort or risk_analyze for free (no API key needed).",
          governed: true,
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: false, error: apiResult.error,
        suggestion: "Check your API key. Contact support@dingdawg.com if the issue persists.",
        governed: true,
      }, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => { console.error("Server failed:", err); process.exit(1); });
