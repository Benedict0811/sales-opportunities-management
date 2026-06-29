# Sales Opportunities Management — Project Context

> 任何人在此目录下启动 Claude 时会自动加载此文件。

## 系统架构

- **server.js** — Node.js HTTP 服务（端口 3000，零 npm 依赖）
- **index.html** — 单页应用，所有 CSS/JS 内联
- **数据存储** — 全部是 Markdown 文件，无数据库

## 目录结构

```
00-Clients/Client-<Name>/Client.md       — 客户档案 + 联系人
01-Opportunities/OPP-<###>-<Client>-<Name>/ — 商机目录
  ├── Opportunity.md                      — 核心数据
  └── Meetings/<date>-<title>.md          — 会议纪要
02-WeeklyReports/                         — 跨商机周报（唯一存储位置）
03-Archive/<Won|Lost>/<year>/<client>/    — 已关单商机归档
```

## 数据格式关键点

### Opportunity.md 字段
- `Budget`: 自由格式（`$500K`, `30K`, `¥5M`）
- `Need`: **只能是** `AI Tokens` 或 `Cloud`（精确匹配，不要写其他值）
- `Stage`: Discovery → Proposal → Negotiation → Verbal Commit → Won/Lost
- `Next Action`: 格式 `计划内容 — by yyyy-mm-dd — [Planned|In Progress|Done]`，API 自动解析为 `nextActionDue` 和 `nextActionStatus`

### Meeting 纪要字段
- Requirements: `<text> — [Open|Confirmed|Gap] — Due <date>`
- Action Items: `— <owner> — <text> — Due <date> — [Open|In Progress|Completed|Delayed|Cancelled]`
- Risks: `**<risk text>:** <mitigation or "(no mitigation yet)">`
- Questions: `### Q: <question>` / `A: <answer or "(open)">`

## 业务规则

### Stale 判定（20天）
Stale 判定规则：
- **有会议记录**：取 timeline 上最近的会议日期，距今天超过 20 天 → stale
- **无会议记录**：取 opportunity 的 `created` 日期，距今天超过 20 天 → stale
- 编辑商机字段不等于真实客户互动，不看 `updated` 字段或 action/requirement 的 due date

### Delayed Action 定义
- `status === 'Delayed'` — 显式标记
- `status === 'Open' && due < 今天` — 隐式逾期

**Gap 状态不算 Delayed。Open 且 due 在未来也不算 Delayed。**

### Stage 概率
| Stage | 概率 |
|-------|------|
| Discovery | 10% |
| Proposal | 30% |
| Negotiation | 60% |
| Verbal Commit | 85% |

**Probability 自动计算规则：** Opportunity.md 模板不含 `Probability` 字段，由 server.js 根据 Stage 自动推断（与加权管线一致）。如果 MD 中手动写了 `**Probability:**` 则优先用手动值，否则按上表自动填充。前端 Closing Urgency 的红/黄/绿标签依赖此值。

### 归档机制
Stage 设为 Won/Lost → 整个商机文件夹从 `01-Opportunities/` **移动**到 `03-Archive/`，同时生成 `Archive-Summary.md`。操作不可逆，误操作需手动移回。

### Win/Lose Rate 计算
归档后的商机不在活跃 `opportunities` 数组中，必须从 `summaryData.archive.won/lost` 取数据。按客户筛选时也要对 archive 列表做 client 过滤，否则筛选后 Win Rate 会显示 0。

**关键逻辑**（`index.html` renderDashboard）：
```
fWon = 活跃中Won数量 + archive.won按客户筛选后的数量
fLost = 活跃中Lost数量 + archive.lost按客户筛选后的数量
```

## 踩坑经验

### 1. 格式改动三件套同步
改 MD 格式时必须同时更新：**解析器**（parse*Md）→ **生成器**（generate*Md）→ **渲染器**（index.html 渲染函数）。只改一个会静默出错。

### 2. need 值只接受两个
`AI Tokens` 和 `Cloud`，不能写 "AI Token"（少 s）或小写。手动编辑 MD 时注意。

### 3. Stale 判定规则
- **有会议记录**：取 timeline 上最近的会议日期，距今天超过 20 天 → stale
- **无会议记录**：取 opportunity 的 `created` 日期，距今天超过 20 天 → stale
- 不看 `updated` 字段或 action/requirement 的 due date。编辑商机字段不等于真实客户互动。

