# Sales Opportunities Management — Manual

## Quick Start

```bash
# No install needed — uses only Node.js built-in modules
node server.js
# Open http://localhost:3000 in your browser
```

Requirements: Node.js 18+ (no npm packages).

---

## Architecture

| Layer | Technology | File |
|-------|-----------|------|
| Server | Bare Node.js `http` | `server.js` |
| Frontend | Single HTML, all CSS/JS inline | `index.html` |
| Database | Markdown files on disk | `00-Clients/`, `01-Opportunities/`, etc. |

No build step, no bundler, no package.json. Everything runs from two files.

---

## Directory Structure

```
├── server.js                        # API server (port 3000)
├── index.html                       # Single-page app
│
├── 00-Clients/                      # One folder per client
│   └── Client-<Name>/
│       └── Client.md                 # Client profile + contacts
│
├── 00-Inbox/                        # Raw meeting notes inbox
│   └── done/                        # Processed files (auto-moved)
│
├── 01-Opportunities/                # One folder per active opportunity
│   └── OPP-<###>-<Client>-<Name>/
│       ├── Opportunity.md            # Core opp data
│       └── Meetings/                 # Meeting notes
│           └── <date>-<title>.md
│
├── 02-WeeklyReports/                # Cross-opp weekly reports (auto-generated)
│   └── Weekly Report - <range>.md
│
└── 03-Archive/                      # Closed deals
    ├── Won/<year>/<client>/
    │   └── OPP-<###>-.../
    │       ├── Archive-Summary.md
    │       ├── Opportunity.md
    │       └── Meetings/
    └── Lost/<year>/<client>/
        └── (same structure)
```

> **Note:** Weekly reports are stored only in `02-WeeklyReports/`. There is no `WeeklyReports/` subfolder inside each opportunity folder.

---

## Data Formats

All data is stored as Markdown with structured sections. You can edit these files directly in any text editor — the server re-reads them on each API call.

### Client.md

```markdown
# <Client Name>

**Name:** <value>
**Industry:** <value>
**Region:** APAC | EMEA
**Size:** Enterprise | Mid-market
**Business:** <free text description>
**Created:** <yyyy-mm-dd>
**Updated:** <yyyy-mm-dd>

## Contacts
| Name | Role | Email |
|------|------|-------|

## Notes
<free text>
```

### Opportunity.md

```markdown
# <Client> - <Opportunity Name>

**Client:** <value>
**Opportunity:** <value>
**Owner:** <value>
**Created:** <yyyy-mm-dd>
**Updated:** <yyyy-mm-dd>

## Overview
- **Budget:** <value>          e.g. "$500K", "30K", "¥5M"
- **Need:** AI Tokens | Cloud
- **Timeline:** <value>        e.g. "2026-Q3"
- **Stage:** Discovery | Proposal | Negotiation | Verbal Commit
- **Product:** Open AI | GCP | Azure | Kingsoft Cloud | Starflow | Gemini
- **Next Action:** <plan text> — by yyyy-mm-dd — [Planned|In Progress|Done]

## Stakeholders
| Name | Role | Influence | Attitude |
|------|------|-----------|----------|
| TBD | TBD | TBD | TBD |

## Notes
<free text>
```

### Meeting Note

