# 销售商机管理系统 — 踩坑经验与注意事项

> 供团队成员参考，避免重复踩坑。基于实际开发过程中的问题总结。

---

## 一、数据格式三件套必须同步

系统没有数据库，所有数据存在 Markdown 文件里。`server.js` 用正则解析 MD，任何格式改动涉及三个地方：

1. **解析器**（`parse*Md` 函数）— 正则匹配 MD 文本提取字段
2. **生成器**（`generate*Md` 函数）— 把字段写回 MD 文本
3. **渲染器**（`index.html` 中的渲染函数）— 把解析后的数据展示到界面

**踩坑：** 只改了其中一个，另外两个就会对不上。比如改了 Opportunity.md 的字段格式但没改解析正则，API 就会返回空值；改了生成器输出格式但没改渲染器，界面就会显示错乱。

**正确做法：** 改任何 MD 格式前，先 grep 三个关键词（如 `Budget`），确认 parser/generator/renderer 三处都覆盖到。改完后手动编辑一个 MD 文件，确认 API 返回正确、界面显示正确。

---

## 二、need 字段值是精确匹配

`need` 字段只接受两个值：`AI Tokens` 和 `Cloud`。不是 "AI Token"（少 s）、不是 "ai tokens"（小写）、不是 "云"。

**踩坑：** 手动编辑 MD 写了其他值，周报漏斗统计就会遗漏该商机。

**正确做法：** 创建或更新商机时，need 字段只能写 `AI Tokens` 或 `Cloud`。前端下拉框已限制，但直接编辑 MD 时要注意。

---

## 三、Stale 判定的细节

商机"过期"判定不是简单看 updated 字段，而是综合多个来源取最近日期：

- `updated` 字段
- 所有会议的 `Date` 字段
- 所有 action item 的 `due` 日期
- 所有 requirement 的 `due` 日期

取这些日期中最新的一个，如果距今超过 20 天就标为 Stale。

**踩坑：** 把 `updated` 字段或 action item / requirement 的 due date 也算进"最近活动"，导致编辑商机字段就刷新 stale 状态，或远期 due date 让本应 stale 的商机显示为活跃。

**正确做法：** Stale 判定按以下规则：
- **有会议记录**：取 timeline 上最近的会议日期，距今天超过 20 天 → stale
- **无会议记录**：取 opportunity 的 `created` 日期，距今天超过 20 天 → stale
- 编辑商机字段不等于真实客户互动，远期 due date 也不代表近期有活动。`server.js` 和 `index.html` 里的 staleDays 阈值（当前=20）必须保持一致。

---

## 四、Delayed Action 的定义

一个 action item 算"Delayed"有两种情况：

1. `status === 'Delayed'` — 显式标记
2. `status === 'Open'` 且 `due < 今天` — 隐式逾期

**关键区别：** Gap 状态的需求不算 Delayed。Open 状态且 due date 在未来也不算 Delayed。只有 Open 且已过 due date 才算。

**踩坑：** 早期版本把所有非 Confirmed 的需求都标为 Delayed，导致仪表盘全是红色误报，销售不再信任告警。

**正确做法：** Delayed 只取 `status==='Delayed'` 或 `(status==='Open' && due < today)`，不要把 Gap 或未来的 Open 算进去。

---

## 五、Stage 变化触发归档

当商机 stage 设为 `Won` 或 `Lost` 时，server 会把整个商机文件夹从 `01-Opportunities/` 移动到 `03-Archive/` 目录下，同时生成 `Archive-Summary.md`。

**踩坑：** 这是文件移动操作，不可逆。有人误点 Won 按钮导致数据"消失"。

**正确做法：** 前端已加确认弹窗，但直接调 API 时要注意。误归档需手动把文件夹从 `03-Archive/` 移回 `01-Opportunities/`。

---

## 六、创建商机的依赖顺序

必须先创建客户，才能创建该客户的商机。API 会校验 client 是否存在于 `00-Clients/` 目录。

**踩坑：** 批量导入时先导商机后导客户，API 返回 400 "Client not found"。

**正确做法：** 批量导入先客户后商机。

---

## 七、周报整理的主输入是 MD 文件

`weekly-report-polish` skill 的主输入是 `02-WeeklyReports/` 下已导出的原始周报 MD 文件，不是 API 数据。

**踩坑：** 早期版本先调 API 拉全量数据再重新生成，但导出的 MD 已包含所有必要信息，重复调 API 导致数据与导出时不一致。

**正确做法：** 先读取原始 MD 文件解析，只在需要 archive 数据时才调 API 补充。

---

## 八、月收入预估换算

预算字段的 budget 直接代表月预估收入，不需要除以 12。单位统一为 USD万，保留一位小数：

- `$800K` → $800,000 → **80.0** 万USD
- `$1.2M` → $1,200,000 → **120.0** 万USD
- `¥5M` → ¥5,000,000 → ÷7 ≈ $714K → **71.4** 万USD
- `30K` → $30,000 → **3.0** 万USD
- K = ×1,000，M = ×1,000,000，不能把 K 前数字直接当"万"

