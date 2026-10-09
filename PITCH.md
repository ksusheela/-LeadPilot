# LeadPilot — 2-Minute Pitch

**CPH Vibe Coders · n8n Build Night**
*Turn messy leads into actionable opportunities.*

---

## 0:00–0:20 · The problem

> Every company gets leads as messy free text: emails, contact forms, chat messages.
> Someone has to read each one and decide: is this sales or support? Is it urgent? What do we do next?
> That's slow, inconsistent, and good leads go cold while they wait.

## 0:20–0:45 · The idea

> LeadPilot turns a raw lead into a clear decision in seconds.
> You paste the lead, and you get back four things:
> **Category, Priority, a one-line Summary, and the Recommended Next Action.**

## 0:45–1:25 · Live demo

**On screen:** http://localhost:3000

1. Click **"Use example lead"**:
   *"Hi, we're a 25-person Copenhagen startup. We're looking for workflow automation for our customer support team and would like a demo next week."*
2. Click **Qualify Lead** and point at the stages:
   **Understanding lead → Calling automation → Processing in n8n → Complete**
3. Read the result:
   - **Category:** Sales
   - **Priority:** High
   - **Summary:** Startup interested in automating customer support
   - **Next action:** Schedule product demo

> Say while it runs: *"Right now Claude is calling our n8n workflow through MCP."*

**Honesty line, depending on the badge:**
- 🟢 **Live:** *"That n8n execution ID at the bottom shows it really ran in n8n."*
- 🟡 **Demo Mode:** *"Tonight this is running in demo mode. The live Claude → MCP → n8n path is built and switches on with one config file."*

## 1:25–1:50 · How it works

```
Lead → Claude → MCP → n8n → Result
```

> **Claude reasons about the request. MCP provides the tool interface. n8n executes the business workflow.**
> The key design choice: we keep AI reasoning separate from deterministic business automation.
> The business rules live in n8n, where the sales team can see and change them without touching code.

## 1:50–2:00 · Close

> We built this in one hour: an n8n workflow, MCP integration, and a Next.js app.
> Next steps: auto-create the CRM follow-up and notify sales in Slack for high-priority leads.
> **LeadPilot: turn messy leads into actionable opportunities.** Thank you!

---

### Before you go on stage
- [ ] App open at http://localhost:3000 (`npm run dev` running)
- [ ] Check the badge: **green = live**, **amber = demo**. Use the matching honesty line
- [ ] If live, do one rehearsal run (a live run takes about 10–30 s, so fill the wait with the "Claude is calling n8n" line)
- [ ] Browser zoom at 125–150% so the audience can read it
