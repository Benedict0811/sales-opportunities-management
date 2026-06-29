---
name: weekly-report-polish
description: "将02-WeeklyReports目录下导出的原始周报MD文件重新整理为销售例会汇报材料。第一部分：AI Token业务漏斗总览；第二部分：云转售商机覆盖表格。全链路闭环追踪，输出全中文Markdown（客户名/产品名/商机名保留英文）。"
---

# 销售周报整理 — 例会汇报材料生成

核心工作方式：**以已导出的原始周报 MD 文件为主输入，通过解析文件内容提取所有信息**，重新组织为销售例会可直接使用的汇报材料。

## 适用场景

当用户要求：
- 整理/梳理/优化/润色 周报
- 准备销售例会材料
- 查看这周的汇报内容
- 对比上周进展
- 生成汇报用的周报
- 准备周会PPT素材

## 语言规范

**输出全中文**，以下内容保留英文原文：
- 客户公司名：Softspace, NexusTech, HealthBridge 等
- 产品名：Open AI, GCP, Azure, Kingsoft Cloud, Starflow, Gemini 等
- 商机名：Softspace-Open AI, GCP Migration 等
- 专有技术术语：Lambda, Cloud Run, DynamoDB, Firestore, IoT Hub 等

其余所有标题、标签、状态描述、叙事语句均用中文。

## 工作流程

### 第一步：定位并读取原始周报 MD 文件

```bash
# 列出所有已导出的周报
ls -t "02-WeeklyReports/"*.md
```

读取用户指定日期范围对应的文件，或默认取最新一份。

文件命名规则：`Weekly Report - <起始日期> ~ <结束日期>.md`

**这是主数据来源。** 原始周报已包含所有商机信息：
- AI Token 部分：每个商机的 Budget、Stage、This Week Progress（会议议程）、Risks、Requirements
- Cloud 部分：同上结构

### 第二步：如需补充漏斗数据，调取 API（补充手段）

原始周报中**已包含** Budget、Stage 信息，可直接统计漏斗。但以下情况需要 API 补充：

- **已成单客户数**：原始周报只包含活跃商机，archive 数据需从 API 获取
  ```bash
  curl -s http://localhost:3000/api/summary
  ```
  从 `archive.won` 中筛选 need 为 AI Tokens 的记录

- **逾期行动项详情**：原始周报的 action items 可能在 meeting notes 中但不在周报摘要里
  ```bash
  curl -s http://localhost:3000/api/opportunities
  ```
  从 meetings.actionItems 获取 owner、due、status

如果服务器未运行，先启动：`cd "<项目目录>" && node server.js &`

### 第三步：查找上周报告（用于闭环对比）

取当前报告的前一个文件作为对比基线。如没有上周报告，闭环部分标注"本期为首份报告"。

### 第四步：按以下模板生成汇报材料

---

## 输出模板

