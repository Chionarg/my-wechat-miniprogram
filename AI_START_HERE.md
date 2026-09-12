# 随即笔记 · AI 快速接管入口

> 本文件用于新的 AI 对话快速接管项目。
>
> 如果你是第一次看到这个项目，请先完整阅读本文件。
>
> 更完整的历史、架构说明和长期路线图位于：
>
> PROJECT_HANDOFF.md
>
> 当前实际代码和 Git 状态是最终事实来源。
> 如果本文件、PROJECT_HANDOFF.md 与实际代码冲突，以当前代码和 Git 状态为准。

---

## 1. 项目是什么

项目名称：

随即笔记

类型：

微信小程序

当前阶段：

中期功能原型 / 开发测试版。

核心目标：

把零散学习笔记和导入的学习资料整理成：

原文
→ 分类
→ 知识点
→ 知识大纲
→ 原文出处

并允许用户：

- 查看
- 核对
- 修改
- 新增
- 删除
- 调整分类

核心原则：

AI 生成的知识点必须可以追溯到真实原文。

---

## 2. 当前真实稳定基线

以下内容不是“计划”，而是已经在微信开发者工具中人工验证通过。

### 2.1 文字笔记

已经验证：

文字笔记
→ 保存到本地
→ AI 整理
→ AI 结果保存到本地
→ 首页显示「AI 已整理」
→ 查看知识大纲
→ 打开知识点
→ 显示解释
→ 显示 P1 / P2 等原文出处
→ 编辑知识点
→ 状态立即显示「用户已修改」
→ 返回大纲
→ 用户修改状态和内容仍然存在

因此：

Note
→ AI
→ Outline
→ Knowledge
→ Source
→ User Edit

核心链路目前可以工作。

不要在没有明确原因的情况下重写这条链路。

---

## 3. 当前 TXT 能力

TXT 当前已经验证：

TXT
→ 选择文件
→ 类型检查
→ 大小检查
→ UTF-8 正文读取
→ 正文预览
→ 保存到本机
→ 首页资料列表
→ 查看 TXT 原文

当前 TXT 最大测试限制约：

200 KB

已经验证超过 200 KB 时能够正常进入限制分支，不再因为 tempPath / extension 声明顺序产生 ReferenceError。

TXT 当前尚未接入：

AI 整理

资料大纲

资料知识点

Chunk AI

---

## 4. 当前数据与页面

主要页面：

pages/index
首页

pages/note
文字笔记

pages/file-test
TXT 导入

pages/material
本地资料原文

pages/outline
知识大纲

pages/knowledge
知识点详情 / 编辑

pages/add-point
新增知识点

pages/logs
模板 / 非主要业务

主要工具：

utils/local-notes.js

负责：

本地笔记
AI Analysis
知识点编辑相关本地数据

utils/local-materials.js

负责：

本地 TXT 资料保存和读取

当前主要持久化方式：

wx.setStorageSync

当前没有正式云数据库业务。

---

## 5. 当前 AI 状态

当前实际验证可用的 AI Provider：

DeepSeek

当前 Note AI 通过：

wx.cloud.callFunction

调用：

analyzeNote

云函数再调用当前 AI Provider。

注意：

DeepSeek 是“当前已经验证的 Provider”，不是永久架构绑定。

禁止把未来系统继续写死为只能使用 DeepSeek。

目标架构：

业务功能
→ AI Task / Prompt
→ AI Provider
→ 当前 DeepSeek / 未来其他 Provider
→ 标准化结果
→ Validator
→ 业务数据

未来允许切换：

OpenAI
Claude
其他 Provider / Model

更换 Provider 时，应尽量只修改 Provider / 配置层。

不应该重新开发：

TXT
PDF
DOCX
Source
Chunk
Outline
Knowledge

---

## 6. AI 统一业务结构

无论使用哪个 AI Provider，业务层应尽量保持：

categories
→ knowledgePoints
→ sourceIds

知识点核心结构：

