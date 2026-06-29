---
name: sales-opp-management
description: "Sales opportunity tracker with file-based Markdown storage. Manage clients, opportunities, meetings, weekly reports, risks, requirements and action items through natural language. Start server, create/edit/close deals, generate reports, review pipeline health. Data stored as human-readable MD files — no database needed."
---

# Sales Opportunity Management

A self-contained sales CRM that runs on two files (`server.js` + `index.html`) with zero dependencies. All data lives in Markdown files on disk — human-readable, git-diffable, editable outside the app.

## When to Apply

Use this skill when the user asks to **manage sales opportunities, clients, meetings, pipeline, or reports** — including but not limited to:

### Must Use

- Starting or checking the sales management server
- Creating, updating, or closing (won/lost) an opportunity
- Adding or editing a client and their contacts
- Recording a meeting with agenda, requirements, risks, action items, questions
- Generating a weekly report
- Checking pipeline health, stale deals, overdue items, risk gaps
- Filtering or reviewing deals by client, stage, or product

### Recommended

- Bulk data entry from emails, notes, or voice memos
- Reviewing what needs attention this week
- Preparing for a client meeting by reviewing all context
- Updating multiple action items or requirements at once

### Skip

- Non-sales topics (general coding, design, infrastructure)
- Questions about how to code the tool itself (use the MANUAL.md for that)

## Setup

Before any operation, the server must be running. Check and start it automatically:

```
If the user asks to do anything with sales data:
1. Run: curl -s http://localhost:3000/api/summary > /dev/null 2>&1
2. If it fails, cd to the project directory and run: node server.js &
3. Wait 2 seconds, verify with: curl -s http://localhost:3000/api/summary | head -c 20
4. If still failing, report the error to the user
```

The project directory is wherever `server.js` and `index.html` live. If unsure, ask the user.

## API Quick Reference

All API calls go to `http://localhost:3000`. Use `curl` with JSON bodies.

| Action | Method | Endpoint | Body / Params |
|--------|--------|----------|---------------|
| Full dashboard data | GET | `/api/summary` | — |
| List opportunities | GET | `/api/opportunities` | `?stage=Discovery` optional |
| Create opportunity | POST | `/api/opportunities` | `{client, name}` |
| Update opportunity | PUT | `/api/opportunities/:id` | `{field: value}` — see fields below |
| List clients | GET | `/api/clients` | — |
| Create client | POST | `/api/clients` | `{name}` |
| Update client | PUT | `/api/clients/:name` | `{field: value}` |
| Add meeting | POST | `/api/opportunities/:id/meetings` | `{title, date, attendees, venue}` |
| Update meeting | PUT | `/api/opportunities/:id/meetings/:filename` | `{field: value}` |
| Update FAQ | PUT | `/api/opportunities/:id/faq` | `{faq: [...]}` |
| Generate weekly report | POST | `/api/weekly-reports` | `{startDate, endDate}` |
| List weekly reports | GET | `/api/weekly-reports` | — |
| List archive | GET | `/api/archive` | — |
| List resources | GET | `/api/resources` | — |

### Opportunity updatable fields

`budget`, `need` (AI Tokens | Cloud), `targetClose` (e.g. 2026-Q3), `product`, `nextAction`, `notes`, `stakeholders` (array), `stage` (Discovery | Proposal | Negotiation | Verbal Commit — or Won/Lost to archive)

### Meeting updatable fields

`title`, `date`, `attendees`, `venue` (Online | Physical), `agenda` (array of strings), `requirements` (array of `{text, status, due}`), `questions` (array of `{question, answer}`), `risks` (array of `{risk, mitigation}`), `actionItems` (array of `{text, owner, due, status}`)

## Natural Language Mappings

Translate the user's request into the right API call(s). Here are common patterns:

### Client Management

| User says | Action |
|-----------|--------|
| "Add a client called Acme Corp, they're in fintech" | `POST /api/clients {name: "Acme Corp", industry: "Fintech"}` |
| "Update Acme's industry to Banking" | `PUT /api/clients/Client-AcmeCorp {industry: "Banking"}` |
| "Add contact John (CTO, john@acme.com) to Acme" | GET client → update `contacts` array → PUT |
| "Show me all clients" | `GET /api/clients` → format as list |
| "What do we know about Acme?" | `GET /api/clients` → filter + show details |

### Opportunity Management

| User says | Action |
|-----------|--------|
| "Create a deal for Acme, cloud migration" | Verify client exists → `POST /api/opportunities {client: "Acme Corp", name: "Cloud Migration"}` |
| "Update Acme's budget to $500K" | Find opp → `PUT /api/opportunities/:id {budget: "$500K"}` |
| "Move Acme to Proposal stage" | `PUT /api/opportunities/:id {stage: "Proposal"}` |
| "Mark Acme deal as Won" | `PUT /api/opportunities/:id {stage: "Won"}` (auto-archives) |
| "Mark Acme deal as Lost" | `PUT /api/opportunities/:id {stage: "Lost"}` (auto-archives) |
| "Set next action: send proposal by 2026-07-15" | `PUT /api/opportunities/:id {nextAction: "Send proposal by 2026-07-15"}` |
| "Show my pipeline" | `GET /api/summary` → format pipeline overview |
| "Which deals are stale?" | `GET /api/summary` → filter stale opps |
| "What's the total pipeline value?" | `GET /api/summary` → show totalPipelineValue + weightedPipelineValue |

