---
name: meeting-prep
description: "会前准备助手：基于商机数据交叉分析生成智能简报，识别盲点与丢单风险，输出具体会议打法，交互式收集会议信息并通过 API 创建会议纪要文件。输入客户名或商机名即可启动，输出语言跟随用户语言（客户名/产品名/商机名/人名保留英文）。"
---

# Meeting Prep — 会前准备助手

基于商机历史数据，交叉分析 Requirements / Actions / Risks / Stakeholders，识别盲点和丢单风险，输出可执行的会议打法，交互式收集会议详情并创建会议纪要 MD 文件。

## When to Apply

当用户说类似以下的话时触发：

### Must Use

- "帮我准备 Softspace 的下次会议"
- "prepare next meeting for Softspace"
- "准备跟进 SkyMedia 客户"
- "get meeting prep for PetroEdge"
- "我要和 HealthBridge 开会，帮我准备"
- "next meeting prep for GCP Migration"

### Recommended

- "Softspace 有什么未闭环的事项？"
- "我下周要见 PetroEdge，帮我梳理一下"
- "what should I prepare for the next SkyMedia call"

### Skip

- 记录会议纪要（用 sales-opp-management）
- 生成周报（用 weekly-report-polish）
- 升级系统代码（用 version-upgrade）
- 非销售相关的会议准备

## Setup

在执行任何操作前，服务器必须运行。自动检查并启动：

```bash
# Step 1: Check
curl -s http://localhost:3000/api/summary > /dev/null 2>&1

# Step 2: If failed, start server
cd "/Users/admin/documents/Sales Opportunies Management" && node server.js &

# Step 3: Verify after 2 seconds
sleep 2 && curl -s http://localhost:3000/api/summary | head -c 20

# Step 4: If still failing, report error
```

## API Quick Reference

| Action | Method | Endpoint | Body / Params |
|--------|--------|----------|---------------|
| 获取全部数据 | GET | `/api/summary` | — |
| 列出客户 | GET | `/api/clients` | — |
| 保存简报 | POST | `/api/opportunities/:id/briefings` | `{title, date, content}` |
| 删除简报 | DELETE | `/api/opportunities/:id/briefings/Briefing-<date>-<title>.md` | — |
| 创建会议 | POST | `/api/opportunities/:id/meetings` | 见下方 |

### 创建会议 POST body

```json
{
  "title": "POC Kickoff Discussion",
  "date": "2026-06-28",
  "attendees": "Ali(CTO), Sam, Jayden(SA)",
  "venueType": "Online",
  "venueDetail": "Zoom Meeting ID: 123-456-789",
  "agenda": ["Review POC results", "Discuss migration timeline"],
  "requirements": [],
  "questions": [],
  "risks": [],
  "actionItems": []
}
```

字段规则：
- `title`: 字符串，从用户指令提炼或询问
- `date`: `yyyy-mm-dd`，从用户指令解析或询问
- `attendees`: 逗号分隔字符串，如 `"Ali(CTO), Sam, Jayden(SA)"`
- `venueType`: `"Online"` 或 `"Physical"`
- `venueDetail`: 可选，Zoom 链接/会议室/地址
- `agenda`: 字符串数组 `string[]`
- `requirements`, `questions`, `risks`, `actionItems`: 新建时传 `[]`，会后更新再填入

## Step 1: Identify the Opportunity & Capture User Intent

从用户输入提取客户名或商机名，并**同时提取用户描述的下次会议意图**（如有）。

```bash
curl -s http://localhost:3000/api/summary
```

从 `summaryData.opportunities[]` 中查找（排除 stage=Won/Lost 的归档商机）：

1. **精确匹配商机名**：`opp.name` 包含用户提到的名称 → 直接选中
2. **匹配客户名**：`opp.client` 包含用户提到的名称 → 可能多个
3. **模糊匹配**：同时匹配 `client` 和 `name`

**歧义处理**：同一客户下有多个活跃商机时，列出所有匹配项并询问：

> Softspace 下有多个活跃商机，请确认你要准备哪个：
> 1. Softspace-Open AI (Discovery, 4d)
> 2. Softspace-Azure Migration (Proposal, 12d)
> 请输入序号：

**会议意图提取**：如果用户描述了下次会议要讨论什么（如"我们要讨论 POC 结果"），记录为 `nextMeetingIntent`，这将用于后续的交叉分析和 Game Plan 生成。如果用户没有描述，跳过。

## Step 2: Extract & Enrich Data

从选中的商机对象中提取数据，并执行**交叉标注**（这是分析的基础）。

### 2.1 Raw Extraction

跨越该商机的**所有会议**提取：

