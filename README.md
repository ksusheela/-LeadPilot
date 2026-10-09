# LeadPilot

**Turn messy leads into actionable opportunities.**

Companies receive leads as messy free text: emails, contact forms, chat messages. Someone has to read each one and decide whether it's sales or support, how urgent it is, and what to do next. That's slow and inconsistent, and good leads go cold while they wait.

LeadPilot turns a raw lead into a clear decision in seconds. Paste the lead and get back:

| Field | Example |
| --- | --- |
| **Category** | Sales |
| **Priority** | High |
| **Summary** | 25-person company interested in automating customer support. |
| **Next action** | Schedule product demo. |

Built at the CPH Vibe Coders · n8n Build Night.

## How it works

```text
Lead → Claude → MCP → n8n → Result
```

- **Claude** orchestrates the request.
- **MCP** (Model Context Protocol) gives Claude a tool interface to n8n.
- **n8n** runs the "LeadPilot — Qualify Lead" workflow, which holds the business rules.

The key design choice is to keep AI orchestration separate from deterministic business automation. The qualification rules live in n8n, where the sales team can see and change them without touching code. Claude is told not to qualify the lead itself. Every field it reports must come from the n8n execution output.

## Automation modes

The app picks a mode from environment variables. The first match wins:

| Mode | Path | Needs |
| --- | --- | --- |
| `claude-mcp` | Web app → Claude → MCP → n8n | `ANTHROPIC_API_KEY`, `N8N_MCP_URL`, `N8N_MCP_TOKEN` (optional: `N8N_WORKFLOW_ID`) |
| `webhook` | Web app → n8n webhook | `N8N_LEADPILOT_WEBHOOK_URL` |
| `demo` | Local keyword heuristic, no external calls | Nothing |

The UI badge shows which mode is active. In demo mode it reads **Demo Mode · simulated**, and results come from a simple keyword match, not from Claude or n8n. In `claude-mcp` mode the result shows the n8n execution ID as proof the workflow really ran. A result counts as real only if Claude actually called an n8n execute tool.

## Getting started

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, click **Use example lead**, then **Qualify Lead**.

With no configuration the app runs in demo mode. To connect it to n8n, copy the example env file and fill in the values for the mode you want:

```bash
cp .env.example .env.local
```

- **Claude + MCP:** create an Anthropic API key. In n8n, enable the instance-level MCP server (Settings → MCP) and copy its URL and access token.
- **Webhook:** use the production webhook URL of your n8n workflow.

Restart `npm run dev` after changing `.env.local`. Never commit `.env.local`.

### n8n workflow contract

The workflow receives the lead as JSON:

```json
{ "lead": "Hi, we're a 25-person Copenhagen startup..." }
```

Its final node must return an object (or an array whose first item is an object) with these fields:

```json
{
  "category": "Sales",
  "priority": "High",
  "summary": "Startup interested in automating customer support",
  "nextAction": "Schedule product demo"
}
```

`next_action` and `recommendedNextAction` are also accepted. `category` and `priority` are required.

## API

`GET /api/qualify` returns the active mode:

```json
{ "mode": "demo" }
```

`POST /api/qualify` qualifies a lead:

```bash
curl -X POST http://localhost:3000/api/qualify \
  -H "Content-Type: application/json" \
  -d '{"lead":"We are a 25-person startup looking to automate customer support. Can we get a demo next week?"}'
```

```json
{
  "mode": "demo",
  "result": {
    "category": "Sales",
    "priority": "High",
    "summary": "25-person company interested in automating customer support.",
    "nextAction": "Schedule product demo."
  }
}
```

In `claude-mcp` mode the response also includes `executionId`. Errors return `400` for an empty lead and `502` when the automation fails, with an `error` message.

## Project structure

```text
app/
  page.tsx              Page shell
  lead-pilot.tsx        Lead form, progress stages and result card
  api/qualify/route.ts  GET (mode) and POST (qualify) endpoints
lib/
  automation.ts         The three automation modes and result normalization
.env.example            Environment variable template
```

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · TypeScript · Anthropic SDK (Messages API MCP connector) · n8n

## Roadmap

- Automatically create the CRM follow-up for qualified leads.
- Notify sales in Slack for high-priority leads.