### Meeting Notes

| User says | Action |
|-----------|--------|
| "I had a meeting with Acme today about POC, attendees: John, Sam" | Find opp → `POST /api/opportunities/:id/meetings {title: "POC Discussion", date: today, attendees: "John, Sam", venue: "Online"}` |
| "Add agenda item 'Discuss pricing' to the meeting" | Find meeting → update `agenda` array → PUT |
| "Add requirement: data residency in Singapore, status Gap, due 2026-07-01" | Find meeting → update `requirements` array → PUT |
| "Add risk: competitor offering lower price, mitigation: highlight our SLA" | Find meeting → update `risks` array → PUT |
| "Add action: Sam to prepare POC env by 2026-07-10, status Open" | Find meeting → update `actionItems` array → PUT |
| "Add question: What's the timeline for procurement? answer: open" | Find meeting → update `questions` array → PUT |
| "Mark the 'Send pricing deck' action as Completed" | Find action → update status → PUT |
| "Change requirement 'HIPAA compliance' to Confirmed" | Find requirement → update status → PUT |

### Reports & Review

| User says | Action |
|-----------|--------|
| "Generate this week's report" | Calculate date range (Mon-Sun of current week) → `POST /api/weekly-reports` |
| "Generate report for June" | `POST /api/weekly-reports {startDate: "2026-06-01", endDate: "2026-06-30"}` |
| "Show the latest weekly report" | `GET /api/weekly-reports` → read the latest file |
| "What needs my attention?" | `GET /api/summary` → extract stale + overdue reqs + delayed actions + unmitigated risks |
| "What are the overdue action items?" | Parse all opps → filter actions where `status==='Open' && due < today` or `status==='Delayed'` |
| "Show all open questions across deals" | Parse all opps → filter questions where `answer==='' or '(open)'` |
| "What's the risk level for each deal?" | `GET /api/summary` → show per-opp risk metrics |

### Bulk Operations

| User says | Action |
|-----------|--------|
| "Add these 3 contacts to Acme: ..." | GET client → append all to `contacts` array → single PUT |
| "Update all open actions for Acme to In Progress" | Find all actions for that client's opps → update each → PUT per meeting |
| "I just got out of a meeting with Acme — here are my notes: ..." | Parse the free-text notes → extract agenda, requirements, risks, actions, questions → create meeting + populate all sections |

## Meeting Notes Parsing

When a user provides informal meeting notes, extract structured data:

1. **Agenda** — topics discussed, goals of the meeting
2. **Requirements** — anything phrased as a need, must-have, or constraint. Default status `Open`, set `Gap` if clearly unmet, `Confirmed` if explicitly agreed
3. **Questions** — open questions from the meeting. If not answered, set answer to `(open)`
4. **Risks** — concerns, blockers, competitive threats. If no mitigation mentioned, set to `(no mitigation yet)`
5. **Action items** — tasks with owners. Default status `Open`. Extract due dates if mentioned

Example:
```
User: "Had a call with Acme's CTO John today. Discussed API integration, they need 99.99% uptime SLA.
Competitor XYZ is offering a lower price. Sam will prepare the integration guide by Friday.
John asked about data residency — we didn't have a clear answer."
```

Creates meeting with:
- Agenda: ["API integration requirements", "Uptime SLA discussion"]
- Requirements: [{text: "99.99% uptime SLA", status: "Open", due: ""}]
- Risks: [{risk: "Competitor XYZ offering lower price", mitigation: "(no mitigation yet)"}]
- Action items: [{text: "Prepare integration guide", owner: "Sam", due: "<this Friday's date>", status: "Open"}]
- Questions: [{question: "Data residency requirements?", answer: "(open)"}]

## Output Formatting

When presenting data to the user, use clear formatting:

- **Pipeline overview**: table with Client | Opportunity | Stage | Budget | Next Action
- **Deal details**: grouped sections (Overview, Stakeholders, Recent Meetings, Open Items, Risks)
- **Attention items**: categorized by urgency (Overdue → Due Soon → Upcoming)
- **Reports**: rendered as structured markdown matching the weekly report format

## Important Notes

- The `need` field uses exactly `AI Tokens` or `Cloud` — no other values
- Stage values are: `Discovery`, `Proposal`, `Negotiation`, `Verbal Commit`, `Won`, `Lost`
- Setting stage to `Won` or `Lost` moves the opportunity folder to the archive
- Client must exist before creating an opportunity for it
- Weekly reports are cross-opportunity — stored only in `02-WeeklyReports/`, not per-opportunity
- All data files are Markdown — the user can also edit them directly in any text editor
- The server re-reads files on every request, so manual edits take effect immediately
- Stale = no activity in 20+ days; Delayed action = `Delayed` status OR (`Open` with past due date)
