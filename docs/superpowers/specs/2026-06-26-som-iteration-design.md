# SOM 迭代设计 — Meeting Prep / Deal Velocity / Quarterly Target

> 日期：2026-06-26 | 路径：Feature 1 → Feature 3 → Feature 4（路径 B，独立交付）

---

## Feature 1: 会前准备助手（Meeting Prep）

### 定位

在商机详情面板 Activity 标签页下新增第三个 tab "Meeting Prep"，聚合当前商机的结构化数据，生成一屏可扫的会前简报。不依赖大模型，纯字段提取 + 状态筛选。

### 数据来源

全部从现有 `opp` 对象 + `opp.meetings` 数组提取，无新 API、无新 MD 字段：

| Briefing 区块 | 数据来源 | 提取规则 |
|--------------|---------|---------|
| 上次会议结论 | meetings 最后一条 | 取 date + agenda 条目（列表形式展示） |
| 未闭环行动项 | 所有 meetings 的 actionItems | status=Open/In Progress/Delayed，按 due 排序，逾期标红 |
| Open Questions | 所有 meetings 的 questions | answer="(open)" 的条目 |
| 未缓解风险 | 所有 meetings 的 risks | mitigation="(no mitigation yet)" 的条目 |
| Gap 需求 | 所有 meetings 的 requirements | status=Gap 的条目 |
| Stakeholder 全景 | opp.stakeholders | 按 Influence 排序，Champion 标绿，Skeptic 标红 |
| 当前 Stage + Next Action | opp 字段 | 直接展示 |

### UI 交互

- Activity 标签页 tab bar：Meeting Notes | Weekly Reports | **Meeting Prep**
- 点击 Meeting Prep → 内容区渲染 `renderBriefing(opp)` 输出
- 每个区块一个 glass panel，与 dashboard health card 风格一致
- 行动项 / 问题 / 风险条目可点击跳转到对应 meeting（点击 → 切到 Meeting Notes tab → 滚到对应会议）

### 改动范围

| 文件 | 改动 |
|------|------|
| `index.html` | Activity tab bar 新增 "Meeting Prep" 按钮；新增 `renderBriefing(opp)` 函数 |
| `server.js` | 零改动 |
| MD 格式 | 零改动 |

---

## Feature 3: Deal Velocity（Stage 停留时长）

### 定位

记录商机在每个 stage 的进入时间，在详情面板和健康度卡片中显示"在当前 stage 停留了多少天"。纯信息展示，不做告警/颜色判断。

### MD 字段变更

Opportunity.md 新增一行（追加在 Next Action 后面）：

```markdown
- **Stage History:** Discovery:2026-05-01, Proposal:2026-05-20
```

- **创建商机时**：自动写入 `**Stage History:** Discovery:<created日期>`
- **点击 stage 切换时**：server 自动追加 `", NewStage:yyyy-mm-dd"`，不改已有记录
- **Days in Stage**：server 读取时取 Stage History 最后一条的日期，`today - lastDate` 动态返回，不存入 MD

### 与 Stale 的关系

完全独立。Stale 只看最近会议日期（20天规则不变），Deal Velocity 只看 Stage History 最后日期。两者互不干扰。

### 三件套同步

| 组件 | 改动 |
|------|------|
| **Parser** | `parseOpportunityMd` 新增正则 `/\*\*Stage History:\*\*\s*(.+)/` 提取字符串，按 `, ` 拆分为 `[{stage, date}]`；返回 `stageHistory` 数组 + `daysInStage` 计算值 |
| **Generator** | `generateOpportunityMd` 模板追加 `**Stage History:**` 行（初始值 = `Discovery:<today>`）；`updateOpportunity` 处理 stage 变更时追加记录 |
| **Renderer** | 详情面板 Overview 区 stage 行改为 "Stage: Proposal (15 days)"；Health Card 新增一行 "X days in [Stage]" |

### 改动范围