### 4. Delayed ≠ Gap
Gap 是需求差距，不是逾期。把 Gap 标成 Delayed 会导致告警泛滥，销售不再信任。

### 5. 正则解析脆弱
字段顺序不能换、多余空行会打断匹配、缩进变化导致失败、表格分隔行必须有。编辑 MD 后建议 `curl -s localhost:3000/api/opportunities` 检查返回完整性。

### 6. 月收入换算
budget 直接代表月预估收入，不需要除以 12。先解析 K/M 后缀转绝对金额（USD），再转万。`$800K` = $800,000 = **80万**USD/月，不是 6.7万也不是 66.7万。

### 7. 全中文输出边界
翻译时只翻动作/状态/描述，**保留英文**：客户名（Softspace）、产品名（Open AI）、商机名（GCP Migration）、技术术语（Lambda, Cloud Run）。

### 8. Win/Lose Rate 必须包含归档数据
归档的商机已从活跃列表移走，计算 Win Rate / Lose Rate 时必须合并 `archive.won/lost`。按客户筛选时也要对 archive 列表过滤，否则筛选后 Win Rate 显示 0。

### 9. Probability 不能为空
Opportunity.md 模板不含 `Probability` 字段，如果解析为空，前端 Closing Urgency 会全部显示 0%。必须在 server.js 里根据 Stage 自动推断概率（Discovery=10%, Proposal=30%, Negotiation=60%, Verbal Commit=85%），手动值优先。

### 10. Contacts 必须同步到 Stakeholders
创建商机时自动从客户 contacts 初始化 stakeholders（Influence=Medium, Attitude=Neutral），否则全部显示 TBD。已有商机可通过 `POST /api/opportunities/:id/sync-contacts` 增量同步，同时清理 TBD 占位行。

### 11. Stakeholder Influence/Attitude 可点击循环切换
Influence: High → Medium → Low → High。Attitude: Champion → Supporter → Neutral → Skeptic → Champion。点击即保存，不要用 prompt。

### 12. Resources 页面 Markdown 渲染
点击文档展开后用 `md2html()` 渲染为格式化 HTML，不要直接显示原始 Markdown 符号。

### 13. 销售周报专用渲染
`销售周报` 文件（中文格式）打开时使用 `renderSalesReport()` 渲染，不用通用 `md2html()` 或结构化解析。该函数优化了：表格带表头/隔行变色/宽表横滚、二级标题按章节着色带左边框、引用块提示框、复选框列表、字号 13px + 宽行距。

### 14. 周报标题解析
`server.js` 的 `parseWeeklyReportMd` 同时支持 `Weekly Report -` 和 `销售周报 —` 两种标题格式提取日期范围。

### 15. Next Action 结构化存储
Next Action 字段格式为 `计划内容 — by yyyy-mm-dd — [Planned|In Progress|Done]`。server.js 自动解析 `nextActionDue` 和 `nextActionStatus`，前端渲染为三部分：可编辑计划文本、日期选择器、可点击状态徽章（Planned→In Progress→Done→Planned）。保存时合并为单个字段写入 MD。

### 16. Meeting Prep 会前准备
Activity 标签页下第三个 tab "Meeting Prep"，仅展示已生成 AI Briefing 的商机。每张卡片包含：
- **AI Briefing 卡片** — Deal Risk 评级（RED/YELLOW/GREEN）+ 展开/收起全文
- **Next Meeting 卡片** — 标题、日期、地点、参会人、议程
- 无 Briefing 时显示提示："No AI briefings yet — use meeting-prep to generate one"
纯前端展示，Briefing 数据由 `meeting-prep` skill 生成并通过 `POST /api/opportunities/:id/briefings` 保存。

### 17. Stage History（Deal Velocity）
Opportunity.md 新增 `- **Stage History:** Discovery:2026-05-01, Proposal:2026-05-20`。创建时写入初始记录，点击 stage 切换时 server 自动追加 `", NewStage:yyyy-mm-dd"`。`daysInStage` 由 server 读取时动态计算（today - lastStageDate），不存入 MD。与 Stale 判定完全独立。前端在详情面板和健康度卡片中显示 "Stage: Proposal (15d)"。

