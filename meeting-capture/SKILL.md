---
name: meeting-capture
description: "从销售手写会议纪要中提取结构化数据，匹配对应商机，创建或更新会议纪要MD文件。自动提取title、date、venue、attendees、agenda、requirements、risks、actions、questions，识别所属opportunity，已存在则补充更新，不存在则新建。"
---

# Meeting Capture — 会议纪要录入助手

从销售手动整理的会议纪要中提取结构化数据，自动匹配商机并创建/更新会议纪要 MD 文件。

## When to Apply

当用户说类似以下内容时触发：

### Must Use

- "帮我录入这次会议纪要" + 纪要内容
- "record meeting notes: ..."
- "把这次会议记录写到 SOM 里"
- "capture these meeting minutes"
- "录入 Softspace 的会议纪要"
- "我把今天的会议笔记整理一下，帮我录入"

### Recommended

- "我刚和 PetroEdge 开完会，记了这些..."
- "meeting recap for SkyMedia"
- "更新 Softspace 的 POC review 会议"

### Skip

- 会前准备（用 meeting-prep）
- 整理周报（用 weekly-report-polish）
- 操作 CRM 数据（用 sales-opp-management）
- 不含会议纪要内容的请求

## Setup

在执行任何操作前，确保 inbox 目录存在，然后检查并启动服务器：

```bash
# Step 0: Ensure inbox directories exist
mkdir -p "00-Inbox/done"

# Step 1: Check
curl -s http://localhost:3000/api/summary > /dev/null 2>&1

# Step 2: If failed, start server
cd "/Users/admin/documents/Sales Opportunies Management" && node server.js &

# Step 3: Verify after 2 seconds
sleep 2 && curl -s http://localhost:3000/api/summary | head -c 20

# Step 4: If still failing, report error
```

## Input

用户的输入包含两部分：

1. **商机/客户指示**（可选）："帮我录入 Softspace 的会议纪要"
2. **会议纪要内容**（必须）：粘贴的原始笔记文本，或文件路径

笔记来源（按优先级）：

1. **`00-Inbox/` 目录**（推荐）— 把原始会议笔记丢到项目根目录的 `00-Inbox/` 文件夹，skill 自动扫描处理：
   - 文件格式：`.txt`、`.md`、`.docx`（Word）、`.pdf`
   - 命名无要求，文件名不影响提取
   - 处理完成后自动将文件移到 `00-Inbox/done/` 子目录，避免重复处理
2. **直接粘贴** — 在对话中粘贴笔记文本
3. **本地文件路径** — 如 `/Users/admin/Downloads/meeting-notes.docx`
4. **钉钉/WPS 文档链接** — 用对应 MCP 工具获取内容

如果用户给文件路径或链接，先用对应工具读取内容。
如果用户只说"帮我录入会议纪要"而未指定内容，扫描 `00-Inbox/` 目录找未处理文件：

```bash
ls "00-Inbox/"*.md "00-Inbox/"*.txt "00-Inbox/"*.docx "00-Inbox/"*.pdf 2>/dev/null | head -10
```

多文件时列出供用户选择，或逐个处理。

### Word (.docx) 文件处理

对于 `.docx` 文件，使用 macOS 内置的 `textutil` 转换为纯文本后提取：

```bash
textutil -convert txt -stdout "00-Inbox/<filename>.docx"
```

如果 `textutil` 不可用（非 macOS），尝试 `pandoc`：

```bash
pandoc -t plain "00-Inbox/<filename>.docx" 2>/dev/null
```

两者都不可用时告知用户手动将 Word 文件另存为 `.txt` 后放入 `00-Inbox/`。

### PDF 文件处理

对于 `.pdf` 文件，使用 `pdftotext` 提取纯文本：

```bash
pdftotext -layout "00-Inbox/<filename>.pdf" -
```

`-layout` 参数保留原始排版结构，有助于识别表格和列表。如果 `pdftotext` 不可用，尝试 Python：

```bash
python3 -c "
import sys
try:
    import fitz
    doc = fitz.open(sys.argv[1])
    for page in doc:
        print(page.get_text())
except ImportError:
    print('ERROR: neither pdftotext nor PyMuPDF available', file=sys.stderr)
    sys.exit(1)
" "00-Inbox/<filename>.pdf"
```

两者都不可用时告知用户手动将 PDF 另存为 `.txt` 后放入 `00-Inbox/`。

`.pdf` 文件处理完成后同样移入 `00-Inbox/done/`（原 `.pdf` 文件）。

## Step 1: Extract Structured Data from Raw Notes

从原始笔记中提取以下字段。**必须从文本实际内容推断，不编造不存在的数据。**

**关键规则：无论原始笔记是什么语言，提取后所有结构化内容必须转成英文写入 MD 文件。** 以下内容除外，保留原文：
- 中文人名：如 张伟、李明（不翻译为 Zhang Wei, Li Ming）
- 无通用英文名的产品中文名：如 金山文档（不翻译，WPS 365 则直接用英文）
- 客户公司名/产品名/商机名/技术术语：按 Language Rules 保留英文

