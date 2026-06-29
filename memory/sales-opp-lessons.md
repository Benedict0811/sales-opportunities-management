---
name: sales-opp-lessons
description: 项目开发踩坑经验和注意事项，供团队同事参考避免重复踩坑
type: feedback
originSessionId: d19071a4-3274-4fa1-a471-871f03ed2fda
---
# 销售商机管理系统 — 踩坑经验与注意事项

## 一、数据格式三件套必须同步

系统没有数据库，所有数据存在 Markdown 文件里。`server.js` 用正则解析 MD，任何格式改动涉及三个地方：

1. **解析器**（`parse*Md` 函数）— 正则匹配 MD 文本提取字段
2. **生成器**（`generate*Md` 函数）— 把字段写回 MD 文本
3. **渲染器**（`index.html` 中的渲染函数）— 把解析后的数据展示到界面

**Why:** 只改了其中一个，另外两个就会对不上。比如改了 Opportunity.md 的字段格式但没改解析正则，API 就会返回空值；改了生成器输出格式但没改渲染器，界面就会显示错乱。

**How to apply:** 改任何 MD 格式前，先 grep 三个关键词（如 `Budget`），确认 parser/generator/renderer 三处都覆盖到。改完后手动编辑一个 MD 文件，确认 API 返回正确、界面显示正确。

---

## 二、need 字段值是精确匹配

`need` 字段只接受两个值：`AI Tokens` 和 `Cloud`。不是 "AI Token"（少 s）、不是 "ai tokens"（小写）、不是 "云"。

**Why:** 周报漏斗统计、仪表盘筛选全部基于 `need` 字段做大小写不敏感匹配 `/ai\s*tokens?/i` 和 `/cloud/i`，但写入时用的是精确值。如果手动编辑 MD 写了其他值，漏斗统计就会遗漏。

**How to apply:** 创建或更新商机时，need 字段只能写 `AI Tokens` 或 `Cloud`。前端下拉框已经限制了这两个选项，但直接编辑 MD 文件时要注意。

---

## 三、Stale 判定的细节

商机"过期"判定不是简单看 updated 字段，而是综合多个来源取最近日期：

- `updated` 字段
- 所有会议的 `Date` 字段
- 所有 action item 的 `due` 日期
- 所有 requirement 的 `due` 日期

取这些日期中最新的一个，如果距今超过 20 天就标为 Stale。

**Why:** 销售可能长期没有会议，但 action item 有远期 due date，这种情况不算 stale。反过来，如果只看 updated 字段，手动编辑 MD 会刷新 updated，导致本应 stale 的商机不被标记。

**How to apply:** 判断 stale 时要看"最近有任何时间锚点"而非只看 updated。`server.js` 和 `index.html` 里的 staleDays 阈值（当前=20）必须保持一致。

---

## 四、Delayed Action 的定义

一个 action item 算"Delayed"有两种情况：

1. `status === 'Delayed'` — 显式标记
2. `status === 'Open'` 且 `due < 今天` — 隐式逾期

**关键区别：** Gap 状态的需求不算 Delayed。Open 状态且 due date 在未来也不算 Delayed。只有 Open 且已过 due date 才算。

**Why:** 早期版本把所有非 Confirmed 的需求都标为 Delayed，导致仪表盘全是红色误报，销售不再信任告警。需要精确区分"有差距但还没到截止"和"已逾期"。

**How to apply:** 写仪表盘逻辑时，Delayed 只取 `status==='Delayed'` 或 `(status==='Open' && due < today)`，不要把 Gap 或未来的 Open 算进去。

---

## 五、Stage 变化触发归档

当商机 stage 设为 `Won` 或 `Lost` 时，server 会把整个商机文件夹从 `01-Opportunities/` 移动到 `03-Archive/` 目录下，同时生成 `Archive-Summary.md`。

