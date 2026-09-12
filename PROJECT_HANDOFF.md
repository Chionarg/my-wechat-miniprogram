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

---

## 15. 2026-09-12 最新开发进度
### 核心链路实机验证完成

已在微信开发者工具中实际验证以下真实业务链路：

文字笔记
→ 保存到本地
→ DeepSeek AI 整理
→ AI 结果保存到本地
→ 首页显示「AI 已整理」
→ 查看知识大纲
→ 打开知识点详情
→ 正确显示知识点解释
→ 正确显示 P1/P2 等原文出处

验证结论：

- `analyzeNote` 云函数在当前开发环境中可以真实调用。
- DeepSeek AI 整理链路可以正常返回结果。
- AI 结果可以正常写入本地笔记。
- 首页可以正确识别「AI 已整理」和「AI 结果待更新」状态。
- 本地大纲可以正确读取 AI categories / knowledgePoints。
- 知识点可以正确读取 sourceIds 并关联 P1/P2 原文。
- 知识点编辑结果可以正常持久化。

注意：
以上结论仅代表当前微信开发者工具开发环境已验证通过，不代表生产环境、其他微信账号或其他设备已经验证。

### 2026-09-12：第一批稳定性修复完成

Git commit:

`c0b430e fix: stabilize local notes and TXT import`

已完成：

1. 修复 `pages/file-test/file-test.js` 在 TXT 文件超过大小限制时，`tempPath` / `extension` 可能在声明前被引用的问题。
   - 已使用 219206 字节（> 200 KB）TXT 文件实际验证。
   - 超限文件现在能够正常显示大小限制提示，不再触发 ReferenceError。

2. 新建文字笔记时统一写入：
   - `updatedAt`
   - `contentUpdatedAt`
   两者使用同一个初始时间戳。

3. 修复知识点编辑保存后的状态即时刷新。
   - AI 原始知识点编辑后立即显示「用户已修改」。
   - `originType = "user-edited"`
   - `originText = "用户已修改"`
   - 已验证返回大纲后仍保持「用户已修改」，说明本地持久化正常。

4. 修正首页、文字笔记页、TXT 导入页的过时隐私/能力文案。
   - 明确笔记和 TXT 资料默认保存在本机。
   - 明确文字笔记使用 AI 整理时正文会通过云函数发送至第三方 AI 服务。
   - 明确 TXT 当前可以读取并保存到本机。
   - 明确 TXT 资料当前暂未接入 AI 整理。

5. 新增 `.gitignore`：
   - 忽略 `.cursor/`
   - Cursor 本地工作文件不进入 Git 仓库。

6. `showLoading / hideLoading`：
   - 全项目搜索确认只有 `pages/note/note.js` 一处调用。
   - 当前结构为 `wx.showLoading()` → `wx.cloud.callFunction()` → `complete` → `wx.hideLoading()`，代码层已有配对。
   - 此前警告可能与开发工具热重载/请求生命周期有关。
   - 当前没有修改已验证通过的 AI 主链路。
   - 若正常非热重载操作可以稳定复现，再单独处理。

### 当前稳定基线

截至 commit `c0b430e`：

文字笔记 → AI 整理 → 大纲 → 知识点 → 原文出处 → 用户编辑

已在微信开发者工具中验证通过。

TXT 当前能力：

选择 TXT
→ UTF-8 读取
→ 正文预览
→ 本地保存
→ 首页资料列表
→ 查看原文

已验证可工作。

TXT 尚未接入 AI 整理。

### 下一阶段建议

下一阶段优先设计和实现：

`TXT 学习资料 → AI 整理 → 知识大纲 → 知识点 → 原文出处`

在开始编码前先解决：

- TXT 最大约 200 KB 与当前 `analyzeNote` 最大约 2000 字之间的长度冲突。
- 长资料是否需要分块。
- 分块后的 P1/P2/sourceIds 如何保持全局唯一。
- 多个分块产生的 categories / knowledgePoints 如何合并。
- 是否复用现有笔记 `aiAnalysis` 数据结构。
- 如何限制 AI 调用次数与费用。
- 部分分块失败后如何继续，避免全部重新调用。
- 资料修改后 AI 结果过期状态如何判断。

