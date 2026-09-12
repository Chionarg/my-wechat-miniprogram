# 随即笔记 · 项目接管文档

> 本文档是今后 AI / 开发者接管本仓库的长期状态基线。  
> 来源：2026-09-12 只读代码审计。  
> 规则：**不要因为 UI 上出现按钮就认为功能已完成**；必须以实际调用链为准。  
> 本文档 **不得** 写入 API Key、AppSecret、Token 或其他密钥。云端密钥只存在于微信云开发环境变量中（代码里只出现变量名）。

---

## 1. 产品目标

把零散学习笔记和学习资料，整理成带分类、知识点和原文出处的知识大纲，并允许用户核对、编辑、增删。

当前代码体现的产品形态：

- 用户录入文字笔记，或导入学习资料（目前只实现了 TXT）。
- 用第三方 AI（DeepSeek，经云函数转发）把正文整理为：分类 → 知识点 → 原文出处编号。
- 程序先按段落切分原文（`P1` / `P2` / …），模型只能引用真实段落，不能编造出处。
- 大纲可展开阅读；知识点可看解释和原文；用户可修改、新增、删除、调整分类。
- 明确区分「AI 整理 / 用户已修改 / 用户新增」。
- 当前策略：**本机存储优先、不云同步、不自动重试 AI、开发测试阶段限制长度，并用 OPENID 白名单限制调用。**

仓库内没有 README 或独立需求文档。是否最终做账号、云同步、PDF/DOCX、复习系统，**尚未从代码确认**。

项目在开发者工具私有配置中的名称为「随即笔记」。`app.json` 的窗口标题仍是默认 `"Weixin"`。

---

## 2. 当前开发阶段

**中期功能原型 / 开发测试版，不是可上线产品。**

| 能力块 | 状态 |
|---|---|
| 文字笔记本地闭环 | 基本完成（真实功能） |
| 笔记 → AI → 大纲 → 知识点编辑 | 代码调用链完成；云端是否跑通 **需要验证** |
| TXT 资料导入与本地保存 | 完成（真实功能）；**未接入 AI** |
| 首页固定课程样例 / 演示大纲 | 演示功能，不是产品闭环 |
| 云数据库、账号、多端同步 | 未做 |
| PDF / DOCX | 未做（演示卡片上有文案） |

演示层与真实数据层 **并存**。后续开发必须先判断当前操作的是 Demo 还是本地真实数据。

---

## 3. 当前架构

无自定义 `components/`。无 TabBar。无云数据库调用。持久化只使用 `wx.setStorageSync`。

```
app.js (wx.cloud.init)
  └── pages/index 首页
        ├── pages/note          文字笔记（唯一调用 AI 的页面）
        ├── pages/file-test     选择并读取 TXT，保存为本地资料
        ├── pages/material      只读展示已保存 TXT
        ├── pages/outline       双模式：local 真实大纲 / 无参数 Demo
        │     ├── pages/knowledge   双模式：local 真实知识点 / id=auto Demo
        │     └── pages/add-point   向真实 AI 结构手动新增知识点
        └── pages/logs          微信模板残留，业务未使用
```

云函数目录 `cloudfunctions/`：

- `analyzeNote`：业务函数，前端有调用。
- `identityTest` / `networkTest` / `connectionTest`：连通性试验，**前端没有调用**。

---

## 4. 主要页面和文件职责

### 4.1 全局

| 文件 | 职责 |
|---|---|
| `app.js` | 启动时 `wx.cloud.init`。无登录、无全局笔记状态。 |
| `app.json` | 登记 8 个页面。窗口标题仍为 `"Weixin"`。无 tabBar。 |
| `app.wxss` | 模板 `.container` 样式，业务页基本不用。 |
| `project.config.json` | 小程序配置；`cloudfunctionRoot` 为 `cloudfunctions/`。 |
| `utils/util.js` | 模板时间格式化，仅 `pages/logs` 使用。 |

### 4.2 页面（真实 vs 演示）