**踩坑：** 早期规则误把 budget 当年收入再除以 12，导致 $800K 算成 6.7万（实际应为 80万）；更早版本把 800 直接当万做除法 → 66.7万（实际 $800K = 80万）。

**正确做法：** budget = 月预估收入。先解析 K/M 后缀转为绝对金额（USD），再转万，不需要除以 12。

---

## 九、全中文输出的边界

周报输出要求全中文，但以下内容**必须保留英文**：

- 客户公司名：Softspace, HealthBridge, OmniRetail 等
- 产品名：Open AI, GCP, Azure, Starflow, Gemini 等
- 商机名：Softspace-Open AI, GCP Migration 等
- 技术术语：Lambda, Cloud Run, DynamoDB, Firestore, IoT Hub 等

**踩坑：** 翻译公司名和产品名后，销售与客户沟通时出现歧义。技术术语翻译后无法搜索原文。

**正确做法：** 只翻译动作、状态、描述性文字，专有名词原样保留。

---

## 十、正则解析的脆弱性

`server.js` 用正则解析 MD，方便但脆弱：

- 字段顺序不能随便换（正则按行匹配）
- 多余空行可能打断匹配
- 列表项缩进变化会导致解析失败
- 表格分隔行 `|---|---|` 必须存在

**踩坑：** 手动编辑 MD 多了一个空格或少一个换行，解析返回空值但不报错，数据静默丢失。

**正确做法：** 手动编辑 MD 后，调 API 检查返回数据是否完整（如 `curl -s localhost:3000/api/opportunities`）。新字段追加在已有字段后面，不要调整顺序。

---

## 十一、仪表盘刷新机制

前端没有 WebSocket 或轮询，数据只在 `loadAll()` 调用时从 API 拉取。

**踩坑：** 两个人同时使用或一边浏览器操作一边编辑 MD 文件，界面数据不会实时更新。

**正确做法：** 这是单用户本地工具的设计取舍。如需多人协作，需加 WebSocket 或轮询。

---

## 十二、Skill 安装方式

两个 Skill 安装到 `~/.claude/skills/` 即可：

```
~/.claude/skills/sales-opp-management/SKILL.md
~/.claude/skills/weekly-report-polish/SKILL.md
```

**踩坑：** 放错了路径或改了文件夹名，skill 不会被加载。

**正确做法：** 把项目目录下的 `sales-opp-management/` 和 `weekly-report-polish/` 两个文件夹完整复制到 `~/.claude/skills/` 下，文件夹名和 SKILL.md 文件名都不要改。

---

## 十三、Win/Lose Rate 必须包含归档数据

归档的商机已从 `01-Opportunities/` 移到 `03-Archive/`，不会出现在活跃 `opportunities` 数组中。计算 Win Rate / Lose Rate 时必须从 `summaryData.archive.won/lost` 合并数据。

**踩坑：** 早期前端只统计活跃商机中 stage 为 Won/Lost 的，但归档后这些商机已不在活跃列表，导致 fWon 和 fLost 永远为 0，Win Rate / Lose Rate 显示 0%。按客户筛选时同样要对 archive 列表做 client 过滤，否则筛选 NexusTech 后 Win Rate 仍显示 0。

**正确做法：** 前端 renderDashboard 中：
```
fWon = 活跃商机中Won数量 + archive.won按客户筛选后的数量
fLost = 活跃商机中Lost数量 + archive.lost按客户筛选后的数量
fWinRate = fWon / (fWon + fLost) * 100
fLoseRate = fLost / (fWon + fLost) * 100
```
确保归档数据参与计算，且按客户筛选时同步过滤。

---

## 十四、Probability 不能为空

Opportunity.md 模板不含 `Probability` 字段，如果解析为空，前端 Closing Urgency 里所有商机的概率标签全部显示 0%。

**踩坑：** 早期 server.js 对空 probability 直接返回空字符串，前端 `parseInt('')` 得到 0，导致 Closing Urgency 卡片全部显示红色 0%。

**正确做法：** 在 server.js 的 `listOpportunities` 中，当 `Probability` 字段为空时，根据 Stage 自动推断概率：
```js
probability: parsed.fields.Probability || ({Discovery:'10%',Proposal:'30%',Negotiation:'60%','Verbal Commit':'85%'}[parsed.fields.Stage]||'0%')
```
如果 MD 中手动填写了 `**Probability:**` 则优先用手动值，否则按 Stage 查表自动填充。

---

## 十五、Contacts 必须同步到 Stakeholders

创建商机时自动从客户 contacts 初始化 stakeholders，否则所有商机 stakeholders 全部显示 TBD。已有商机可通过 `POST /api/opportunities/:id/sync-contacts` 增量同步。

**踩坑：** 早期创建商机时只放了一行 TBD 占位，客户已经有联系人但没关联过来，销售要手动复制粘贴。

**正确做法：** `generateOpportunityMd` 接受 stakeholders 参数，创建时传入客户 contacts。sync 端点追加新联系人 + 清理 TBD 占位行。