```markdown
# Meeting: <title>

**Date:** <yyyy-mm-dd>
**Title:** <value>
**Opportunity:** <opp name>
**Attendees:** <comma-separated>
**Venue:** Online | Physical

## Agenda
- <item>
- <item>

## Requirements
- <text> — [Open|Confirmed|Gap] — Due <yyyy-mm-dd>

## Questions
### Q: <question>
A: <answer or "(open)">

## Risks
- **<Risk text>:** <mitigation or "(no mitigation yet)">

## Action Items
- — <owner> — <text> — Due <yyyy-mm-dd> — [Open|In Progress|Completed|Delayed|Cancelled]
```

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/summary` | Full dashboard data (opps, clients, metrics, stale count, recent activity) |
| GET | `/api/opportunities` | List opportunities; `?stage=Discovery` filter |
| POST | `/api/opportunities` | Create opp `{client, name}` — client must exist |
| PUT | `/api/opportunities/:id` | Update opp fields; stage→Won/Lost triggers archive move |
| POST | `/api/opportunities/:id/meetings` | Create meeting note |
| PUT | `/api/opportunities/:id/meetings/:filename` | Update meeting (agenda, requirements, actions, etc.) |
| POST | `/api/opportunities/:id/sync-contacts` | Sync client contacts into stakeholders (incremental, removes TBD placeholders) |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client `{name}` |
| PUT | `/api/clients/:name` | Update client fields |
| GET | `/api/resources` | List resources (clients, opps, meeting notes) |
| POST | `/api/resources` | Create resource in `02-Resources/` |
| GET | `/api/archive` | List all archived opps |
| GET | `/api/archive/:result/:year/:client` | Archived opps for a specific client |
| POST | `/api/weekly-reports` | Auto-generate cross-opp weekly report from current data |
| GET | `/api/weekly-reports` | List existing weekly reports |

---

## Dashboard Sections

1. **Alert Strip** — Red/yellow chips for overdue reqs, delayed actions, gaps, unmitigated risks, stale opps
2. **Client Filter Chips** — Click to filter all dashboard data by client. Resources, Activity (meetings), and Requirements pages also have client filter chips.
3. **Stale Warnings** — Cards for opportunities with 20+ days of inactivity
4. **KPI Cards** — Client count, win rate, lose rate, stale count
5. **Client Overview Table** — Per-client breakdown: opp count, pipeline value, requirements, gaps, overdue, actions, delayed, risks, open questions, status. Click a row to filter by that client.
6. **Next Action Timeline** — Overdue / due soon / upcoming, sorted by date
7. **Action Items & Issues** — Delayed actions, open questions, open/in-progress action items (with owner, due date, overdue indicator)
8. **Pipeline Bars** — Stage distribution with count + value
9. **Risk Radar** — SVG radar chart per opportunity, traffic-light ranking
10. **Alert Breakdown Donut** — Pie chart of alert categories
11. **Closing Urgency** — Cards showing days remaining to target close quarter
12. **Opportunity Health Cards** — Expandable cards with issue bar chart, health score, traffic light, critical/caution items

---

## Opportunity Detail Panel

The detail panel slides in from the right when clicking an opportunity. Key interactive elements:

### Stakeholders
- **↻ Sync** — Pulls new contacts from the client's contact list into stakeholders. Existing names are not duplicated; TBD placeholder rows are removed.
- **+ Add** — Prompts for Name, Role, Influence (High/Medium/Low), Attitude (Champion/Supporter/Neutral/Skeptic).
- **Click Influence badge** — Cycles: High → Medium → Low → High. Saves immediately.
- **Click Attitude badge** — Cycles: Champion → Supporter → Neutral → Skeptic → Champion. Saves immediately.
- **× Remove** — Deletes the stakeholder row, saves immediately.

---

## Business Logic

### Stale Detection
An opportunity is stale if its **last meeting date** is more than 20 days ago. Only meeting dates (timeline activity dates) are checked — editing opportunity fields, action item due dates, and requirement due dates do **not** reset stale status. Opportunities with no meetings at all are considered stale.

### Delayed Actions
An action item counts as delayed if:
- Its status is `Delayed`, OR
- Its status is `Open` **and** its due date is before today

Items with status `Gap` or `Open` and a future due date are **not** delayed.

### Weighted Pipeline
Stage probabilities are hardcoded:
| Stage | Probability |
|-------|------------|
| Discovery | 10% |
| Proposal | 30% |
| Negotiation | 60% |
| Verbal Commit | 85% |

**Probability auto-calculation:** The Opportunity.md template does not include a `Probability` field. The server auto-infers probability from the Stage using the table above. If a manual `**Probability:**` value exists in the MD, it takes priority. The Closing Urgency cards on the dashboard use this value for red/yellow/green labels.

Weighted pipeline = sum of (budget × stage probability) across all active opportunities.

### Archiving
When an opportunity stage is set to `Won` or `Lost`:
- The entire opportunity folder is **moved** from `01-Opportunities/` to `03-Archive/<Won|Lost>/<year>/<client>/`
- An `Archive-Summary.md` is created with close date and result

### Weekly Reports
- Weekly reports are **cross-opportunity and cross-client** — a single report covers all active deals for the period.
- Stored only in `02-WeeklyReports/` as `Weekly Report - <start> ~ <end>.md`.
- Auto-generated via `POST /api/weekly-reports` with `{startDate, endDate}`.
- Organized by product category (AI Token Opportunities, Cloud Resell), then by product, then by client/opportunity.
- Each entry includes budget, stage, meeting progress within the date range, risks, and requirements.

---

## Using the App

### Creating a New Client
1. Click **+ New** in the top bar
2. Switch the create modal to "Client" mode
3. Enter the client name and submit
4. A `Client-<Name>/Client.md` folder is created

### Creating a New Opportunity
1. Click **+ New** → "Opportunity" mode
2. Select an existing client, enter opportunity name
3. An `OPP-<###>-<Client>-<Name>/` folder is created
4. Stakeholders are auto-populated from the client's contacts (Influence=Medium, Attitude=Neutral)