| 路径 | 真实功能 | 演示功能 |
|---|---|---|
| `pages/index` | 列出本地笔记、本地 TXT 资料；新建笔记、打开笔记、打开 AI 大纲、删除笔记/资料；跳转文件导入测试 | 底部「固定演示资料」三张卡片（C++ PDF / GPIO 笔记 / 电路 DOCX） |
| `pages/note` | 新建/编辑/保存文字笔记；调用 `analyzeNote`；展示并本地保存 AI 结果 | 顶部 notice 仍写「不调用 AI」（文案过时，不是功能开关） |
| `pages/outline` | `?mode=local&noteId=` 读取该笔记的 `aiAnalysis`，折叠分类、新增分类、跳转知识点/新增知识点 | 无 query 时展示写死的「C++ 基础」大纲 |
| `pages/knowledge` | `?mode=local&noteId=&pointId=` 读/改/删/换分类 | `?id=auto` 固定「auto 类型推导」；其他 Demo 知识点不打开详情 |
| `pages/add-point` | 仅服务真实大纲：选分类、填内容、勾选原文段落、写入本地 | 演示大纲进入时会提示不支持新增 |
| `pages/file-test` | 选 TXT、UTF-8 解码、预览、保存为本地资料 | 页面顶部文案仍像「只测选择、不保存」（文案过时） |
| `pages/material` | 按 `materialId` 只读展示已保存 TXT | 无 AI、无编辑 |
| `pages/logs` | 无业务 | 微信开发模板 |

### 4.3 数据层

| 文件 | 职责 |
|---|---|
| `utils/local-notes.js` | 笔记与 AI 知识结构的唯一本地读写入口。 |
| `utils/local-materials.js` | TXT 资料的唯一本地读写入口。与笔记 **不互通**。 |

---

## 5. Storage key 与核心数据结构

### 5.1 笔记

- Key：`study-notes-demo:local-notes:v1`
- 根对象：`{ version: 1, notes: Note[] }`
- 读取失败（version 不对、字段不合法、id 重复）会 **抛错并拒绝覆盖**，避免损坏存储。一条坏数据会导致整表读失败。

`Note`：

```text
{
  id: string,                 // "note-" + 时间戳 + 随机串
  title: string,              // 非空，trim 后 1～60
  content: string,            // 非空 trim，长度 1～10000
  updatedAt: number,
  contentUpdatedAt?: number,  // 正文变化时更新；新建笔记当前可能缺失
  aiAnalysis: null | AiAnalysis
}
```

`AiAnalysis`：

```text
{
  sourceUpdatedAt: number,    // 分析时所依据的正文时间
  analyzedAt: number,
  model: string,
  data: { categories: Category[] },
  sources: Source[]           // [{ id: "P1", content: "..." }, ...]
}
```

`Category`：

```text
{
  name: string,               // 最长 60
  knowledgePoints: KnowledgePoint[],
  userCreated?: { created: true, createdAt: number }
}
```

`KnowledgePoint`：

```text
{
  id: string,                 // "kp-..."；读取时若缺失会迁移补齐
  title: string,              // 最长 100
  summary: string,            // 最长 1000
  sourceIds: string[],        // 必须是本次 sources 中真实存在的 P 编号，1～6 个
  userEdit?: {
    modified: true,
    modifiedAt: number,
    original: { title, summary }   // 第一次修改前的快照，之后不覆盖
  },
  userCreated?: { created: true, createdAt: number }
}
```

过期判定（首页 / 笔记 / 大纲 / 知识点多处重复实现）：

```text
aiOutdated = 存在 aiAnalysis
  && aiAnalysis.sourceUpdatedAt !== (contentUpdatedAt ?? updatedAt)
```

系统 **不会** 因过期自动重新调用 AI。

### 5.2 资料

- Key：`study-notes-demo:local-materials:v1`
- 根对象：`{ version: 1, materials: Material[] }`

`Material`：

```text
{
  id: string,                 // "material-..."
  type: "txt",                // 目前只允许 txt
  fileName: string,           // 1～255
  content: string,            // 读取后的文本副本，不是微信临时路径；测试上限约 200000 字符
  importedAt: number,
  updatedAt: number,
  aiAnalysis: null | object   // 字段预留；没有任何写入真实分析结果的函数
}
```