**Why:** 这是文件移动操作（`renameSync`），不可逆。如果误操作把 stage 改成 Won/Lost，文件夹就不再在活跃目录里了。早期有人误点 Won 按钮导致数据"消失"。

**How to apply:** 前端已加了确认弹窗（Win Deal / Lose Deal 按钮），但直接调 API 时要注意。如果误归档，需要手动把文件夹从 `03-Archive/` 移回 `01-Opportunities/`。

---

## 六、创建商机的依赖顺序

必须先创建客户，才能创建该客户的商机。API 会校验 client 是否存在于 `00-Clients/` 目录。

**Why:** 商机文件夹名包含客户名（`OPP-###-Client-Name`），如果客户不存在，文件夹结构和关联关系就会断裂。

**How to apply:** 创建商机前先确认客户已存在。批量导入数据时，先导入所有客户，再导入商机。

---

## 七、周报整理 Skill 的核心输入

`weekly-report-polish` skill 的主输入是 `02-WeeklyReports/` 下已导出的原始周报 MD 文件，不是 API 数据。

**Why:** 早期版本先调 API 拉全量数据再重新生成，但导出的 MD 文件已经包含了所有必要信息（Budget、Stage、Progress、Risks、Requirements），重复调 API 不仅多余，还可能因为数据更新导致与导出时不一致。

**How to apply:** 整理周报时先读取原始 MD 文件，只在需要 archive 数据（已成单客户数）时才调 API 补充。

---

## 八、月收入预估换算

预算字段（budget）格式不统一，换算月收入时要注意：

- `$800K` → 年收入 → 月收入 = 800/12 = 66.7 万USD
- `$1.2M` → 120万USD/年 → 月收入 = 10万USD → 写成 `100.0`
- `¥5M` → 需按汇率换算（约 1:0.14）→ 约 $0.7M/年 → 月收入约 5.8 万USD
- `30K` → 默认年度总额 → 月收入 = 30/12 = 2.5 万USD
- 单位统一为 **USD万**，保留一位小数

**Why:** 不同币种和格式混用时容易算错。早期版本直接把 $800K 写成 0.8，实际应该是月收入 66.7 万USD。

**How to apply:** 先判断币种，再判断是年还是总额，统一换算成月收入（USD万），最后保留一位小数。

---

## 九、全中文输出的边界

周报和 skill 输出要求全中文，但以下内容**必须保留英文**：

- 客户公司名：Softspace, HealthBridge, OmniRetail 等
- 产品名：Open AI, GCP, Azure, Starflow, Gemini 等
- 商机名：Softspace-Open AI, GCP Migration 等
- 技术术语：Lambda, Cloud Run, DynamoDB, Firestore, IoT Hub 等

**Why:** 翻译公司名和产品名会造成混淆，销售和客户沟通时用的就是英文名。技术术语翻译后无法搜索定位原文。

**How to apply:** 翻译时只翻译动作、状态、描述性文字，专有名词原样保留。

---

## 十、正则解析的脆弱性

`server.js` 用正则解析 MD，这很方便但也脆弱：

- 字段顺序不能随便换（正则按行匹配）
- 多余空行可能打断匹配
- 列表项缩进变化会导致解析失败
- 表格分隔行 `|---|---|` 必须存在

**Why:** 手动编辑 MD 文件时容易引入格式偏差（多一个空格、少一个换行），导致解析失败但不会报错，只会返回空值。

**How to apply:** 手动编辑 MD 后，调 API 检查返回数据是否完整（如 `curl -s localhost:3000/api/opportunities` 看字段是否齐全）。如果添加新字段，优先在已有字段后面追加，不要调整顺序。

---

## 十一、仪表盘刷新机制

前端没有 WebSocket 或轮询，数据只在 `loadAll()` 调用时从 API 拉取。`loadAll()` 在以下时机触发：
- 页面首次加载
- 视图切换
- 保存操作后（`saveOppField`、`saveMeetingField` 等）

