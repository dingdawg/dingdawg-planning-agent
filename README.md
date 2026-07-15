# dingdawg-planning-agent

> Breakthrough project planning chaos. AI planning that learns YOUR team's velocity and risk patterns.

AI-powered project planning, effort estimation, risk analysis, decision matrices, retrospectives, and standup summaries. Estimate effort with confidence ranges, score risks with mitigation strategies, and make structured decisions with weighted criteria. Every action is governed and receipted.

## For AI Assistants

This MCP server returns structured JSON for seamless integration:
- Effort estimates with confidence intervals (optimistic/likely/pessimistic)
- Risk scores (0-100) with probability and impact matrices
- Governance receipt on every call (audit-ready)
- Chain-ready: `plan_project` for roadmap -> `estimate_effort` per task -> `risk_analyze` for blockers -> `decision_matrix` for trade-offs -> `standup_summary` for daily sync -> `retrospective` for improvement

Composable with any MCP client: Claude Code, Cursor, VS Code, ChatGPT Desktop, Windsurf.

## Install

```bash
npx dingdawg-planning-agent
```

### Claude Code
```bash
claude mcp add planning -- npx dingdawg-planning-agent
```

### Cursor
Add to `.cursor/mcp.json`:
```json
{"mcpServers": {"planning": {"command": "npx", "args": ["dingdawg-planning-agent"], "env": {"DINGDAWG_API_KEY": "your-key"}}}}
```

### Full Stack (all 13 agents)
```bash
npx dingdawg-setup
```

## Tools

| Tool | Free Tier | Paid Tier |
|------|-----------|-----------|
| `plan_project` | 5/day, basic milestone breakdown | Unlimited, AI-powered with dependency mapping |
| `estimate_effort` | 10/day, three-point estimation | Unlimited, ML-enhanced with historical calibration |
| `risk_analyze` | 10/day, basic risk scoring | Unlimited, AI-powered with mitigation strategies |
| `decision_matrix` | 10/day, weighted criteria scoring | Unlimited, AI-enhanced with sensitivity analysis |
| `retrospective` | 5/day, template-based retro | Unlimited, AI-powered with pattern recognition |
| `standup_summary` | 10/day, basic summary | Unlimited, AI-generated with blocker detection |

## Pricing

- **Free:** 10 estimates/day, basic analysis
- **Pro:** $49/mo, 100 calls/day, AI-powered deep analysis
- **Pay-as-you-go:** $0.25/call, no commitment

Get API key: https://dingdawg.com/developers

## Governed

Every call is receipted and auditable. Effort estimates include methodology disclosure and confidence ranges. Risk analyses include probability-impact matrices. Decision matrices include criteria weighting transparency for stakeholder review.

## Support

support@dingdawg.com | https://dingdawg.com