| 文件 | 改动 |
|------|------|
| `server.js` | parser 新增 Stage History 解析；generator 模板追加字段；update 处理 stage 变更追加记录；listOpportunities 返回 daysInStage |
| `index.html` | 详情面板 Overview 渲染 stage 时追加天数；Health Card 渲染追加天数行 |
| MD 格式 | 新增 `**Stage History:**` 一行 |

---

## Feature 4: 季度目标追踪（Quarterly Target）

### 定位

让销售在 Dashboard 直观看到：本季度目标多少、已关单多少（达成 KPI）、跟进中加权管线多少、缺口多大。支持销售在页面上直接增删改季度目标。

### 数据存储

项目根目录新增 `targets.md`：

```markdown
# Quarterly Targets

**2026-Q2:** 500
**2026-Q3:** 800
```

纯数字，单位 USD 万。通过 UI 编辑后由 API 覆盖写入。

### Opportunity.md 新增字段

```markdown
- **Target Close:** 2026-Q3
```

- 用于判断该 opp 的预算归属哪个季度
- 没有填的 opp 不参与季度匹配
- 可编辑字段：季度选择器（年份 + Q1-Q4）

### API 变更

| 端点 | 变更 |
|------|------|
| `GET /api/summary` | 返回新增 `quarterly` 对象 |
| `PUT /api/targets` | 新增端点，接收 `{targets: [{quarter, amount}]}` 覆盖写入 targets.md |
| `parseOpportunityMd` | 新增 `**Target Close:**` 正则 |
| `generateOpportunityMd` | 模板追加 Target Close 字段 |
| `updateOpportunity` | 支持 Target Close 字段更新 |

**`/api/summary` 新增 `quarterly` 结构：**

```js
quarterly: {
  current: "2026-Q3",
  target: 800,           // targets.md 中当前季度
  won: 150,              // archive.won 中 targetClose === 当前季度的预算之和
  pipeline: 320,         // 活跃 opp 中 targetClose === 当前季度的 budget × probability
  gap: 330,              // target - won - pipeline
  targets: [{quarter: "2026-Q2", amount: 500}, {quarter: "2026-Q3", amount: 800}]
}
```

### Dashboard 展示

KPI 卡片区新增季度目标卡片：

- 进度条：`won / target` 比例填充
- 数字行：`已达成 150万 / 目标 800万`
- 下方三行：
  - `已关单: 150万`（绿色）
  - `跟进中: 320万`（黄色，加权管线）
  - `缺口: 330万`（红色）
- 卡片右上角编辑按钮（铅笔图标），点击进入编辑模式：
  - 显示已录入的季度列表（每行：季度标签 + 金额输入框 + 删除按钮）
  - 底部 "+ 添加季度" 按钮，新增一行空行
  - 保存按钮调 `PUT /api/targets`，取消则还原
- 点击卡片展开下钻：当前季度的 opp 列表，Won 标绿，跟进中标黄，无 Target Close 标灰

### 三件套同步

| 组件 | 改动 |
|------|------|
| **Parser** | `parseOpportunityMd` 新增 `**Target Close:**` 正则 |
| **Generator** | `generateOpportunityMd` 模板追加 Target Close 字段 |
| **Renderer** | 详情面板 Overview 区新增 Target Close 可编辑字段（年份 + Q1-Q4 下拉）；Dashboard KPI 区新增季度目标卡片 |
| **新增** | `parseTargetsMd()` 读取 targets.md；`PUT /api/targets` 端点 |

### 改动范围

| 文件 | 改动 |
|------|------|
| `server.js` | parser/generator 新增 Target Close；新增 parseTargetsMd；新增 PUT /api/targets；summary 返回 quarterly |
| `index.html` | 详情面板 Target Close 字段；Dashboard 季度目标卡片（含编辑交互） |
| `targets.md` | 新增文件（项目根目录） |
| MD 格式 | Opportunity.md 新增 `**Target Close:**` 一行 |