| 类别 | 数据源 | 筛选规则 |
|------|--------|---------|
| Last Meeting | `meetings[]` 按 `fields.Date` 降序第一个 | `fields.Date`, `fields.Title`, `agenda[]` |
| Open Actions | `meetings[].actionItems[]` | `status` ∈ {Open, In Progress, Delayed} |
| Open Questions | `meetings[].questions[]` | `answer` ∈ {"(open)", "", "TBD"} |
| Unmitigated Risks | `meetings[].risks[]` | `mitigation` ∈ {"(no mitigation yet)", "", "TBD"} |
| Gap Requirements | `meetings[].requirements[]` | `status === "Gap"` |
| Stakeholders | `opportunity.stakeholders[]` | 全部 |
| Current Status | `opportunity` | `stage`, `daysInStage`, `nextAction`, `budget`, `product` |

### 2.2 Cross-Reference Enrichment

提取完成后，对每条数据执行交叉标注：

**Gap Requirements 标注：**
- `COVERED` — 存在 Open/In Progress Action 明确指向该 Gap
- `UNCOVERED` — 无任何 Action 对应此 Gap ← **盲点信号**
- `OVERDUE` — 该 Gap 的 due date 已过

**Risks 标注：**
- `BEING ADDRESSED` — 存在 Action 在缓解此 Risk
- `UNADDRESSED` — 无 Action 对应此 Risk ← **盲点信号**
- `ESCALATING` — 此 Risk 跨 2+ 次会议仍无缓解 ← **升级信号**

**Action Items 标注：**
- `ON CRITICAL PATH` — 此 Action 阻塞了某个 Gap 或缓解了某个 Risk
- `SUPPORTING` — 不在 Critical Path 上
- `OVERDUE` — `due < today` 且 `status` ∉ {Completed, Cancelled}

**Stakeholders 标注：**
- `POTENTIAL CHAMPION` — `influence=High` 且 `attitude` ∈ {Supporter, Neutral}
- `BLOCKER RISK` — `influence=High` 且 `attitude=Skeptic`
- `DISENGAGED` — 此人拥有 2+ 个逾期 Action 且 `attitude` ∈ {Neutral, Skeptic}

**计算指标：**
- Action 完成率：`Completed / Total`
- Requirement 确认率：`Confirmed / Total`
- 会议节奏：平均会议间隔天数（趋势：accelerating / stable / decelerating）
- 距上次会议天数

### 2.3 User Intent Cross-Check

如果用户提供了 `nextMeetingIntent`（Step 1 提取的下次会议意图），执行反向检查：

1. **遗留关联** — 上次遗留的 Open 事项中，哪些与用户意图直接相关 → 优先级提升
2. **阻力预判** — 用户意图涉及的话题，哪个 Stakeholder 可能反对 → Game Plan 标记应对
3. **查缺补漏** — 用户意图是否遗漏了关键 Gap/Risk → 明确提醒

例：用户说"讨论 POC 结果"，但 Gap 里有"合规认证未过" → 提醒"POC 讨论可能被合规问题截胡，需提前准备合规进展说明"。

## Step 3: Deal Analysis

基于 Step 2 的富化数据，执行六个分析模块。**每个模块必须产出至少一个"从原始数据看不出来的洞察"。**

### 3.1 Deal Health Assessment

综合所有信号判定交易健康度。

**规则：**
```
RED（可能丢单）:
- 2+ 个 HIGH 信号（UNCOVERED Gap / UNADDRESSED Risk / 无 Champion / 高影响力 Skeptic）
- 或：客户侧逾期 Action + 无 Champion
- 或：Budget 审批风险 + 本季度 Target Close

YELLOW（可能停滞）:
- 1 个 HIGH 信号 或 2+ 个 MEDIUM 信号
- 会议节奏放缓 + 任何其他信号

GREEN（健康推进）:
- 有 Champion 或 Supporter（Medium+ 影响力）
- Action 完成率 > 60%
- 会议节奏稳定或加快
```

**输出：** RED / YELLOW / GREEN + 一句话判定 + 2-3 条证据 + 不解决的后果（要具体，不能说"交易可能延误"，要说"Sara 无法在内部推动合同审批，交易将错过 Q3 target，同时 Claude free trial 继续侵蚀用户心智"）

### 3.2 Last Meeting → Next Meeting Thread

把上次和下次连成一条线索，而不是两个孤立的事件。

**输出：**
- 上次会议决定了什么
- 上次遗留了什么未闭环
- 这次会议**必须闭环**其中的哪些（基于 Critical Path 和用户意图）

### 3.3 Critical Path Identification

从所有 Open 项中挑出**推进交易必须解决的**，其余明确标注可延后。

**输出：** Top 3 排序表格，每项说明"为什么关键"（关联哪个 Gap/Risk/Stakeholder）。最后加一行：**"以下事项不在 Critical Path，本次可延后：..."**

### 3.4 Blind Spot Detection