**Why:** 如果两个人同时使用，或一个人在浏览器操作另一个人在编辑 MD 文件，界面数据不会实时更新。需要手动刷新页面才能看到最新数据。

**How to apply:** 这是单用户本地工具的设计取舍。如果未来需要多人协作，需要加 WebSocket 或轮询机制。

---

## 十二、Skill 安装方式

两个 Skill 都是文件夹形式，安装到 `~/.claude/skills/` 即可：

```
~/.claude/skills/sales-opp-management/SKILL.md
~/.claude/skills/weekly-report-polish/SKILL.md
```

**Why:** Claude 会自动扫描 `~/.claude/skills/` 下所有 SKILL.md 文件并加载。不需要注册或配置，放进去就行。

**How to apply:** 把项目目录下的 `sales-opp-management/` 和 `weekly-report-polish/` 两个文件夹复制到同事的 `~/.claude/skills/` 下。同事在对话中用自然语言即可触发 skill。

---

## 十三、Win/Lose Rate 必须包含归档数据

归档的商机已从 `01-Opportunities/` 移到 `03-Archive/`，不会出现在活跃 opportunities 数组中。计算 Win Rate / Lose Rate 时必须从 `summaryData.archive.won/lost` 合并数据。按客户筛选时也要对 archive 列表做 client 过滤。

**Why:** 早期前端只统计活跃商机中 stage 为 Won/Lost 的，但归档后这些商机已不在活跃列表，导致 fWon 和 fLost 永远为 0，Win Rate / Lose Rate 显示 0%。按客户筛选时同理。

**How to apply:** 前端 renderDashboard 中，fWon = 活跃Won + archive.won按客户筛选后的数量，fLost = 活跃Lost + archive.lost按客户筛选后的数量，再算比率。

---

## 十四、Probability 不能为空

Opportunity.md 模板不含 `Probability` 字段，如果解析为空，前端 Closing Urgency 里所有商机的概率标签全部显示 0%。

**Why:** 早期 server.js 对空 probability 直接返回空字符串，前端 `parseInt('')` 得到 0，导致 Closing Urgency 卡片全部显示红色 0%。

**How to apply:** 在 server.js 的 listOpportunities 中，当 `Probability` 字段为空时，根据 Stage 自动推断概率（Discovery=10%, Proposal=30%, Negotiation=60%, Verbal Commit=85%）。手动值优先。

---

## 十五、Contacts 必须同步到 Stakeholders

创建商机时自动从客户 contacts 初始化 stakeholders，否则所有商机 stakeholders 全部显示 TBD。已有商机可通过 `POST /api/opportunities/:id/sync-contacts` 增量同步。

**Why:** 早期创建商机时只放了一行 TBD 占位，客户已经有联系人但没关联过来，销售要手动复制粘贴。

**How to apply:** `generateOpportunityMd` 接受 stakeholders 参数，创建时传入客户 contacts。sync 端点追加新联系人 + 清理 TBD 占位行。

---

## 十六、Stakeholder Influence/Attitude 必须可点击调整

如果只是纯文本，销售无法在界面上直接修改 Influence/Attitude，必须用 prompt 弹窗才能编辑，体验差。

**Why:** 早期 Influence/Attitude 在表格里只是纯文本，无法直接点击调整。

**How to apply:** 渲染为可点击的彩色徽章，点击循环切换（Influence: High→Medium→Low→High; Attitude: Champion→Supporter→Neutral→Skeptic→Champion），点击即保存。

---

## 十七、Resources 页面 Markdown 渲染

点击文档展开后直接显示原始 Markdown（含 #、**、|---| 等符号），不适合阅读。

**Why:** 早期用 `white-space:pre-wrap` + `escHtml()` 直接输出原始文本，大量符号干扰阅读。

**How to apply:** 用 `md2html()` 将 Markdown 转为格式化 HTML（标题、粗体、表格、列表、行内代码），应用在 `openResourceDetail` 和 `openMeetingResource`。