{
  "id": "point_xxx",
  "title": "知识点名称",
  "summary": "知识点解释",
  "sourceIds": ["P12", "P13"]
}

Provider 不应该决定页面的数据结构。

AI 输出必须先经过 Validator。

---

## 7. Source 是核心事实引用

原文是事实来源。

AI Analysis 是派生数据。

Source 示例：

P1
P2
P3
...

AI 知识点只能引用真实存在的 Source。

例如当前 AI Chunk 只提供：

P20
P21
P22
P23

AI 如果返回：

P999

必须判定为非法结果。

禁止让不存在的 sourceId 进入正式知识数据。

---

## 8. 用户编辑保护

系统必须区分：

AI 整理

用户已修改

用户新增

当前相关语义包括：

originType = ai

originType = user-edited

originType = user-created

用户修改不能因为重新调用 AI 被静默覆盖。

---

## 9. 已完成的重要稳定性修复

已经完成：

1. 修复 TXT 超大文件分支可能引用未声明 tempPath / extension。

2. 新建 Note 时统一写入：

updatedAt

contentUpdatedAt

3. Knowledge 编辑后立即更新：

originType = user-edited

originText = 用户已修改

并已验证重新进入后仍然存在。

4. 修正首页 / Note / TXT 页面已经过时的 AI / 本地存储提示。

5. .gitignore 已忽略：

.cursor/

6. showLoading / hideLoading：

当前全项目确认只有 pages/note/note.js 一组。

结构为：

showLoading
→ cloud.callFunction
→ complete
→ hideLoading

当前没有为了开发工具偶发 Warning 修改已经验证正常的 AI 主链路。

---

## 10. 当前关键 Git 基线

已知重要提交：

c0b430e

fix: stabilize local notes and TXT import


05ef9fe

docs: update handoff after stability fixes


0b97d90

docs: add provider-agnostic development roadmap

如果 commit hash 与当前仓库后续历史不同，以：

git log

实际结果为准。

---

## 11. 当前下一开发阶段

当前明确下一阶段：

阶段 2A：

TXT 原文标准化、Source、Chunk。

这是新的 AI 接手以后首先应该继续的任务。

目标：

TXT content
→ normalizeText
→ splitIntoParagraphs
→ createSources
→ createChunks

本阶段：

禁止调用 DeepSeek。

禁止调用其他 AI Provider。

不产生 AI 费用。

不重构已经验证成功的 Note AI。

不修改 Note → AI → Outline → Knowledge 核心链路。

---

## 12. 阶段 2A Source 规则

整份 Material 的 sourceId 必须全局唯一。

正确：

Chunk 1:
P1 P2 P3

Chunk 2:
P4 P5 P6

错误：

Chunk 1:
P1 P2 P3

Chunk 2:
P1 P2 P3

sourceId 必须能够永久定位真实原文。

---

## 13. 阶段 2A Paragraph 规则

优先按照自然段落。

要求：

- 统一换行
- 清理无意义空段
- 保持原文顺序
- 尽量保留原文
- 不改变语义
- 正常段落不要简单每 N 字硬切

异常超长单段需要独立 fallback。

---

## 14. 阶段 2A Chunk 规则

Chunk 应由完整 Sources 组成。

TXT 文件最大允许大小与单次 AI Chunk 大小是两个概念。

即：

200 KB TXT

不等于：

一次 AI 请求发送 200 KB。

初期 Chunk 目标大小可以考虑：

约 1500～3000 中文字符

但应该通过配置常量实现。

不要把魔法数字散落到多个页面。

---

## 15. 阶段 2A 推荐纯函数

优先考虑建立：

normalizeText(text)

splitIntoParagraphs(text)

createSources(paragraphs)

createChunks(sources, options)

这些核心函数尽量：

不依赖 wx.*

保持纯 JavaScript。

这样以后：

TXT
PDF
DOCX

都可以复用。

---

## 16. 阶段 2A 验收标准

至少测试：