```markdown
# 销售周报 — <日期范围>

---

## 一、AI Token 业务漏斗总览

| 指标 | 本周 | 上周 | 变化 |
|------|------|------|------|
| AI Token 相关客户总数 | X | Y | +1 |
| 已成单客户 | A | A | — |
| 跟进中客户 | B | C | -1 |
| 商务流程中（Verbal Commit） | D | D | — |
| 测试中（Proposal + Negotiation） | E | F | +1 |
| 建联沟通中（Discovery） | G | H | — |

> **客户总数** = 已成单 + 跟进中（去重客户）
> **已成单客户** = archive/Won 中 need 为 AI Tokens 的商机数量
> **跟进中客户** = 原始周报 AI Token Opportunities 部分列出的去重客户数
> **商务流程中** = 跟进中且 stage 为 Verbal Commit
> **测试中** = 跟进中且 stage 为 Proposal 或 Negotiation
> **建联沟通中** = 跟进中且 stage 为 Discovery

**本周变化要点：**
- <简要描述各层数量变化>
- <如有客户在漏斗中流动，说明从哪层到哪层>

---

## 二、云转售（PPL）商机覆盖

| 客户/商机 | 售卖产品 | 月收入预估/USD万 | 本周进展 | 下周计划 | 业务风险/所需支持 |
|-----------|----------|------------------|----------|----------|-------------------|
| SkyMedia / GCP Migration | GCP | 66.7 | · 06-10 完成GCP成本模拟评审，确认迁移分阶段方案<br>· 06-10 就POC范围达成一致，Lambda迁移路径明确<br>· 06-19 POC CDN性能达标，Cloud Run迁移测试通过<br>· 06-19 提案结构定稿，准备董事会汇报 | | · **差距**：多区域部署架构待确认<br>· **差距**：DynamoDB → Firestore 无自动迁移工具<br>· **风险**：AWS 可能提供修订报价（无缓解措施）<br>· **风险**：董事会可能要求进一步降价（备选：弹性分层+5年TCO） |
| PetroEdge / Azure IoT Platform | Azure | 100.0 | · 06-12 完成参考架构评审，实地了解物理约束<br>· 06-12 讨论 Digital Twins 炼厂仿真方案<br>· 06-12 审核安全合规框架 | | · **差距**：IEC 62443 合规差距（无缓解措施）<br>· **风险**：工会担忧岗位替代（缓解：定位为人机协作）<br>· **逾期**：Anna 传感器清单已逾期12天 |

*(仅列出原始周报 Cloud Resell 部分的商机)*

---

## 三、闭环追踪（对比上周）

| 事项 | 上周状态 | 本周状态 | 变化 |
|------|----------|----------|------|
| <行动：完成GCP成本模拟> | 🔄 进行中 | ✅ 已完成 | ✅ 闭环 |
| <行动：Raj 文档化POC结果> | ⏳ 待办 | 🔴 延期 | ⚠️ 逾期 |
| <风险：AWS竞标> | 🔴 无缓解 | 🔴 无缓解 | 🔴 未处理 |
| <需求：多区域部署> | 🔴 差距 | ⏳ 待推进 | 🔄 推进中 |
| <行动：Anna 传感器清单> | 🔴 延期 | 🔴 延期 | 🔴 逾期12天 |

---

## 四、下周重点
- [ ] <最紧急的行动1>
- [ ] <最紧急的行动2>
- [ ] <最紧急的行动3>
```

---

## 解析原始周报 MD 文件 — 字段映射

原始周报的 MD 结构是标准化的，按以下规则提取：

### AI Token Opportunities 部分

原始格式：
```markdown
## AI Token Opportunities

**Summary:** Total 4 AI Token opportunities — Won: 1, Pipeline: 3

### Product: Open AI

#### Softspace — Softspace-Open AI

- **Budget:** 30K
- **Stage:** Proposal

**This Week Progress:**
2026-06-15 — Discovery call with softspace management
  - Kingsoft cloud company intro
  - Kingsoft cloud proposed solution - ai tokens - open ai
  - AI tokens usecase in fintech industry
  - Vibe coding scenario
  - Get to understand customer pain point

**Risks:**
- 2026-06-15 Discovery call ...: azure doesnt have GPT5.5 ... (Mitigation: (no mitigation yet))

**Requirements:**
- 2026-06-15 Discovery call ...: Data residency must within malaysia DC [Gap]
- 2026-06-15 Discovery call ...: 1st byte per token retrieve must less than 1ms [Confirmed]
```

映射关系：

| 汇报字段 | 原始周报来源 | 提取规则 |
|----------|-------------|----------|
| 客户/商机 | `#### <客户> — <商机>` | 取 `—` 前后分别作为客户名和商机名 |
| Budget | `- **Budget:** <值>` | 直接取值 |
| Stage | `- **Stage:** <值>` | 直接取值，用于漏斗分层 |
| 本周进展 | `**This Week Progress:**` 下的议程 | 每个日期标题取一行，下属议程提炼为核心动作 |
| 业务风险 | `**Risks:**` 下的条目 | 提取 risk 文本和 mitigation，按差距/逾期/风险分类 |
| 业务需求 | `**Requirements:**` 下的条目 | 提取 [状态] 标签：Gap→差距，Confirmed→已确认，Open→待推进 |

### Cloud Resell 部分

原始格式同 AI Token，解析规则一致。唯一区别是这部分的数据映射到**云转售商机覆盖表**。

---

## 第一部分：AI Token 业务漏斗总览 — 计算规则

从原始周报 MD 文件直接提取：

1. **汇总行**：`**Summary:** Total X AI Token opportunities — Won: Y, Pipeline: Z`
   - 此行的 Won 值即为已成单客户数（但如 archive 中有更多 won，需通过 API 补充）
2. **统计 stage 分布**：遍历每个商机下的 `- **Stage:** <值>`，按以下分层计数：
   - Verbal Commit → 商务流程中
   - Proposal 或 Negotiation → 测试中
   - Discovery → 建联沟通中
3. **跟进中客户总数** = 去重统计所有 AI Token 商机的客户名
4. **客户总数** = 已成单 + 跟进中