在上述设计确定前，不应直接把完整 200 KB TXT 发送给现有 `analyzeNote`。

---

## 16. 后续完整开发路线图

> 本章节定义当前稳定基线之后的长期开发方向，供后续 AI / 开发者接管项目使用。
>
> 后续开发必须以当前实际代码、Git 状态和已经完成的人工验证为事实来源。
>
> 禁止因为本路线图存在就一次性实现全部功能。必须逐阶段开发、验证和提交。

### 16.1 当前稳定基线

截至当前版本，已经实际验证：

#### 文字笔记链路

文字笔记
→ 保存到本地
→ AI 整理
→ AI 结果保存到本地
→ 首页显示「AI 已整理」
→ 查看知识大纲
→ 打开知识点
→ 显示知识点解释
→ P1 / P2 等原文出处
→ 用户编辑知识点
→ 保存修改
→ 返回大纲仍保持用户修改状态

该链路已在微信开发者工具中实际验证通过。

当前实际使用的 AI Provider 为：

DeepSeek

但是 DeepSeek 只是当前已经验证可用的 Provider，不是产品永久绑定的架构。

#### TXT 学习资料链路

当前已经验证：

TXT
→ 选择文件
→ 文件类型 / 大小检查
→ UTF-8 正文读取
→ 正文预览
→ 保存到本机
→ 首页资料列表
→ 查看原文

TXT 当前尚未进入 AI 整理。

#### 当前尚未实现

- TXT 资料 AI 整理
- 长资料 Chunk 分析
- Chunk 断点恢复
- PDF 正式导入
- DOCX 正式导入
- 资料 AI 大纲
- 资料知识点人工编辑完整闭环
- 账号
- 云同步
- 云数据库
- 全局搜索
- 复习系统

---

### 16.2 AI Provider 架构原则

当前已经实际验证可用的 AI Provider 为 DeepSeek。

DeepSeek 是当前实现，不是永久绑定的产品架构。

后续所有 AI 功能，包括：

- 文字笔记知识整理
- TXT 资料分析
- PDF 资料分析
- DOCX 资料分析
- Chunk 知识抽取
- Chunk 结果合并
- 未来可能增加的其他 AI 任务

都必须从架构上视为调用统一的 AI Provider，而不是直接依赖 DeepSeek。

目标调用关系：

业务功能
→ AI Task / Prompt
→ 统一 AI Provider 接口
→ 当前 DeepSeek Provider
→ Provider 响应标准化
→ Validator
→ 业务数据

未来如果切换 OpenAI、Claude 或其他模型 / 服务商，应尽量只增加或替换 Provider 适配层，不修改：

- 页面业务逻辑
- Note 主体业务模型
- Material 主体业务模型
- categories
- knowledgePoints
- sourceIds
- P1 / P2 原文引用机制
- Outline 页面核心逻辑
- Knowledge 页面核心逻辑

Provider 层负责：

- API endpoint
- API Key
- 模型名称
- 请求参数
- Provider 特有请求格式
- Provider 特有响应格式
- 转换为统一业务结果

业务层负责：

- 用户操作
- 原文处理
- Paragraph
- Source
- Chunk
- AI Task 定义
- Prompt 业务规则
- AI 结果校验
- sourceId 校验
- 数据保存
- 状态管理
- 大纲和知识点展示

任何 API Key、AppSecret、Token 不得写入小程序前端或 Git 仓库。

当前阶段继续使用已经验证成功的 DeepSeek。

不要为了 Provider 抽象立即重构已经稳定工作的 `analyzeNote`。

Provider 抽象应该在资料 AI Pipeline 开发过程中逐步建立。

等 Material AI 链路验证稳定以后，再决定是否把现有 Note AI 迁移到统一 Provider。

---

### 16.3 AI 标准业务 Schema 原则

无论底层使用 DeepSeek、OpenAI、Claude 或其他 Provider，业务层最终接收到的知识结构必须保持统一。

核心结构继续围绕：

categories
→ knowledgePoints
→ sourceIds

知识点至少保持：