短 TXT

多段 TXT

大量空行

长段落

较大 TXT

必须确认：

- 原文没有意外丢失
- sourceId 全局唯一
- sourceId 顺序正确
- Chunk 不漏 Source
- Chunk 不重复 Source
- Chunk 顺序正确
- Chunk 边界合理
- 超长单段有明确处理结果
- 没有调用任何 AI
- 没有产生 AI 费用

可以建立开发测试视图：

原文字数：5230
Sources：37
Chunks：4

Chunk 1: P1-P9
Chunk 2: P10-P18
Chunk 3: P19-P27
Chunk 4: P28-P37

---

## 17. 阶段 2A 之后

阶段 2A 验证并提交以后：

阶段 2B：

建立 AI Provider 最小抽象。

然后：

阶段 2C：

短 TXT AI 整理 MVP。

然后逐步实现：

Chunk Merge

分析状态

断点恢复

费用保护

Material Outline

Material Knowledge

人工编辑

扩大 TXT 上限实际处理能力

之后才进入：

PDF

DOCX

Storage 升级

搜索

复习

账号 / 云同步

完整长期路线见：

PROJECT_HANDOFF.md

---

## 18. 新 AI 接管时禁止事项

新的 AI 不允许：

- 从零重写项目
- 立即大规模重构
- 推翻已验证的 Note AI 链路
- 直接把 200 KB TXT 整篇发给 AI
- 把 DeepSeek 写死为永久架构
- 把其他任何 Provider 写死为永久架构
- 未确认升级依赖
- 未确认修改生产云配置
- 把 API Key 写入前端
- 把 API Key / AppSecret / Token 提交 Git
- 自动删除 Demo / Test
- 使用 git add .
- 未经实际运行验证就声称功能完成

---

## 19. Git 工作规则

新任务开始前：

git status

确认：

branch

working tree

修改代码后：

先进行微信开发者工具人工验证。

提交前：

git diff --check

git status

git diff --stat

禁止默认：

git add .

应该明确：

git add file1 file2 ...

每个明确阶段完成后：

Git commit

然后更新：

PROJECT_HANDOFF.md

必要时同步更新：

AI_START_HERE.md

---

## 20. 新 AI 的第一项工作

新的 AI 对话读取本文件后：

不要立即修改代码。

首先完成：

1. git status
2. 确认当前 branch
3. 阅读当前实际项目代码
4. 如可读取，阅读 PROJECT_HANDOFF.md
5. 用代码核对本文件
6. 判断当前是否仍然处于阶段 2A

然后向用户报告：

A. 当前项目状态

B. 当前 Git 状态

C. 阶段 2A 的具体实施方案

D. 预计新增 / 修改哪些文件

E. 如何在微信开发者工具中验证

得到用户确认以后再开发。

---

## 21. 新 AI 无法读取 PROJECT_HANDOFF.md 时

如果当前 AI 平台无法读取 PROJECT_HANDOFF.md：

本 AI_START_HERE.md 可以作为最低限度的项目交接信息。

不要因为无法读取完整 PROJECT_HANDOFF.md 就从零设计项目。

当前代码仍然是最终事实来源。

如果 AI 同样无法直接读取整个代码仓库：

必须要求用户提供当前任务所需的具体文件内容或截图。

禁止根据缺失代码凭空假设现有实现。

---

## 22. 长期核心原则

文件格式可以增加。

AI Provider 可以替换。

AI Model 可以替换。

UI 可以变化。

但长期尽量保持：

原文是事实来源。

Source 可以追溯。

KnowledgePoint 引用真实 Source。

AI 输出必须校验。

用户修改不能被静默覆盖。

长资料必须分块。

收费 AI 必须由用户主动触发。

已完成 Chunk 不因后续失败重复调用。

Note 与 Material 最终逐渐共享核心能力。

当前 Provider：

DeepSeek

这代表当前已经实际验证成功的实现。

不代表产品永久依赖 DeepSeek。