### Recording a Meeting
1. Open the opportunity detail panel
2. Click **+ Meeting** in the timeline section
3. Fill in title, date, attendees, venue
4. After creation, click the meeting entry to add agenda, requirements, questions, risks, action items

### Inline Editing
Most fields in the detail panel are directly editable:
- **Overview fields** (budget, need, timeline, product) — click to edit, blur to save
- **Next Action** — edit plan text inline, pick a due date, click status badge to cycle Planned→In Progress→Done
- **Stakeholders** — click **+ Add** to add a row, click **×** to remove
- **Meeting details** — agenda items, requirements, questions, risks, action items are all inline-editable
- **Notes** — click to edit, blur to save
- **Stage** — click the stage badge to cycle through stages
- **Requirement status** — click the status badge to cycle Open→Confirmed→Gap

### Generating a Weekly Report
1. Go to the **Resources** view
2. Click **+ Weekly Report** or use the API `POST /api/weekly-reports`
3. Provide `{startDate, endDate}` (e.g. `"2026-06-01"`, `"2026-06-22"`)
4. The report is auto-generated from all opportunity/meeting data within that date range
5. Saved to `02-WeeklyReports/` — a single cross-opp file

### Filtering by Client
On the dashboard, click any client chip or client overview table row to filter all metrics to that client only. The Resources, Activity (meetings tab), and Requirements pages also have client filter chips at the top for quick filtering by company. Switching views automatically resets the other pages' filters.

### Syncing Stakeholders from Client Contacts
1. Open the opportunity detail panel
2. Click **↻ Sync** next to the Stakeholders heading
3. New client contacts are added; existing names are not duplicated; TBD placeholder rows are removed

### Viewing Resources
1. Go to the **Resources** view
2. Click any document card to expand it
3. Markdown is rendered as formatted HTML (headings, bold, tables, lists) — not raw symbols

### Clients Page Active Opportunities
Each client card shows the count of active opportunities (excluding Won/Lost archived deals).

### Theme
Toggle light/dark mode with the button in the top bar. Preference is saved in localStorage.

---

## Maintenance Guide

### Adding a New Product
1. Update the product list in `index.html` (search for `<option value=` in the `need` select and the product `contenteditable` patterns)
2. Update the product list in `server.js` if it affects weekly report generation or opportunity creation
3. Update `stageColor()` in `index.html` if the product needs a distinct color

### Changing the Stale Threshold
In `server.js`, search for the stale calculation in the `/api/summary` handler. The threshold is **20 days**. Stale is determined by meeting dates only (not `updated` field or due dates).
In `index.html`, search for `staleDays` in `renderDashboard()` and `getLastActivityDate()` — keep all values in sync.

### Changing Stage Probabilities
In `server.js`, find the `weightedPipelineValue` calculation. Update the mapping:
```js
{Discovery: 0.1, Proposal: 0.3, Negotiation: 0.6, 'Verbal Commit': 0.85}
```

### Adding a New Dashboard Section
1. Add the section HTML generation in `renderDashboard()` inside `index.html`
2. If it needs new data, extend the `/api/summary` response in `server.js`
3. Follow the existing pattern: `glass panel` div with `<h3>` heading and content

### Modifying Data Formats
If you change the Markdown structure:
1. Update the **parser** in `server.js` (regex-based, search for the relevant `parse*` function)
2. Update the **generator** in `server.js` (the function that writes the MD file)
3. Update the **renderer** in `index.html` (the function that displays the parsed data)
4. Update this manual

All three must stay in sync. The server re-reads files on every request, so changes take effect immediately — no restart needed for data changes.

### Changing the Port
In `server.js`, line 6: `const PORT = 3000;`

### Backing Up Data
Copy the entire project folder. All data is in the Markdown files — no database to dump.

### Common Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| Page shows "JS ERROR" | Syntax error in index.html JS | Check browser console for line number |
| Opportunity not showing | Folder name doesn't match pattern `OPP-###-Client-Name` | Rename the folder |
| Meeting not parsed | Missing `**Date:**` field or wrong format | Ensure `Date: yyyy-mm-dd` in meeting MD |
| Stale count seems wrong | `Updated` field not refreshed | Server uses file mtime as fallback |
| API returns 500 | File permission or missing directory | Ensure write access to project folder |
| Weekly report not appearing | Wrong date range or no meetings in period | Verify dates match meeting records |