### Title
- 如果笔记中有明确会议主题/标题 → 提取并**翻译为英文**
- 如果没有 → 根据讨论内容生成简短英文标题（5-8个词），如 "POC Result Review"、"Pricing Negotiation Follow-up"
- 始终英文标题，首字母大写

### Date
- 如果笔记中有日期 → 解析为 `yyyy-mm-dd`
- 如果只有"今天"/"yesterday" → 转换为对应日期
- 如果无法确定 → 询问用户

### Venue
- 如果笔记提到线上（Zoom/Teams/online/线上/视频会议）→ `venueType: "Online"`
- 如果笔记提到线下（办公室/会议室/现场/office/physical）→ `venueType: "Physical"`
- 如果有具体链接/地址 → 同时提取 `venueDetail`
- 如果无法判断 → 默认 `"Online"`

### Attendees
- 从笔记中提取所有参会人员姓名和角色（如有）
- 格式：逗号分隔字符串 `"Ali(CTO), Abu(CEO), 张伟(运维经理), Sam"`
- 中文人名保留中文原文，英文名保留英文
- 如果角色不明确，只写名字不加括号
- 如果笔记未提及参会人 → 设为 `"TBD"`

### Agenda
- 提取会议讨论的主要话题/议程项，**翻译为英文**
- 格式：字符串数组 `["Review POC testing scenarios", "Discuss data residency"]`
- 每个议程项简洁概括，5-12个词

### Requirements
- 任何表达为需求、必须满足、约束的陈述，**翻译为英文**
- 字段：`{ text: string, status: "Open"|"Confirmed"|"Gap", due: string }`
- Status 推断规则：
  - 明确确认的需求 → `"Confirmed"`
  - 目前无法满足的需求 → `"Gap"`
  - 讨论中但未确认 → `"Open"`（默认）
- Due 推断规则：笔记中提到时间线/截止日则提取，否则留空 `""`

### Risks
- 任何风险、阻碍、竞争威胁、延期隐患，**翻译为英文**
- 字段：`{ risk: string, mitigation: string }`
- 如果笔记提到了缓解措施 → 提取到 `mitigation`
- 如果没有 → 设为 `"(no mitigation yet)"`

### Action Items
- 任何任务、待办、承诺事项，**翻译为英文**
- 字段：`{ text: string, owner: string, due: string, status: string }`
- Status 推断规则：
  - 已完成 → `"Completed"`
  - 进行中 → `"In Progress"`
  - 延期 → `"Delayed"`
  - 默认 → `"Open"`
- Owner：笔记中明确指定了负责人则提取（中文人名保留中文），否则留空 `""`
- Due：笔记中提到截止日则提取，否则留空 `""`

### Questions
- 会议中提出但未回答的问题，**翻译为英文**
- 字段：`{ question: string, answer: string }`
- 如果有部分回答 → 提取到 `answer`
- 如果完全未回答 → `answer: "(open)"`

## Step 2: Identify the Opportunity

用提取的客户名/商机名匹配 SOM 中的商机：

```bash
curl -s http://localhost:3000/api/summary
```

从 `summaryData.opportunities[]` 中查找（排除 stage=Won/Lost 的归档商机）：

1. **精确匹配商机名**：`opp.fields.Opportunity` 包含提取的名称 → 直接选中
2. **匹配客户名**：`opp.fields.Client` 包含提取的客户名 → 可能多个
3. **模糊匹配**：同时匹配 `Client` 和 `Opportunity`

**歧义处理**：同一客户下有多个活跃商机时，列出所有匹配项并询问：

> Softspace 下有多个活跃商机，请确认这次会议属于哪个：
> 1. Softspace-Open AI (Discovery, 7d)
> 2. Softspace-Azure Migration (Proposal, 15d)
> 请输入序号：

**无法匹配**：如果无法从笔记中识别客户/商机，直接询问用户。

## Step 3: Check for Existing Meeting

确定商机后，检查该日期是否已有会议纪要文件：

```bash
ls "01-Opportunities/<oppId>/Meetings/"
```

查找文件名以 `<提取的日期>-` 开头的 MD 文件。

**结果判断**：

| 情况 | 操作 |
|------|------|
| 找到匹配日期的文件 | **更新模式** — 提取的 requirements/risks/actions/questions 追加到已有会议 |
| 未找到匹配文件 | **创建模式** — 调用 POST 创建新会议 |

## Step 4A: Create New Meeting（创建模式）

```bash
curl -s -X POST http://localhost:3000/api/opportunities/<oppId>/meetings \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "<title>",
    "date": "<date>",
    "attendees": "<attendees string>",
    "venueType": "<Online|Physical>",
    "venueDetail": "<detail or omit>",
    "agenda": ["<item1>", "<item2>"],
    "requirements": [{"text":"<text>","status":"Open","due":""}, ...],
    "questions": [{"question":"<q>","answer":"(open)"}, ...],
    "risks": [{"risk":"<risk>","mitigation":"(no mitigation yet)"}, ...],
    "actionItems": [{"text":"<text>","owner":"<owner>","due":"<due>","status":"Open"}, ...]
  }'
```