### 18. Quarterly Target 季度目标追踪
项目根目录 `targets.md` 存储季度目标（`**2026-Q3:** 800`，单位 USD 万）。复用 Opportunity.md 已有的 `**Timeline:** 2026-Q3` 字段匹配预算归属季度，不新增 MD 字段。`/api/summary` 返回 `quarterly` 对象：current/target/won/pipeline/gap。Dashboard KPI 区新增季度目标卡片：进度条 + 已关单/跟进中/缺口三行。卡片右上角编辑按钮可增删改季度目标（`PUT /api/targets`）。归档 Won deal 通过读取归档目录下 Opportunity.md 的 Timeline 字段匹配季度。

## Skills

项目目录下有四个可安装的 Claude Skill：

### sales-opp-management/SKILL.md
自然语言操作 CRM：创建客户/商机、记录会议、跟踪行动项、生成周报。

### weekly-report-polish/SKILL.md
整理原始周报为例会汇报材料：AI Token 漏斗总览 + 云转售覆盖表 + 闭环追踪。

### version-upgrade/SKILL.md
版本升级工具：对比新旧版本代码 diff，只覆盖代码文件，不碰数据目录，自动备份旧代码、同步缺失的 skill、更新文件夹版本号。

### meeting-prep/SKILL.md
会前准备助手：交叉分析商机 Requirements / Actions / Risks / Stakeholders，识别盲点（UNCOVERED Gap / UNADDRESSED Risk）与丢单风险（RED/YELLOW/GREEN 评级），输出具体会议打法（Game Plan: 主目标、开场策略、地雷、请求、后备）。简报结构：分析在前半页，原始数据折叠在 `<details>` 里。语言跟随用户，专有名词保留英文。

**安装方式**：将对应文件夹复制到 `~/.claude/skills/` 下即可，文件夹名和 SKILL.md 文件名不要改。

## 前端 UI 规范

### Stakeholders 交互
- Influence 和 Attitude 渲染为可点击彩色徽章，点击循环切换选项
  - Influence: High → Medium → Low → High
  - Attitude: Champion → Supporter → Neutral → Skeptic → Champion
- 商机详情页 Stakesholders 区域有 `↻ Sync` 按钮，调用 `POST /api/opportunities/:id/sync-contacts` 从客户 contacts 增量同步新联系人

### Resources Markdown 渲染
- `openResourceDetail` 和 `openMeetingResource` 必须用 `md2html()` 渲染，不能直接 `escHtml()` + `white-space:pre-wrap` 输出原始符号
- `md2html()` 支持：标题(h1-h3)、粗体、斜体、行内代码、无序列表、表格
- Notes 等简短自由文本字段仍用 `pre-wrap` + `escHtml()`（不是 Markdown）

### 销售周报渲染
- `销售周报 - *.md` 文件打开时使用 `renderSalesReport()` 渲染，不走通用 `md2html()` 或结构化解析
- 优化项：表格表头/隔行变色/宽表横滚/首列加粗、二级标题章节着色+左边框、引用块提示框、复选框列表、13px 字号 + 1.8 行距
- 活动列表中销售周报卡片带"汇报版"彩色标签，区别于原始导出

### 周报标题解析
- `parseWeeklyReportMd` 支持 `Weekly Report -` 和 `销售周报 —` 两种格式提取日期范围

### 客户筛选芯片
- Dashboard、Resources、Activity（会议）、Requirements 四个页面均支持按客户筛选的芯片栏
- 使用全局 `chipCls(active)` 函数渲染统一风格，存储筛选值在 `window._dashFilter`、`window._resFilter`、`window._actFilter`、`window._reqFilter`
- 切换视图时自动重置其他页面的筛选（`switchView()` 中处理）

## 常用操作

```bash
# 启动服务
node server.js

# 检查服务状态
curl -s http://localhost:3000/api/summary | head -c 100

# 查看所有商机
curl -s http://localhost:3000/api/opportunities | python3 -m json.tool

# 生成周报
curl -s -X POST http://localhost:3000/api/weekly-reports \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-06-01","endDate":"2026-06-22"}'
```