### Extending the Server
The server uses only Node.js built-ins. To add a new API route:
1. Add a handler in the `if/else if` chain in `server.js`
2. Follow existing patterns: parse body with `JSON.parse(body)`, call `sendJson()` for responses
3. Use `sanitize()` on any user input used in file paths
4. Request body size is limited to 5 MB

---

## Skills (Agent Skills)

本项目包含五个可安装的 Claude skill，供销售团队成员的 agent 加载使用。

### sales-opp-management

路径：`sales-opp-management/SKILL.md`

功能：通过自然语言管理销售商机、客户、会议、周报等。自动将用户请求翻译为 API 调用。

安装：将 `sales-opp-management` 文件夹复制到 `~/.claude/skills/` 下即可。

使用示例：
- "帮我创建一个新客户 Acme Corp"
- "我刚才和 Acme 开了会，讨论了POC，参会人有 John 和 Sam"
- "哪些 deal 需要关注？"
- "生成本周周报"

### weekly-report-polish

路径：`weekly-report-polish/SKILL.md`

功能：将自动导出的原始周报重新整理为销售例会汇报材料。

两大核心部分：
1. **AI Token 业务漏斗总览** — 按漏斗分层（已成单/跟进中/商务流程中/测试中/建联沟通中）统计客户数量，含上周对比
2. **云转售商机覆盖表** — 表格化呈现每个 Cloud 商机的：客户/商机、售卖产品、月收入预估、本周进展、下周计划（留空）、业务风险/所需支持

安装：将 `weekly-report-polish` 文件夹复制到 `~/.claude/skills/` 下即可。

使用示例：
- "帮我整理这周的周报"
- "把周报整理成例会汇报材料"
- "生成销售周报 2026-06-01 ~ 2026-06-22"

### meeting-prep

路径：`meeting-prep/SKILL.md`

功能：会前准备助手。交叉分析商机 Requirements / Actions / Risks / Stakeholders，识别盲点（UNCOVERED Gap / UNADDRESSED Risk）与丢单风险（RED/YELLOW/GREEN 评级），输出具体会议打法（Game Plan）。语言跟随用户，专有名词保留英文。

安装：将 `meeting-prep` 文件夹复制到 `~/.claude/skills/` 下即可。

使用示例：
- "帮我准备 Softspace 的下次会议"
- "prepare next meeting for PetroEdge"

### meeting-capture

路径：`meeting-capture/SKILL.md`

功能：会后录入助手。从原始会议笔记中提取结构化数据（title、date、venue、attendees、agenda、requirements、risks、actions、questions），自动匹配商机。同日期已有会议则去重合并补充（TBD 占位替换为真实内容），无则创建新会议 MD。支持从 `00-Inbox/` 自动扫描原始笔记文件（`.txt`/`.md`/`.docx`/`.pdf`），处理完移入 `00-Inbox/done/`。**无论源文件语言，提取的结构化内容统一输出英文**，仅中文人名和无通用英文名的产品中文名保留原文。

安装：将 `meeting-capture` 文件夹复制到 `~/.claude/skills/` 下即可。

使用示例：
- "帮我录入这次会议纪要" + 粘贴笔记
- "录入 00-Inbox 里的会议笔记"
- "capture these meeting minutes"

### version-upgrade

路径：`version-upgrade/SKILL.md`

功能：版本升级工具。对比新旧版本代码 diff，只覆盖代码文件，不碰数据目录，自动备份旧代码、同步缺失的 skill、更新版本号。

安装：将 `version-upgrade` 文件夹复制到 `~/.claude/skills/` 下即可。

---

## File Quick Reference

| What | Where | Editable Outside App |
|------|-------|---------------------|
| Client profiles | `00-Clients/Client-<Name>/Client.md` | Yes |
| Raw meeting notes | `00-Inbox/*.txt` or `*.md` | Yes (meeting-capture processes and moves to `done/`) |
| Opportunity data | `01-Opportunities/OPP-<###>/Opportunity.md` | Yes |
| Meeting notes | `01-Opportunities/OPP-<###>/Meetings/<date>-<title>.md` | Yes |
| Weekly reports | `02-WeeklyReports/Weekly Report - <range>.md` | Yes (but will be overwritten on next generate) |
| Archived opps | `03-Archive/<Won|Lost>/<year>/<client>/` | Yes |
| Server config | `server.js` line 6 (PORT), line 8 (BASE_DIR) | Restart required |
| Frontend | `index.html` (everything) | Refresh browser after edit |