**必传字段**：`title`, `date`, `attendees`, `venueType`, `agenda`
**空数组不可省略**：`requirements`, `questions`, `risks`, `actionItems` 即使为空也必须传 `[]`

成功后：
- 中文：`会议已创建: <filename>`
- English: `Meeting created: <filename>`
- 如果来源是 `00-Inbox/` 文件，将文件移到 `00-Inbox/done/`（自动创建目录）

## Step 4B: Update Existing Meeting（更新模式）

更新模式的核心逻辑：**保留已有数据，追加新提取的内容**。

1. 从 `/api/summary` 获取该商机的所有会议数据，找到匹配文件的解析结果
2. 对每个结构化数组（requirements/risks/actions/questions），做**去重合并**：
   - 比较已有项和新提取项的 `text`/`risk`/`question` 字段
   - 如果已有项与新项相同（语义相同），跳过不重复添加
   - 如果新项不存在于已有数据中，追加到数组末尾
3. 如果原会议中有 TBD 占位符，**用提取的真实内容替换**：
   - Agenda 中的 `"TBD"` → 替换为提取的议程列表
   - Requirements 中的 `{text: "TBD", status: "Open", due: ""}` → 替换为提取的需求数组
   - 同理 Questions/Risks/Action Items 中的 TBD 占位项
4. 发送 PUT 请求更新

```bash
curl -s -X PUT "http://localhost:3000/api/opportunities/<oppId>/meetings/<filename>" \
  -H 'Content-Type: application/json' \
  -d '{
    "agenda": ["<existing+new items>"],
    "requirements": [<existing+new items>],
    "questions": [<existing+new items>],
    "risks": [<existing+new items>],
    "actionItems": [<existing+new items>]
  }'
```

**同时更新基本字段**（如果提取到的信息比现有更完整）：
- `attendees`：如果原来是 `"TBD"`，替换为提取的参会人
- `venue`：如果原来是 `"Online"` 但笔记明确是 Physical，替换

成功后：
- 中文：`会议已更新: <filename>，补充了 X 条需求、Y 条风险、Z 条行动项`
- English: `Meeting updated: <filename>, added X requirements, Y risks, Z action items`
- 如果来源是 `00-Inbox/` 文件，将文件移到 `00-Inbox/done/`

## Step 5: Confirm and Summarize

操作完成后，展示摘要：

```
## 会议纪要录入完成

| 字段 | 内容 |
|------|------|
| 商机 | <oppId> — <Opportunity Name> |
| 标题 | <title> |
| 日期 | <date> |
| 地点 | <venueType> — <venueDetail> |
| 参会人 | <attendees> |
| 议程 | <N> 项 |
| 需求 | <N> 条 (Open X, Confirmed X, Gap X) |
| 风险 | <N> 条 |
| 行动项 | <N> 条 (Open X, In Progress X, Completed X) |
| 问题 | <N> 条 (open X, answered X) |
| 模式 | 新建 / 更新补充 |
```

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

- **`00-Inbox/` 是原始笔记的收件箱**：把会议笔记文件丢进去，skill 处理完自动移到 `00-Inbox/done/`，避免重复处理
- **输出始终为英文**：无论源文件是中文、马来文还是其他语言，写入 MD 文件的所有结构化内容（title、agenda、requirements、risks、actions、questions）必须翻译为英文。例外：中文人名（张伟）、无通用英文名的产品中文名（金山文档）保留原文
- **提取必须忠于原文**：不编造笔记中未提及的需求、风险或行动项。如果笔记信息不足以提取某类数据，该类传空数组 `[]`
- **去重合并是关键**：更新已有会议时，不重复添加语义相同的已有条目
- **TBD 替换优先**：如果原会议有 TBD 占位，用真实内容替换，而非追加
- **filename 不可改**：PUT 接口不会重命名文件，即使 title/date 变了，文件名保持不变
- **attendees 是字符串**：POST body 中 `attendees` 是逗号分隔的单个字符串，不是数组
- **agenda 是字符串数组**：POST body 中 `agenda` 是 `string[]`
- **requirements 数组字段**：每项 `{text, status, due}`，status 只能是 `"Open"` / `"Confirmed"` / `"Gap"`
- **actionItems 数组字段**：每项 `{text, owner, due, status}`，status 可以是 `"Open"` / `"In Progress"` / `"Completed"` / `"Delayed"` / `"Cancelled"`
- **日期格式必须 yyyy-mm-dd**：否则文件名和 MD 内容格式错误
- **只处理单个商机**：一次只录入一个商机的会议，不跨商机聚合
- **数据来源用 summary**：`GET /api/summary` 已包含完整 opportunities+meetings 数据，无需额外调用
- **不存在 GET /api/opportunities/:id**：需从列表中过滤找到目标商机