---

## 十六、Stakeholder Influence/Attitude 必须可点击调整

如果只是纯文本，销售无法在界面上直接修改，必须用 prompt 弹窗才能编辑，体验差。

**踩坑：** 早期 Influence/Attitude 在表格里只是纯文本，无法直接点击调整。

**正确做法：** 渲染为可点击的彩色徽章，点击循环切换（Influence: High→Medium→Low→High; Attitude: Champion→Supporter→Neutral→Skeptic→Champion），点击即保存。

---

## 十七、Resources 页面 Markdown 渲染

点击文档展开后直接显示原始 Markdown（含 #、**、|---| 等符号），不适合阅读。

**踩坑：** 早期用 `white-space:pre-wrap` + `escHtml()` 直接输出原始文本，大量符号干扰阅读。

**正确做法：** 用 `md2html()` 将 Markdown 转为格式化 HTML（标题、粗体、表格、列表、行内代码），应用在 `openResourceDetail` 和 `openMeetingResource`。

---

## 十八、Next Action 结构化存储

Next Action 字段改为结构化格式 `计划内容 — by yyyy-mm-dd — [Planned|In Progress|Done]`，而非纯自由文本。

**踩坑：** 早期 Next Action 只是一行纯文本 contenteditable，日期混在文字里靠正则提取，状态无法区分。Dashboard 时间线排序依赖 `by yyyy-mm-dd` 正则，格式不对就遗漏。

**正确做法：** server.js 解析 MD 时自动提取 `nextActionDue`（日期）和 `nextActionStatus`（状态）字段返回 API。前端渲染为三部分：可编辑计划文本、日期选择器、可点击状态徽章。保存时三者合并为单个 `Next Action` 字段写入 MD，保证 parser/generator/renderer 三件套同步。状态只设3个（Planned/In Progress/Done），避免过度分类。

---

## 十九、销售周报专用渲染

销售周报（`销售周报 - *.md`）用通用 `md2html()` 渲染时表格拥挤、字号小、长内容挤在一起，可读性差。

**踩坑：** 早期直接套用通用 `md2html()`，12px 字号 + 简单表格，云转售宽表挤成一团，闭环追踪表无视觉区分。

**正确做法：** 新增 `renderSalesReport()` 专用函数，优化：表格带表头背景色/隔行变色/宽表自动横滚/第一列加粗宽列、二级标题按章节序号着色带左边框装饰条、引用块解析为带左边框的提示框、复选框列表渲染为 checkbox 样式、字号 13px + 宽行距 1.8。

---

## 二十、周报标题解析兼容

`server.js` 的 `parseWeeklyReportMd` 只匹配 `# Weekly Report -`，导致中文销售周报 `# 销售周报 —` 无法提取标题和日期范围。

**踩坑：** 销售周报列表卡片显示空标题，详情面板也缺少日期信息。

**正确做法：** 正则改为 `/^# (?:Weekly Report|销售周报)[ -]+(.+)/m`，同时支持英文 `-` 和中文 `—` 分隔符，并在捕获后去除前导 `— ` 前缀。

---

## 二十一、Stale 无会议时用 created date

早期逻辑：没有会议记录的商机直接判定为 stale，不管创建时间。但刚创建几天的商机没有会议属正常，不应标 stale。

**踩坑：** 新建商机（created 06-24，仅 1 天前）因为没有会议直接被标 stale，告警泛滥，销售忽略真正过期的商机。

**正确做法：** Stale 判定分两路：
- **有会议记录**：取最近会议日期，距今天 >20 天 → stale
- **无会议记录**：取 `created` 日期，距今天 >20 天 → stale
- `server.js` 和 `index.html` 的 `getLastActivityDate` 都需同步此逻辑

---

## 二十二、版本升级 Skill 必须同步缺失 skill

同事旧版本文件夹里没有 `version-upgrade/` skill 目录，升级后如果不同步，同事下次无法使用该 skill 进行升级。

**踩坑：** 早期升级流程只覆盖已有的 skill 目录，不检查新增的 skill，导致同事环境缺 skill。

**正确做法：** Step 5 "复制新增文件与 skill" 中明确：即使旧版本完全缺少某个 skill 目录（如 `version-upgrade/`），也必须从新版本整体复制。Important Rules 第 9 条同步约束。

---

## 二十三、客户筛选芯片需多页面统一

当客户数量增多后，Resources、Activity、Requirements 页面也需要按公司过滤，否则信息过载难以定位。

**踩坑：** 早期只有 Dashboard 有客户筛选，其他页面只能全文滚动查找。

**正确做法：** 复用 Dashboard 的芯片模式（`chipCls` 全局函数），在 Resources、Activity（meetings tab）、Requirements 页面顶部各加一行客户筛选芯片。筛选值用 `window._resFilter` / `window._actFilter` / `window._reqFilter` 独立存储。切换视图时在 `switchView()` 中重置非当前页的筛选，避免切回看到空列表。