资料校验对 `aiAnalysis` 很松（任意 object 即通过），与笔记侧严格校验不一致。合并数据模型时必须小心。

### 5.3 其他 storage

- `logs`：仅模板页读取，业务不写。

---

## 6. 真实调用链

### 6.1 笔记 → AI → 大纲 → 知识点

```
首页 onNewNote / onOpenLocalNote
  → pages/note
      保存: localNotes.saveNote
      AI: 必须已保存且无未保存修改
          正文 trim 后长度 1～2000
          确认弹窗（提示会发往 DeepSeek）
          → wx.cloud.callFunction({ name: "analyzeNote", data: { text } })
          → 成功则 localNotes.saveAiAnalysis(noteId, { data, sources, model })
          → 保存失败时页面仍展示结果，避免用户为保存而立刻再调 AI

首页 onOpenAiOutline（仅 hasAi 的笔记）
  → /pages/outline/outline?mode=local&noteId=
      outline.loadLocalAiOutline
      新增分类: localNotes.addAiCategory
      新增知识点: /pages/add-point/add-point?noteId=
          addAiKnowledgePoint（必须勾选已有 sources）
      点击知识点: /pages/knowledge/knowledge?mode=local&noteId=&pointId=
          编辑: updateAiKnowledgePointById（不改 sourceIds，不调 AI）
          换分类: moveAiKnowledgePointById（空分类会被删除）
          删除: deleteAiKnowledgePointById
          返回后 outline.onShow 重新读取
```

前端 **唯一** 的 `wx.cloud.callFunction` 在 `pages/note/note.js`，函数名 `analyzeNote`。  
云函数内部的 `checkWhitelistOnly` 前端 **未使用**。

### 6.2 资料导入（TXT）

```
首页 onUpload
  → pages/file-test
      wx.chooseMessageFile（type: file，再检查扩展名为 txt）
      大小：>0 且 ≤ 200KB
      wx.getFileSystemManager().readFile
      自写 UTF-8 解码（含 BOM）；替换字符过多则拒绝
      预览最多约 3000 字
      onSaveMaterial → localMaterials.saveTxtMaterial(fileName, loadedText)
        保存的是文本副本，不保存临时路径

首页列表 onOpenLocalMaterial
  → /pages/material/material?materialId=
      只读展示 content，不调用 AI

首页 onDeleteLocalMaterial → localMaterials.deleteMaterial
```

资料对象 **不能** 进入 `analyzeNote`，也不能打开 `outline?mode=local`。

---

## 7. 云函数与 DeepSeek

### 7.1 前端初始化

`app.js` 在 `onLaunch` 中：

- 若无 `wx.cloud` 则打日志并返回。
- `wx.cloud.init({ env: <见 app.js 中的云环境 ID>, traceUser: false })`。

环境 ID 以仓库 `app.js` 为准，本文不另复制为配置手册以外的秘密。

### 7.2 `analyzeNote`（真实业务，代码层已接通）

文件：`cloudfunctions/analyzeNote/index.js`

流程：

1. `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`
2. 必须有微信 `OPENID`，否则 `NO_WECHAT_IDENTITY`
3. 环境变量 `AI_TEST_OPENID`：未配置 → `MISSING_TEST_WHITELIST`；与调用者不一致 → `AI_TEST_NOT_ALLOWED`
4. 环境变量 `DEEPSEEK_API_KEY`：未配置 → `MISSING_API_KEY`（**不要把真实密钥写入仓库或本文档**）
5. `event.text` 规范化后长度 1～2000
6. 按「非空段落」（空行分隔）切分为 `sources`，最多 30 段，id 为 `P1…`
7. HTTPS POST `api.deepseek.com` `/chat/completions`
   - 模型名代码中为 `deepseek-flash`（该名称在服务商侧是否有效 **需要验证**）
   - `response_format: json_object`
   - `max_tokens: 1000`
   - `thinking: { type: "disabled" }`
   - 超时 15 秒
8. 解析模型 JSON，校验分类数量、知识点字段、`sourceIds` 必须属于本次段落
9. 成功返回 `{ ok: true, model, data, sources, usage }`
10. 失败统一 `{ ok: false, errorCode, message }`，**不自动重试**

