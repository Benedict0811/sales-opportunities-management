# Version Upgrade — Sales Opportunities Management

将旧版本的 Sales Opportunities Management 升级到新版本，只更新代码，不碰现有数据。

## When to Apply

当用户说类似以下的话时触发：
- "帮我升级到新版本"
- "把这个旧版本更新一下"
- "对比新版本代码，更新我的版本"
- "version upgrade"
- "升级销售管理系统"

## Prerequisites

用户需要提供两个路径：
1. **旧版本路径**（同事正在使用的版本，包含自己的客户/商机数据）
2. **新版本路径**（刚拿到的新版本包）

如果用户只提供了一个路径，主动询问另一个。

---

## Process

### Step 1: 识别新旧版本路径

确认两个路径都存在，且都是合法的 Sales Opportunities Management 目录（包含 server.js 和 index.html）。

```
旧版本: /path/to/Sales Opportunies Management-v1
新版本: /path/to/Sales Opportunies Management-v2
```

如果用户给的路径没有版本号后缀，也要正常处理。

### Step 2: 数据安全检查

在动手之前，先检查旧版本的数据情况：

1. 统计旧版本的数据文件：
   - `00-Clients/` 下有多少客户
   - `01-Opportunities/` 下有多少活跃商机
   - `01-Opportunities/` 下有多少会议纪要
   - `03-Archive/` 下是否有归档数据
   - `02-WeeklyReports/` 下是否有周报

2. 用中文向用户汇报数据概况，如：
   ```
   旧版本数据概况：
   - 5 个客户
   - 6 个活跃商机
   - 12 个会议纪要
   - 2 份周报
   - 归档：1 Won, 0 Lost
   ```

3. 明确告知：升级过程**不会修改任何数据文件**，只更新代码文件。

### Step 3: 分类文件

将项目文件分为三类：

**代码文件（需要从新版本覆盖到旧版本）：**
- `server.js`
- `index.html`
- `CLAUDE.md`
- `MANUAL.md`
- `LESSONS.md`
- `migrate.js`（如果新版本有）
- `memory/` 目录下的所有文件（项目记忆，保持新旧版本一致）

**数据目录（完全不碰）：**
- `00-Clients/` — 客户档案
- `01-Opportunities/` — 商机数据
- `02-WeeklyReports/`（或 `02-WeeklyReports/`）— 周报
- `03-Archive/` — 归档数据

**其他文件（视情况处理）：**
- `package.json` — 如果新版本有而旧版本没有，复制过去
- `.gitignore` — 如果新版本有而旧版本没有，复制过去
- skill 目录（`sales-opp-management/`, `weekly-report-polish/`, `version-upgrade/` 等）— 从新版本整体覆盖，确保 SKILL.md 的更新同步到同事环境

### Step 4: 展示变更摘要（Diff）

对每个代码文件，对比新旧版本的差异：

1. 用 `diff` 命令（或逐行对比）展示关键变更
2. 用中文总结每个文件的变更要点，例如：
   ```
   server.js 变更：
   - 新增 Next Action 状态字段解析
   - Venue 默认值从 TBD 改为 Online
   - 修复 stale 判定逻辑（只看会议日期）

   index.html 变更：
   - Next Action 字段改为结构化 UI（计划文本 + 日期 + 状态）
   - Stakeholders 新增 Sync 和可点击徽章
   - Resources 页面用 md2html() 渲染 Markdown

   CLAUDE.md 变更：
   - 新增 Next Action 格式说明
   - 更新 stale 判定规则
   ```

3. 如果新版本有新增文件（旧版本没有的），列出并说明用途

4. 询问用户是否确认应用这些变更。等待用户确认后才执行。

### Step 5: 执行升级

用户确认后：

1. **备份旧版本代码文件**：
   - 将旧版本的代码文件复制到 `旧版本路径/.backup-v{旧版本号}/`
   - 如果旧版本没有版本号，用日期作为标识：`.backup-2026-06-24/`

2. **覆盖代码文件**：
   - 从新版本复制代码文件到旧版本目录（server.js, index.html, CLAUDE.md, MANUAL.md, LESSONS.md 等）
   - 从新版本复制 `memory/` 目录到旧版本（覆盖已有文件，新增缺失文件）
   - 跳过所有数据目录
   - 如果旧版本有新版本没有的代码文件（被删除的），保留但标注

3. **同步 skill 目录**：
   - 将新版本的所有 skill 目录整体覆盖到旧版本：`sales-opp-management/`, `weekly-report-polish/`, `version-upgrade/` 等
   - **旧版本已有该 skill** → 用新版本整体替换（确保 SKILL.md 的更新同步过去）
   - **旧版本没有该 skill** → 整体复制过去（确保同事下次能直接使用）
   - 同步后旧版本的 skill 目录内容与新版本完全一致

4. **数据目录零操作**：
   - 明确跳过 00-Clients/, 01-Opportunities/, 02-WeeklyReports/, 03-Archive/
   - 在输出中确认这些目录未被修改

### Step 6: 版本号迭代

1. 读取新版本目录名或新版本 CLAUDE.md 中的版本号
2. 如果新版本路径包含版本号（如 `-v2`），提取版本号
3. 重命名旧版本文件夹，加上新版本号：

   ```
   之前: Sales Opportunies Management
   之后: Sales Opportunies Management-v2
   ```

4. 如果旧版本已经有版本号，替换为新版本号：
   ```
   之前: Sales Opportunies Management-v1
   之后: Sales Opportunies Management-v2
   ```

5. 如果无法确定新版本号，询问用户使用什么版本号

### Step 7: 验证升级

1. 进入升级后的目录
2. 启动 server.js（`node server.js`）
3. 调用 API 验证数据完整性：
   - `GET /api/clients` — 确认客户数据仍在
   - `GET /api/opportunities` — 确认商机数据仍在
   - `GET /api/summary` — 确认汇总数据正常
4. 向用户确认：
   ```
   升级完成验证：
   - 5 个客户数据完整
   - 6 个商机数据完整
   - 12 个会议纪要完整
   - 服务正常启动在 http://localhost:3000
   - 文件夹已重命名为: Sales Opportunies Management-v2
   ```

5. 关闭测试服务器

---

## Important Rules

1. **绝对不碰数据目录** — 00-Clients/, 01-Opportunities/, 02-WeeklyReports/, 03-Archive/ 只读不写
2. **备份先于覆盖** — 任何代码文件覆盖前先备份到 .backup 目录
3. **等用户确认** — 展示变更摘要后必须等用户确认才执行覆盖
4. **验证数据完整** — 升级后必须验证数据没有丢失
5. **中文输出** — 所有面向用户的信息用中文，代码/路径/命令保留英文
6. **保留英文专有名词** — 客户名、产品名、技术术语不翻译
7. **新版本的测试数据不迁移** — 如果新版本 01-Opportunities/ 下有 OPP-006-TestStaleCorp 之类的测试数据，不要复制到旧版本
8. **版本号管理** — 升级后必须更新文件夹版本号，方便后续追溯
9. **新增 skill 必须同步** — 如果旧版本缺少新版本中的 skill 目录（如 `version-upgrade/`），必须整体复制到旧版本环境中，确保同事下次也能用这个 skill 升级
