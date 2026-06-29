---
name: sales-opp-management
description: Sales Opportunities Management platform — architecture, data format, and key conventions
type: project
originSessionId: d19071a4-3274-4fa1-a471-871f03ed2fda
---
Single-page sales opportunity tracker. Bare Node.js server (`server.js`, port 3000, zero npm deps) + single `index.html` (all CSS/JS inline). File-based Markdown storage under numbered directories.

**Directory convention (strict):**
- `00-Clients/Client-<Name>/Client.md` — client profile + contacts table
- `01-Opportunities/OPP-<###>-<Client>-<Name>/` — each opp has `Opportunity.md`, `FAQ.md`, `Meetings/`
- `02-WeeklyReports/` — auto-generated cross-opp weekly reports (section-based MD, not tables). Single shared folder. NOT per-opportunity.
- `03-Archive/<Won|Lost>/<year>/<client>/` — moved here when stage becomes Won/Lost

**Opportunity.md fields:** Budget, Need (AI Tokens|Cloud), Timeline, Stage (Discovery→Proposal→Negotiation→Verbal Commit→Won|Lost), Product, Next Action, Stakeholders table, Notes

**Meeting MD fields:** Date, Title, Attendees, Venue, Agenda list, Requirements (text — [status] — Due date), Questions (Q:/A:), Risks (risk: mitigation), Action Items (— owner — text — Due date — [status])

**Key business rules:**
- Stale = no activity in 20+ days (meetings, action item due dates, requirement due dates, updated field)
- Delayed action = `status==='Delayed'` OR `(status==='Open' && due < today)`. Gap/Open with future due date is NOT delayed
- Stage probabilities: Discovery=10%, Proposal=30%, Negotiation=60%, Verbal Commit=85%
- Stage cycling in detail panel: Discovery→Proposal→Negotiation→Verbal Commit→Discovery (loops)

**Frontend architecture:** Single `index.html`, all JS in `<script>` tag. Views: dashboard, clients, opportunities, pipeline, requirement, activity, resources, archive. Dashboard has: alert strip, client filter chips, stale warnings, KPI cards, client overview table, next action timeline, action items & issues, 3-col grid (pipeline bars, risk radar SVG, alert donut), closing urgency, health cards with expandable details. Detail panel slides in from right, supports fullscreen toggle. Theme: light default, dark toggle via localStorage.

**API routes (server.js):** GET /api/summary (full dashboard payload), GET/POST/PUT /api/opportunities, GET/POST/PUT /api/clients, POST /api/opportunities/:id/meetings, PUT /api/opportunities/:id/meetings/:filename, PUT /api/opportunities/:id/faq, POST /api/weekly-reports, GET /api/weekly-reports, GET /api/resources, GET /api/archive

**Skills in project directory:**
- `sales-opp-management/SKILL.md` — natural language → API mapping, for CRM operations
- `weekly-report-polish/SKILL.md` — raw weekly report → meeting-ready polished report, with AI Token funnel overview + Cloud resell coverage table + closure tracking. Output all Chinese except client/product/opportunity names.

**Win/Lose Rate pitfall:** Archived opps (Won/Lost) are not in the active `opportunities` array. Win Rate / Lose Rate must merge `archive.won/lost` counts. When filtering by client, also filter archive lists by client — otherwise Win Rate shows 0 after filtering. Frontend code: `fWon = activeWon + filteredArchiveWon.length`, `fLost = activeLost + filteredArchiveLost.length`.

**Probability auto-calculation:** Opportunity.md template has no `Probability` field. Server auto-infers from Stage (Discovery=10%, Proposal=30%, Negotiation=60%, Verbal Commit=85%). Manual `**Probability:**` in MD takes priority. Without this, Closing Urgency shows 0% for all opps.

**Why file-based Markdown:** Stakeholders wanted human-readable, git-diffable files they could also edit outside the app. No database, no migration, no npm install needed.

**How to apply:** When modifying, know that `server.js` parses MD with regex — format changes there require updating both parser and generator. `index.html` is monolithic — find functions by name (`renderDashboard`, `openOppDetail`, `openMeetingDetail`, etc.).

**Contacts → Stakeholders sync:** When creating an opportunity, server auto-populates stakeholders from the client's contacts (Influence=Medium, Attitude=Neutral). Existing opps can sync via `POST /api/opportunities/:id/sync-contacts`. The sync logic appends new contacts not already in stakeholders and removes pure TBD placeholder rows. Without this, all stakeholders show TBD.

**Probability auto-calc:** Opportunity.md template has no Probability field. Server auto-infers from Stage (Discovery=10%, Proposal=30%, Negotiation=60%, Verbal Commit=85%). Manual value takes priority. Without this, Closing Urgency shows 0% for all opps.

**Resource/Meeting Markdown rendering:** Resources page and meeting detail panels use `md2html()` to render Markdown as formatted HTML (headings, bold, tables, lists, code). Without this, raw `#`, `**`, `|---|` symbols clutter the view.

**Stakeholder Influence/Attitude cycling:** Stakeholders table has clickable Influence badges (High→Medium→Low→High) and Attitude badges (Champion→Supporter→Neutral→Skeptic→Champion). Click to cycle, saves immediately.