提示词要求：只根据资料整理、不编造出处、不事实纠错、不拓展、只输出 JSON。

### 7.3 试验云函数（不是产品功能）

| 目录 | 作用 | 前端 |
|---|---|---|
| `identityTest` | 返回是否拿到 OPENID | 未调用 |
| `networkTest` | 对外 HTTPS 探活 | 未调用 |
| `connectionTest` | 返回固定成功消息 | 未调用 |

`connectionTest` / `networkTest` 的 `package.json` 的 `name` 与文件夹名不一致。实际上传名 **需要验证**。不要把它们当成已上线业务。

---

## 8. 已经完成的功能（真实）

必须同时满足：有 UI **且** 有完整 JS 调用链。

1. 本地文字笔记：新建、编辑、保存、列表、删除、格式校验。
2. 笔记 AI 整理的 **代码路径**：确认 → 云函数 → 校验 → 写入该笔记 → 笔记页展示分类 / 知识点 / 原文映射 / Token。
3. 本地 AI 大纲：从 `aiAnalysis` 渲染；过期横幅；查看本次原文段落；新增分类。
4. 知识点详情（local）：按 `pointId` 读取；展开原文；编辑并保留 AI 原文快照；调整分类；删除。
5. 手动新增知识点：选已有分类、填写、关联 1～6 个真实出处，标记 `userCreated`。
6. TXT 选择、读取、UTF-8 预览、保存文本副本、首页列表、原文页、删除。
7. 知识点 id 迁移：旧数据缺 `id` 时读取过程会补齐并写回。

---

## 9. 尚未完成的功能

### 9.1 演示功能（有 UI，不是产品完成）

首页 `data.materials` 写死三条：

| id | UI 表现 | 实际行为 |
|---|---|---|
| `cpp-demo` | 「已整理 · 示例」查看大纲 | 打开 **无 query** 的 outline，即固定 C++ Demo 大纲，**未调用 AI** |
| `gpio-demo` | 「未整理 · 示例」打开笔记 | 只弹窗：「笔记编辑页尚未接入」 |
| `circuit-demo` | 「整理中 · 模拟」查看进度 | 只弹窗：没有后台分析任务 |
| 演示卡「更多」 | 按钮存在 | 只弹窗：原文核对和删除未接入 |

Demo 大纲：

- 默认数据是写死的分类和知识点。
- 仅 `id === "auto"` 能进入 knowledge 演示页（内容同样写死）。
- 其他知识点弹「仍属于固定演示内容」。
- 「查看原资料」弹「尚未接入原 PDF」。
- 「新增知识点」在 Demo 模式不可用。

**禁止** 把上述任何一项报告为「PDF 已支持 / 后台任务已实现 / 大纲已通用完成」。

### 9.2 产品能力缺口

- 账号、登录、云同步、云数据库。
- PDF / DOCX 选择、解析、入库。
- 资料的 AI 整理（字段预留，无函数、无按钮接到云函数）。
- 笔记与资料两套 storage 打通。
- 后台异步「整理中」任务队列。
- 系统返回键 / 导航栏返回的未保存保护（笔记页只保护自定义返回按钮）。
- 搜索、分享、复习、导出备份。
- `pages/logs` 与三个 Test 云函数的产品入口。

`utils/local-notes.js` 中的 `updateAiKnowledgePoint`（按下标修改）以及 `outline.js` 中的 `showLocalPoint` 是 **死代码**；页面已改走 `pointId` 和 knowledge 页。

---

## 10. 已确认 Bug / 缺陷（本轮审计，尚未修复）

按基线约定：**发现后先记在这里，未接到明确指令前不要修。**

1. **`pages/file-test/file-test.js`**：文件过大分支在声明 `tempPath` / `extension` 之前就使用它们，选中超过 200KB 的文件可能 `ReferenceError`。
2. **`pages/knowledge/knowledge.js` `onSaveEdit`**：只设置 `userModified: true`，不更新 `originType` / `originText`。保存后横幅显示「用户已修改」，标签可能仍显示「AI 整理」，直到重新进入页面。
3. **新建笔记不写 `contentUpdatedAt`**：后续用 `updatedAt` fallback，能工作但字段不统一。
4. **文案与能力矛盾**：
   - 首页横幅仍写「不调用 AI」；
   - 笔记页 notice 仍写「不调用 AI」；
   - file-test 顶部仍写「不读取、不保存」，但页面已读取并保存。