---

## 第二部分：云转售商机覆盖表 — 填写规则

每个 Cloud 商机一行：

### 客户/商机
`<客户名> / <商机名>`，从 `#### <客户> — <商机>` 提取

### 售卖产品
取 `- **Product:**` 或从标题 `### Product: <值>` 提取

### 月收入预估/USD万
取 `- **Budget:** <值>`，直接作为月收入预估，单位统一为 USD万，保留一位小数：

- `$800K` → 800 × 1,000 = $800,000 → **80.0** 万USD
- `$1.2M` → 1.2 × 1,000,000 = $1,200,000 → **120.0** 万USD
- `¥5M` → ¥5,000,000 → 汇率÷7 ≈ $714K → **71.4** 万USD
- `30K`（无$符号，默认USD）→ 30 × 1,000 = $30,000 → **3.0** 万USD
- `320k`（无$符号，默认USD）→ 320 × 1,000 = $320,000 → **32.0** 万USD
- 关键：K = ×1,000，M = ×1,000,000，不能把 K 前的数字直接当"万"用
- budget 本身即代表月预估收入，不需要除以 12

### 本周进展
从 `**This Week Progress:**` 提取每个会议的议程列表，重新组织：
- 格式：`· 日期 提炼后的核心动作`
- 同一天多个议程合并为一行
- **中文化 + 动作词提炼**（参见下方叙事规则）
- 无会议则填"本周无新会议"

### 下周计划
**留空**，由销售填写。

### 业务风险/所需支持
从该商机的 `**Risks:**` 和 `**Requirements:**` 提取，重新组织：
- **差距**（Requirements 中 [Gap]）：`· **差距**：需求描述`
- **风险**（Risks）：`· **风险**：风险描述（缓解措施 / 无缓解措施）`
- **逾期**（从 Risks 中 `(no mitigation yet)` 或 Actions 推断）：`· **逾期**：描述`
- **待确认**（Requirements 中 [Open]）：`· **待确认**：需求描述`
- 按严重程度排序：差距 > 逾期 > 无缓解风险 > 有缓解风险 > 待确认

---

## 叙事规则

### 进展提炼
不要照抄议程列表，要提炼为核心动作：

原始：
```
- Review GCP cost simulation results
- Discuss migration phasing for Lambda workloads
- Agree on POC scope for CDN migration
- Timeline and procurement next steps
```

提炼后（中文）：
```
· 06-10 完成GCP成本模拟评审，确认迁移分阶段方案，就CDN迁移POC范围达成一致
· 06-10 明确采购时间线与下一步流程
```

### 动作词库
- **完成** — 已交付、已出具、已产出
- **确认** — 达成一致、获得认可、锁定
- **推进** — 启动、着手、进行中
- **讨论** — 沟通、交流、协商
- **提交** — 发送、提供、交付

### 简洁原则
- 每条进展 20-40 字
- 同一天议程合并
- 有数字就写数字

---

## 闭环追踪逻辑

对比两份周报 MD 文件中的同名商机，匹配行动项/风险/需求：

### 匹配方式
按商机名 + 关键词前20字符模糊匹配

### 状态变化判定

| 类别 | ✅ 闭环 | 🔄 推进中 | ⚠️ 退步 | 🔴 逾期/未处理 |
|------|--------|----------|---------|---------------|
| 行动 | Open→Completed | Open→In Progress | Open→Delayed | Open→Open(且过期) |
| 风险 | 无缓解→有缓解 | 缓解已提出 | — | 无缓解→无缓解 |
| 需求 | Open→Confirmed | — | Open→Gap | — |

### 新增判定
本周出现但上周没有的条目，标注"— 新增"

---

## 保存规则

```
02-WeeklyReports/销售周报 - <日期范围>.md
```

示例：`02-WeeklyReports/销售周报 - 2026-06-01 ~ 2026-06-22.md`

与原始导出文件同目录，文件名前缀改为"销售周报"以区分。

---

## 注意事项

- **主输入是原始周报 MD 文件**，API 仅作补充（archive 数据、详细 action items）
- 所有状态图标使用 emoji：🔴 🟡 🟢 ⏳ 🔄 ✅ ⚠️
- 商机本周无会议也要出现（进展填"本周无新会议"）
- 下周计划列始终留空
- 客户联系人/参会人等人名保持原样
- AI Token 总览在前，云转售覆盖表在后
- 无 Cloud 商机时第二部分写"本期无云转售商机"