```json
{
  "id": "point_xxx",
  "title": "知识点名称",
  "summary": "知识点解释",
  "sourceIds": ["P12", "P13"]
}

### 16.4 原文事实来源原则

AI 结果属于派生数据，原文才是事实来源。

任何 AI 生成的知识点都必须能够引用真实 sourceId。

例如：

{
  "title": "引用必须初始化",
  "sourceIds": ["P12", "P13"]
}

AI 不允许自己创造不存在的 sourceId。

程序必须验证：

- sourceId 是否存在
- sourceId 是否属于当前资料
- Chunk 分析时 sourceId 是否属于允许引用范围

例如当前 Chunk 只包含：

P20
P21
P22
P23

如果 AI 返回 P999，则必须判定结果无效，不能直接保存。


### 16.5 用户编辑保护原则

必须持续区分：

- AI 整理
- 用户已修改
- 用户新增

现有语义包括：

originType = ai
originType = user-edited
originType = user-created

用户人工修改的数据不能因为下一次 AI 运行被静默覆盖。

未来重新整理资料时，需要明确处理 AI 原始结果与用户覆盖结果之间的关系。

在没有设计好合并策略之前，不允许通过“重新 AI 整理”直接删除用户修改。


---

## 17. 阶段 2A：TXT 原文标准化、Source 与 Chunk

这是下一阶段必须首先完成的开发任务。

优先级：最高。

本阶段禁止调用 AI。

目的：

先建立以后 TXT / PDF / DOCX 都能共用的资料处理基础。

目标：

TXT content
→ normalizeText
→ splitIntoParagraphs
→ createSources
→ createChunks

例如：

P1
P2
P3
P4
...
P36

组成：

Chunk 1 → P1-P8
Chunk 2 → P9-P17
Chunk 3 → P18-P27
Chunk 4 → P28-P36


### 17.1 Source 规则

sourceId 必须在整份资料中全局唯一。

禁止：

Chunk 1:
P1 P2 P3

Chunk 2:
P1 P2 P3

必须：

Chunk 1:
P1 P2 P3

Chunk 2:
P4 P5 P6

这样 KnowledgePoint 中的：

sourceIds = ["P5"]

才能永久对应唯一原文。


### 17.2 Paragraph 规则

优先按照自然段落切分。

需要：

- 统一换行
- 清理无意义空段
- 保留段落顺序
- 尽量保持原文文本
- 不改变原文语义

不能直接简单地每 N 个字符切正文。

对于异常长的单段落，需要设计单独 fallback。


### 17.3 Chunk 规则

Chunk 按完整 Source / Paragraph 组合。

单次 AI Chunk 的目标文本大小必须与“文件最大允许大小”分离。

例如：

TXT 最大允许 200KB

不代表：

AI 一次可以处理 200KB。

初期建议单 Chunk 目标约 1500～3000 中文字符。

实际值应定义成配置常量，不要散落到业务代码中。


### 17.4 建议建立的纯函数

建议逐步建立：

normalizeText(text)

splitIntoParagraphs(text)

createSources(paragraphs)

createChunks(sources, options)

这些函数尽量不要直接依赖 wx.*。

这样未来可以独立测试，也可以给 TXT / PDF / DOCX 共用。


### 17.5 阶段 2A 验收

本阶段禁止产生 AI 费用。

至少使用多个不同 TXT 测试：

- 短文本
- 多段文本
- 包含大量空行
- 包含长段落
- 接近当前 TXT 限制的文本

必须验证：

- 原文没有意外丢失
- Source 顺序正确
- sourceId 不重复
- Chunk 不重复
- Chunk 不漏 Source
- Chunk 边界合理
- 全局 P 编号连续、唯一
- 不调用 DeepSeek
- 不调用其他 AI Provider

开发阶段可以增加调试显示，例如：

原文字数：5230
Source：37
Chunk：4

Chunk 1: P1-P9
Chunk 2: P10-P18
Chunk 3: P19-P27
Chunk 4: P28-P37

阶段 2A 验证成功以后：

1. Git commit
2. 更新 PROJECT_HANDOFF.md
3. 再进入阶段 2B


---

## 18. 阶段 2B：AI Provider 最小抽象

阶段 2A 完成后开始。

此阶段目标不是大规模重构。

目标是建立最小 Provider 边界，让新的 Material AI 不直接绑定 DeepSeek。

当前 DeepSeek 调用继续可用。

概念调用关系：

Material AI
→ AI Task
→ Provider
→ DeepSeek（当前）

未来：

Material AI
→ AI Task
→ Provider
→ OpenAI / Claude / 其他 Provider

必须保持统一输出 Schema。


### 18.1 Provider 配置

概念上允许：

provider = deepseek
model = 当前模型

以后允许切换其他 Provider / Model。

API Key 必须始终位于安全的云端环境。

禁止：

- 在小程序前端写 API Key
- 把 API Key 提交到 Git
- 把 AppSecret / Token 提交到 Git


### 18.2 Prompt 与 Provider 解耦

Knowledge Extraction 属于业务任务，而不是 DeepSeek 专用功能。

目标逻辑：

业务 Task
→ Prompt Builder
→ Provider

不要把所有业务 Prompt 永久写死在 DeepSeek 请求实现内部。


### 18.3 不立即迁移 Note

现有 analyzeNote 已经实际验证可工作。

阶段 2B 不应该为了架构统一而立即重写它。

先让新的 Material AI 使用 Provider 边界。

Material AI 稳定后，再评估 Note 是否迁移到统一 Provider。


---

## 19. 阶段 2C：短 TXT AI 整理 MVP

初期不要直接处理 200KB TXT。

建议首先限制为较短 TXT，例如约 6000 字，用来验证完整 AI Pipeline。

目标：

TXT
→ Sources
→ Chunks
→ AI Provider
→ 当前 DeepSeek
→ Chunk 局部分析
→ Validator
→ 保存结果

每个 Chunk 发送给 AI 时应明确包含真实 Source，例如：

[P12] 第一段原文……
[P13] 第二段原文……
[P14] 第三段原文……

AI 返回知识点只能引用允许的 sourceIds。

例如：

{
  "categories": [
    {
      "name": "C++基础",
      "knowledgePoints": [
        {
          "title": "引用初始化",
          "summary": "……",
          "sourceIds": ["P12", "P13"]
        }
      ]
    }
  ]
}

程序必须验证返回内容。

任何不存在的 sourceId 都不能直接写入正式分析结果。


---

## 20. 阶段 2D：Chunk 结果 Merge

多个 Chunk 会产生多个局部知识结构。

例如：

Chunk 1

C++基础
- 变量
- 引用

Chunk 2

C++基础
- 指针
- const

Chunk 3

面向对象
- 类
- 继承

最终需要形成：

C++基础
- 变量
- 引用
- 指针
- const

面向对象
- 类
- 继承

第一版优先使用程序规则合并同名 Category。

只有确实需要时，再使用 AI 做语义 Merge。

Merge 阶段原则：

- 不重新向模型发送整份原文
- 优先读取已经产生的结构化局部结果
- 不破坏任何 sourceIds
- 不静默删除知识点
- 不静默覆盖用户修改

这样可以减少：

- Token
- AI 成本
- 延迟
- 超时
- 上下文压力


---

## 21. 阶段 2E：资料 AI 状态模型

资料 AI 需要逐渐支持明确状态：

idle
preparing
analyzing
paused
failed
completed
outdated

首页资料卡片未来可以显示：

未整理

AI 整理中

整理暂停

整理失败

AI 已整理

AI 结果待更新

资料正文发生变化后，需要通过：

material.updatedAt

与：

aiAnalysis.sourceUpdatedAt

进行比较，判断 AI 结果是否过期。

尽量参考已经验证成功的 Note 逻辑。

不要重新创造完全不同的过期判断体系。


---

## 22. 阶段 2F：Chunk 断点恢复

长资料必须支持断点恢复。

例如：

Chunk 1 completed
Chunk 2 completed
Chunk 3 completed
Chunk 4 failed
Chunk 5 pending
Chunk 6 pending

如果第 4 块失败：

必须保留 Chunk 1～3 的成功结果。

用户下一次选择“继续整理”时，应从 failed / pending 部分继续。

禁止重新调用已经成功的 Chunk。

建议 Chunk 状态逐渐包含：

{
  "id": "C4",
  "sourceIds": ["P30", "P31", "P32"],
  "status": "failed",
  "attemptCount": 1,
  "errorCode": "AI_PROVIDER_ERROR"
}

不要默认无限自动重试。

AI 继续操作由用户主动触发。


---

## 23. 阶段 2G：AI 调用费用与请求保护

长资料可能产生大量 AI 请求。

开始整理之前应该告诉用户：

本资料包含：

37 个原文段落
8 个分析分块

预计需要约 8～9 次 AI 请求。

由用户确认以后再开始。

禁止：

- 导入 TXT 后自动调用 AI
- 打开资料自动调用 AI
- 页面 onShow 自动调用 AI
- AI 失败无限自动重试
- App 启动后自动继续收费 API 请求

原则：

所有可能产生费用的 AI 操作必须由用户主动触发。


---

## 24. 阶段 2H：Material AI 大纲

资料 AI 数据稳定后，优先接入现有：

pages/outline

不要复制一套完全独立的 Material Outline 页面。

当前 Note：

outline?mode=local&noteId=...

未来建议支持：

outline?mode=material&materialId=...

页面根据 mode 选择数据来源。

最终提供统一 View Model：

categories
knowledgePoints
sourceIds

资料大纲目标：

- Category 展开 / 折叠
- KnowledgePoint 展示
- Source 标签
- 用户编辑
- 用户新增
- 用户删除
- 调整分类

尽量沿用已经验证成功的 Note UX。


---

## 25. 阶段 2I：Material Knowledge 页面

优先复用：

pages/knowledge

未来支持：

knowledge?mode=material&materialId=...&pointId=...

需要展示：

- 标题
- 核心解释
- 来源状态
- 原文出处

来源状态继续使用：

AI 整理
用户已修改
用户新增

并支持：

展开原文

根据：

sourceIds

从 Material Sources 中找到真实原文。

禁止根据 AI summary 伪造“原文”。


---

## 26. 阶段 2J：Material 人工编辑

资料知识点需要逐步支持：

- 编辑知识点名称
- 编辑知识点解释
- 调整所属 Category
- 删除知识点
- 新增 KnowledgePoint
- 新增 Category

用户新增知识点时必须选择真实 Source。

继续使用已有语义：

userEdit
userCreated

重新 AI 整理不能静默覆盖用户修改。


---

## 27. 阶段 2K：扩展到 200KB TXT

只有短 TXT Pipeline 稳定以后才能扩大。

至少测试：

约 10KB
约 50KB
约 100KB
接近 200KB

重点关注：

- Source 数量
- Chunk 数量
- AI 请求次数
- AI 成本
- 云函数执行时间
- 前端请求生命周期
- 本地 Storage
- 中途中断
- 断点恢复
- Merge 性能

文件允许 200KB 不意味着一次 AI 请求发送 200KB。


---

## 28. 阶段 3：资料存储架构升级

当前：

wx.setStorageSync

适合现阶段原型。

但未来大量资料可能遇到 Storage 容量问题。

需要实际统计：

- Notes
- Material Metadata
- Material Content
- Sources
- AI Analysis
- Chunk State

只有确认存在真实容量问题以后再升级。

未来可以考虑：

小型 Metadata
→ wx Storage

大型原文
→ 本地文件系统

AI Metadata
→ wx Storage / 未来数据库

不能因为“以后可能有问题”现在就过度重构。

任何迁移必须兼容现有用户旧数据。


---

## 29. 阶段 4：PDF 支持

前提：

TXT Pipeline 已经稳定。

PDF 层只负责完成：

PDF
→ extractText

之后必须进入统一 Pipeline：

normalize
→ paragraph
→ source
→ chunk
→ AI Provider
→ merge
→ outline
→ knowledge

第一版只支持具有文本层的 PDF。

暂时不要优先处理扫描版 PDF / OCR。

未来 Source 可以逐渐保留：

{
  "id": "P102",
  "text": "……",
  "page": 17
}

这样未来可以支持：

KnowledgePoint
→ Source
→ PDF Page

PDF 需要逐步处理：

- 页眉
- 页脚
- 页码
- 多栏排版
- 异常换行


---

## 30. 阶段 5：DOCX 支持

DOCX 层只负责：

DOCX
→ extractText

后面继续进入统一 Pipeline。

尽量保留：

- paragraph
- heading

未来可以增加：

headingPath

帮助 AI 理解章节结构。

第一版避免过度复杂。


---

## 31. 阶段 6：统一 Note / Material AI Core

只有 Material AI Pipeline 已经稳定以后再做。

目标：

Note
→ Common AI Core

Material
→ Common AI Core

共享：

- Source Schema
- KnowledgePoint Schema
- Category Schema
- Validator
- Provider
- Prompt Tasks
- origin state

但是入口允许不同。

Note：

短文本，可能单次 AI。

Material：

长文本，多 Chunk，多次 AI。

禁止在 Material 尚未验证以前重构已经稳定的 Note AI。


---

## 32. 阶段 7：全局搜索

等 Note / Material 数据结构稳定以后增加。

搜索范围：

- 笔记标题
- 资料标题
- Category
- KnowledgePoint title
- summary
- 原文

第一版优先本地搜索。

不要为了搜索立即引入云数据库。


---

## 33. 阶段 8：复习系统

核心知识库稳定以后，再考虑：

- 收藏知识点
- 掌握程度
- 最近复习
- 待复习
- 薄弱知识
- 错题 / 问题记录

不要在 Material Pipeline 尚未完成时提前扩张数据模型。


---

## 34. 阶段 9：账号与云同步

属于后期能力。

必须先设计：

- 用户身份
- 数据所有权
- Notes 同步
- Materials 同步
- AI Results 同步
- 用户修改同步
- 离线数据
- 冲突解决
- 删除同步
- 隐私

禁止直接把：

wx.setStorageSync

简单替换成数据库。

必须提供数据迁移与兼容方案。


---

## 35. 阶段 10：隐私与用户数据控制

正式上线以前必须重新审计。

UI 必须准确告诉用户：

- 什么数据只保存在本地
- 什么操作会发送数据给 AI Provider
- 什么情况下不会上传
- AI 结果保存在哪里
- 删除资料会删除哪些内容
- 是否存在云同步

禁止出现：

UI 声称“不上传”，但实际代码发送正文给第三方 AI。

如果以后增加云同步或更换 AI Provider，相关说明必须同步更新。


---

## 36. 阶段 11：Demo / Test 清理

只有真实功能稳定后再进行。

当前已知存在：

- 固定演示卡片
- pages/logs
- identityTest
- networkTest
- connectionTest
- 部分死代码
- 开发测试文案

不要在核心功能开发过程中提前大规模删除。

等：

Note
+
Material
+
AI
+
Outline
+
Knowledge

真实闭环稳定以后，再单独进行 Cleanup。

Cleanup 必须单独 Git commit。


---

## 37. 阶段 12：测试体系

当前主要依赖微信开发者工具人工验证。

项目增长以后，优先给纯函数增加测试。

重点测试：

normalizeText

splitIntoParagraphs

createSources

createChunks

validateAiAnalysis

validateSourceIds

mergeChunkResults

outdated calculation

Storage schema validation

尤其 Source / Chunk 算法必须可以脱离 wx API 测试。

核心资料处理函数应尽量设计成纯 JavaScript。


---

## 38. 错误处理原则

文件错误、Storage 错误和 AI 错误必须区分。

逐步形成明确 errorCode，例如：

INVALID_INPUT

TEXT_TOO_LONG

INVALID_FILE

AI_TIMEOUT

AI_PROVIDER_ERROR

AI_INVALID_JSON

AI_INVALID_SOURCE

STORAGE_FULL

MATERIAL_NOT_FOUND

ANALYSIS_OUTDATED

错误处理原则：

- 给用户可理解的信息
- 保留已经完成的数据
- 不静默丢失原文
- 不静默覆盖用户修改
- 不无限重试收费 API
- 不因为一个 Chunk 失败删除其他成功 Chunk


---

## 39. Git 开发规则

后续任何 AI / 开发者开始任务前必须运行：

git status

确认工作区状态。

一次只完成一个明确阶段。

修改以后必须进行微信开发者工具实际验证。

提交前执行：

git diff --check

git status

git diff --stat

禁止未经确认使用：

git add .

应该明确暂存：

git add file1 file2 ...

Commit 示例：

feat: add material source chunking

feat: add AI provider abstraction

feat: add TXT AI analysis MVP

feat: add resumable material analysis

feat: connect material outline

fix: ...

docs: update handoff ...

阶段完成并实际验证以后更新：

PROJECT_HANDOFF.md


---

## 40. PROJECT_HANDOFF 更新规则

PROJECT_HANDOFF.md 是 AI / 开发者长期交接文档。

需要更新的时机：

- 一个明确开发阶段完成
- 核心架构发生变化
- 重要功能实际验证通过
- 发现新的重大限制
- Provider 发生变化
- 数据 Schema 发生变化
- 下一阶段计划发生变化

不需要每修改一个按钮都更新。

文档必须明确区分：

计划

与：

已经实际验证

禁止把“代码看起来完成”记录成“已经验证完成”。


---

## 41. 后续 AI 接管强制规则

新的 AI 对话必须首先：

1. 完整阅读 PROJECT_HANDOFF.md
2. 阅读当前实际代码
3. 执行 git status
4. 确认当前 branch
5. 判断代码和文档是否一致
6. 如果发生冲突，以当前实际代码和 Git 状态为事实来源
7. 不要立即修改代码
8. 先说明当前阶段
9. 说明本阶段目标
10. 说明预计修改文件
11. 给出人工验证方法
12. 等用户确认后开发

禁止新 AI：

- 从零重写项目
- 推翻已验证 Note AI
- 为 Material 复制完全独立的 Outline / Knowledge 系统
- 把 DeepSeek 写死为永久架构
- 把任何其他 Provider 写死为永久架构
- 未确认就升级依赖
- 未确认修改生产云配置
- 把 API Key / AppSecret / Token 写入 Git
- 未确认删除 Demo / Test
- 使用 git add .
- 未经运行验证就声称功能已经完成


---

## 42. 下一次开发的明确起点

下一次正式开发任务：

阶段 2A：

TXT
→ normalize
→ paragraphs
→ 全局 Sources（P1/P2/P3...）
→ Chunks

本阶段：

- 不调用 DeepSeek
- 不调用其他 AI Provider
- 不产生 AI 费用
- 不重构现有 Note AI
- 不修改已经验证成功的 Note → AI → Outline → Knowledge 主链路

首先只建立 Material 的文本处理基础。

阶段 2A 验收重点：

- 原文不丢失
- sourceId 唯一
- sourceId 顺序正确
- Chunk 不漏 Source
- Chunk 不重复 Source
- Chunk 边界合理
- 超长单段有明确处理策略

开发完成后必须通过微信开发者工具实际测试。

验证通过后：

1. Git commit
2. 更新 PROJECT_HANDOFF.md
3. 然后进入阶段 2B：AI Provider 最小抽象
4. 之后进入阶段 2C：短 TXT AI 整理 MVP


---

## 43. 长期架构核心约束

无论未来增加多少功能，都必须尽量保持以下边界：

文件格式层
TXT / PDF / DOCX
↓
文本标准化层
↓
Source / Chunk 层
↓
AI Task 层
↓
AI Provider 层
↓
Validator
↓
统一业务 Schema
↓
Note / Material
↓
Outline / Knowledge

其中：

- 文件格式可以替换或增加
- AI Provider 可以替换
- AI Model 可以替换
- UI 可以迭代

但以下概念应长期保持稳定：

- 原文是事实来源
- Source 必须可以追溯
- KnowledgePoint 必须引用真实 Source
- AI 输出必须验证
- Provider 不得决定业务数据结构
- 用户修改不能被静默覆盖
- 收费 AI 操作必须由用户主动触发
- 长资料必须分块处理
- 已完成 Chunk 不应因为后续失败而重复调用
- Note 与 Material 应逐步共享核心能力，而不是形成两套互不兼容的系统

当前 Provider：

DeepSeek

这只代表当前已经验证可用的实现。

长期设计要求：

未来更换 AI Provider 或 Model 时，应尽量只修改 Provider / 配置层，而不重做 TXT、PDF、DOCX、Source、Chunk、Outline 和 Knowledge 系统。

这是后续架构演进时必须优先保持的核心原则。