5. **资料 `aiAnalysis` 校验过松**，与笔记结构不一致。
6. **整表失败策略**：一条非法笔记会使 `readNotes()` 抛错，首页表现为列表为空（存储未必被删除）。
7. **长度限制不闭合**：笔记 10000 字可保存，AI 只处理 2000 字；资料约 200000 字且不能分析。
8. **`app.json` 窗口标题仍为 `Weixin`**。
9. **过期计算 / 来源映射** 在 index、note、outline、knowledge 重复实现。

---

## 11. 需要真机或开发者工具验证的事项

代码无法确认，不要猜测为「已经好了」或「一定坏了」：

1. 云环境 ID 是否仍有效，基础库是否支持云开发。
2. `analyzeNote` 是否已上传到该环境，上传名是否就是 `analyzeNote`。
3. 环境变量 `DEEPSEEK_API_KEY`、`AI_TEST_OPENID` 是否已配置（不要把值写入仓库）。
4. 当前开发者微信号 OPENID 是否在白名单内。
5. 一次短文字笔记能否完整走通：调用 → 模型 JSON → 本地保存 → 打开大纲。
6. 模型名 `deepseek-flash` 是否被 API 接受。
7. `wx.showModal({ editable: true })` 新增分类在目标基础库 / 真机是否可用。
8. `wx.chooseMessageFile` 在真机会话中选 TXT 是否稳定。
9. 三个 Test 云函数是否曾部署、部署名是文件夹名还是 package name。
10. 本地 storage 在多份大 TXT + AI JSON 下是否触达配额。

---

## 12. 下一阶段开发优先级

在验证和明确指令之前：**不修 Bug、不开发新功能、不重构。**

建议顺序（需产品负责人确认后再做）：

1. **运行时验证（最高）**  
   确认云环境、函数部署、环境变量、白名单、一次真实短笔记 AI。未验证前不要扩大 AI 使用面。

2. **已确认前端缺陷**  
   file-test 未定义变量、知识点标签、`contentUpdatedAt`、过时文案。

3. **收口资料主路径**  
   让已保存 TXT 进入与笔记同一套分析/大纲/编辑链，**或** 明确「资料暂不分析、只当原文库」。不要再长出第三套数据结构。

4. **隔离或删除演示与试验残骸**  
   固定演示卡片、logs、Test 云函数、死函数。避免后人把 Demo 当成完成功能。

5. **之后再考虑** PDF/DOCX、云同步、账号。

---

## 13. 给后续 AI 的硬约束

1. 首页「固定演示资料」和无参数 `outline` / `id=auto` 的 knowledge **不是** 已完成产品功能。
2. 资料列表里的「仅本地 · 未分析」是真实状态；资料 **没有** AI 入口。
3. 不要把 `material.aiAnalysis` 字段的存在解释成「资料分析已实现」。
4. 不要把 `circuit-demo` 的「整理中」解释成存在任务队列。
5. 不要提交、打印或把密钥写入文件。云函数只通过环境变量读取。
6. 改存储结构时必须考虑现有 key 与 `version: 1` 的严格校验，否则用户本地数据会全部读失败。
7. 改 AI 结果时不要丢 `sources` 与 `sourceIds` 的对应关系；用户编辑不得偷偷改出处。
8. 未接到用户明确指令时，不要「顺便」重构、不要安装依赖、不要扩大 PDF/云同步范围。

---

## 14. 审计元数据

- 审计日期：2026-09-12
- 方式：只读通读仓库；以 JS 调用链为准，不以 UI 文案为准
- 范围：`app.*`、全部 `pages`、`utils`、`cloudfunctions`、`project.config.json`
- 未执行：安装依赖、部署云函数、真机调试、修改业务代码
- 本文档创建：仅新增本文件，作为接管基线