列出 UNCOVERED Gap 和 UNADDRESSED / ESCALATING Risk。每个盲点必须写清楚**如果不解决，具体后果是什么**。

**输出示例：**
> "HIPAA+GDPR 合规认证 [Gap, UNCOVERED] — 没有任何 Action 在推进合规。到期日 07-15。不解决的后果：即便 NLP 准确率达标，没有合规认证合同无法签署，交易直接卡死。"

### 3.5 Stakeholder Dynamics

分析人际关系格局，不是列表格。

**必须回答：**
- 我们有没有 Champion？如果没有，谁最有可能变成 Champion？
- 有没有 Blocker？如果有，是什么态度 + 拥有什么 Action？
- 逾期 Action 的归属方揭示了什么？（客户侧逾期 = 对方不急；我方逾期 = 资源不够；同一人反复逾期 = 此人在观望）

### 3.6 Pre-Meeting Game Plan

基于以上所有分析，输出**这一次会议的具体打法**。必须可执行，不能是"了解客户需求"这种空话。

**结构：**
1. **主目标** — 这一场必须拿到什么（只能写一个）
2. **次要目标** — 有余力再推进的
3. **开场策略** — 先说什么，为什么选这个开场（关联数据）
4. **地雷** — 什么话题要避开，对方提起来怎么转
5. **请求** — 具体向对方要什么承诺（不能含糊）
6. **后备** — 主目标拿不到时，退而求其次拿什么
7. **会前准备** — 需要在会议前完成的内部动作（如果有）

## Step 4: Render Briefing

按以下模板输出（语言跟随用户，专有名词保留英文）：

```markdown
# Meeting Briefing — <商机名>

## Deal Health
**风险等级**: 🔴 RED / 🟡 YELLOW / 🟢 GREEN
**核心风险**: <一句话>
**证据**: <2-3条数据>
**不解决的后果**: <具体场景>

## Last Meeting → Next Meeting 线索
- **上次**: <date> — <title>
- **决定了**: <what was confirmed>
- **遗留了**: <what was left open>
- **这次必须闭环**: <what MUST be resolved this time>

## Critical Path
| # | 事项 | 类型 | 负责人 | 到期 | 为什么关键 |
|---|------|------|--------|------|-----------|
| 1 | ... | Action/Gap/Risk | ... | ... | <one sentence> |
| 2 | ... | ... | ... | ... | ... |
| 3 | ... | ... | ... | ... | ... |

本次可延后：<不在 Critical Path 上的事项>

## Blind Spots
1. <Gap/Risk, 标签> — <不解决的具体后果>

## Open Requirements
| # | Requirement | Status | Due | Covered? |
|---|-------------|--------|-----|----------|
| 1 | <text> | Open/Gap/Confirmed | <due> | ✅ COVERED / ⚠️ Partial / ❌ UNCOVERED |

## Open Action Items
| Owner | Action | Due | Status | On Critical Path? |
|-------|--------|-----|--------|-------------------|
| ... | ... | ... | ... | ✅ / — |

## Unmitigated Risks
1. **<risk text>** — <mitigation status or "No mitigation prepared"> — **Consequence**: <what happens if this risk materializes>

## Stakeholder Dynamics
- **Champion 状态**: <已有 / 缺失 / 候选人: name>
- **Blocker 风险**: <name + why> 或 "未识别到"
- **Action 归属信号**: <谁拥有逾期 Action，揭示了什么>
- **本次关键人际动态**: <one sentence>

## Game Plan
1. **主目标**: <one thing>
2. **次要目标**: <if bandwidth allows>
3. **开场**: <what to lead with and why>
4. **地雷**: <what to avoid>
5. **请求**: <concrete commitment to ask for>
6. **后备**: <fallback if primary ask fails>
7. **会前准备**: <internal actions needed before the call, if any>

---

<details>
<summary>📋 参考数据</summary>

## Open Action Items
| Owner | Action | Due | Status |
|-------|--------|-----|--------|
| ... | ... | ... | ... |

## Open Questions
1. <question>

## Unmitigated Risks
1. <risk> — <mitigation status>

## Gap Requirements
1. <text> (Due <due>)

## Stakeholder Map
| Name | Role | Influence | Attitude |
|------|------|-----------|----------|
| ... | ... | ... | ... |

Influence: High X | Medium X | Low X
Attitude: Champion X | Supporter X | Neutral X | Skeptic X

## Current Status
- **Stage**: <stage> (<daysInStage>d)
- **Next Action**: <nextAction>

</details>
```

**关键原则：分析在上半页，数据在折叠区。** Rep 先看打法，需要时展开数据。

## Step 5: Collect Meeting Details

简报输出后，进入交互式收集。**原则：已知的不再问，缺失的才问。**

### Title
- 用户指令中明确描述会议主题 → 直接提取
- 不明确 → 询问

### Date
- 用户提到日期/时间 → 解析为 `yyyy-mm-dd`
- 未提到 → 询问

### Venue
- 用户提到线上/线下/Zoom 等 → 提取 `venueType` + `venueDetail`
- 未提到 → 询问

### Attendees
- 用户提到了 → 直接使用
- 未提到 → 询问是否加入客户联系人：
  ```bash
  curl -s http://localhost:3000/api/clients
  ```
  从返回列表中用 `opp.client` 匹配找到对应客户的 `contacts[]`，列出供用户选择，同时允许手动补充
- 最终拼接为逗号分隔字符串：`Name(Role), Name(Role)`

### Agenda
- 用户指令描述了讨论内容 → 分解为议程列表
- 未描述 → 基于简报分析自动建议：
  - Critical Path #1 → "推进 XXX 事项"
  - Blind Spot → "解决 XXX 盲点"
  - 逾期 Action → "跟进 XXX 行动项"
  - 用户意图匹配的 Open Question → "回答关于 XXX 的问题"
- 询问用户是否需要增删调整

### Confirm

收集完毕后展示确认摘要：

```
## Meeting Details
- **Opportunity**: <opp.id>
- **Title**: <title>
- **Date**: <date>
- **Venue**: <venueType> — <venueDetail>
- **Attendees**: <attendees>
- **Agenda**:
  1. <item 1>
  2. <item 2>
  3. <item 3>

Confirm? (yes/no)
```

## Step 6: Save Briefing

将 Step 4 输出的完整简报内容保存到商机目录：

```bash
curl -s -X POST http://localhost:3000/api/opportunities/<opp.id>/briefings \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "<简报关联的会议标题>",
    "date": "<会议日期 yyyy-mm-dd>",
    "content": "<Step 4 输出的完整 markdown 简报内容>"
  }'
```

这样简报会显示在 Meeting Prep 标签页对应商机下，销售打开页面即可回顾。

## Step 7: Create Meeting

用户确认后调用 API：

```bash
curl -s -X POST http://localhost:3000/api/opportunities/<opp.id>/meetings \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "<title>",
    "date": "<date>",
    "attendees": "<attendees>",
    "venueType": "<Online|Physical>",
    "venueDetail": "<detail>",
    "agenda": ["<item1>", "<item2>"],
    "requirements": [],
    "questions": [],
    "risks": [],
    "actionItems": []
  }'
```

成功后确认：
- 中文："会议已创建: `<filename>`"
- English: "Meeting created: `<filename>`"

## Language Rules

**语言跟随用户**：
- 用户中文提问 → 全部中文输出
- 用户英文提问 → 全部英文输出
- 中英混合 → 以主要语言为准

**始终保留英文**（不翻译）：
- 客户公司名: Softspace, SkyMedia, PetroEdge 等
- 产品名: Open AI, GCP, Azure, Kingsoft Cloud, Starflow, Gemini 等
- 商机名: Softspace-Open AI, GCP Migration, Azure IoT Platform 等
- 人名: Ali, Kevin Tan, Raj Patel 等
- 技术术语: Lambda, Cloud Run, DynamoDB, Firestore, IoT Hub 等

## Important Notes

- **只处理单个商机**：一次只准备一个商机的会议，不跨商机聚合
- **数据来源优先用 summary**：`GET /api/summary` 返回的 `opportunities[]` 已包含完整 meetings 数据，无需额外调用
- **客户联系人需过滤**：`GET /api/clients` 返回所有客户，用 `opp.client` 匹配找到对应客户的 `contacts[]`
- **不存在 GET /api/clients/:name**：需从列表中过滤
- **agenda 为字符串数组**：POST body 中 `agenda` 是 `string[]`，不是逗号分隔字符串
- **attendees 为字符串**：POST body 中 `attendees` 是逗号分隔的单个字符串，不是数组
- **空数组不可省略**：`requirements`, `questions`, `risks`, `actionItems` 必须传 `[]`
- **venueDetail 可选**：无具体信息时省略或传空字符串
- **日期格式必须 yyyy-mm-dd**：否则文件名和 MD 内容会格式错误
- **简报后必须继续收集**：除非用户只要求查看事项概览
- **分析必须有增量洞察**：每个分析模块至少产出一条"从原始数据看不出来的洞察"，禁止纯搬运数据
- **Game Plan 必须可执行**：禁止空话如"了解客户需求""推进关系"，必须写明说什么、对谁说、要什么承诺
- **Discovery 阶段停留天数参考 created date**：如果没有 Stage History 记录，用 `fields.Created` 作为 Discovery 起始日期
- **不解决的后果必须具体**：不能说"可能延误"，要说"Sara 下周如果拿不到定价方案，就无法在内部推动合同审批，交易将错过 Q3 target"
