---
name: maic-course
description: 在 Claude Code 中创作符合 OpenMAIC DSL 协议的课程：大纲生成、课程内容生成、语音配套（TTS）、编辑调整与审查，产物为可直接导入 OpenMAIC 平台播放的 .maic.zip。当用户要"创建/生成/编辑 MAIC 课程"、提到课程大纲、讲稿、课件、配音、.maic.zip 导入导出、或解包已有 .maic.zip 课程时使用。
---

# maic-course —— OpenMAIC 课程创作 skill

把"课程"当作一个**源码项目**（人擅长改的大纲与讲稿 + agent 生成的画布 JSON），
编译产出平台可导入的 `.maic.zip`。四个功能模块（大纲 / 内容 / 语音 / 编辑）+ 贯穿的
编译-校验-打包管线。**自动执行时每个生成环节后必须跑对应审查（见 references/workflow 路由）。**

## 快速路由

| 用户意图 | 动作 |
|---|---|
| 新建课程 / 从 brief 出大纲 | **workflow-outline**：interview 或 brief → `outline.md` → lint → 大纲审查闭环 → 门1 冻结 |
| 解包课程后补大纲 | `node scripts/outline.mjs sync <dir>` → 充实 → lint → 审查 |
| 审查 / 复审 | `node scripts/review.mjs …`（规程见 review-checklists.md） |
| 逐页生成课件与讲稿 | workflow-generate（M3）：按大纲生成 `scenes/NN-*.md` → 内容+规范审查 → preview |
| 给讲稿配音 | workflow-voice（M4）：TTS 合成进 `audio/` + voice.lock（env 配置见下） |
| 改课程（任何措辞/顺序/版式） | workflow-edit（M5）：**只改源**，随后按需增量重合成/重校验 |
| 解包已有 .maic.zip 继续编辑 | `node scripts/unpack.mjs <zip> <dir>` |
| 出包 / 交付 | `node scripts/build.mjs <dir>`（内置 check error 门禁 + review blocker 门禁） |

## 命令（scripts/，零依赖 node ≥ 20）

```bash
node scripts/setup.mjs                  # 同步 @openmaic/dsl dist 到 vendor/ + 环境体检（首次必跑）
node scripts/unpack.mjs <a.maic.zip> <courseDir> [--force]
node scripts/outline.mjs lint|sync <courseDir>     # 大纲结构校验 / 从场景反推大纲
node scripts/review.mjs init|validate|verdict …    # 审查 findings（blocker 门禁）
node scripts/compile.mjs <courseDir> [--stdout]     # 源 → manifest（确定性、无损）
node scripts/check.mjs  <courseDir>     # 三层校验：DSL 契约 / 文档 lint / 导入模拟（error 时 exit 1）
node scripts/build.mjs  <courseDir>     # compile + check/review 门禁 + zip(store) → build/<name>.maic.zip
```

工作目录即课程项目；产物永远在 `<courseDir>/build/`，**不要手改产物**。

## 必读 references（按任务加载，不要一次全读）

- `references/scene-source-spec.md` —— 源格式全契约（**编辑任何课程文件前必读**）
- `references/maic-format.md` —— .maic.zip manifest 契约 + 平台导入器真实验收逻辑
- `references/dsl-cheatsheet.md` —— 画布元素 / 动作类型 / 主题 / 白名单（**生成画布前必读**）
- `references/workflow-outline.md` —— 大纲模块流程（**做大纲前必读**）
- `references/review-checklists.md` —— 审查框架规则 + 三类清单（**任何审查前必读**）
- `references/layout-patterns.md` —— 版式配方（M3 落地）
- `references/workflow-{generate,voice,edit}.md` —— 其余模块流程（M3-M5 落地）

## 环境变量（语音模块，M4；豆包首发、可替换）

```bash
MAIC_TTS_PROVIDER=doubao   # doubao | openai-compatible | edge | platform
MAIC_TTS_API_KEY=          # 豆包：Agent Plan key（ark-…）或 "appId:accessKey"
MAIC_TTS_BASE_URL=         # 可选端点覆盖
MAIC_TTS_VOICE=            # 音色，如 zh_male_liufei_uranus_bigtts
MAIC_TTS_SPEED=1.0
MAIC_TTS_MODEL=            # openai-compatible 专用
```

连接信息只在 env；course.yaml 只存非密钥偏好（默认音色名等）。

## 硬性规则

1. 编辑永远作用于源文件（scenes/*.md、course.yaml），改完必须 `check`；讲稿文本变了 ⇒ 受影响音频自动失配，需重跑 voice（键 = hash(text|voice|speed)）。
2. `build` 的 error 门禁不可绕过；warnings 需在报告里向用户明示。
3. 画布 text 元素 content 只用白名单 HTML（p/span/br/b/strong/i/em/u/a + 限定 style 属性）。
4. 场景顺序 = 文件名数字前缀；重排序 = 改名。
5. 自动模式（用户说全自动/不要问我）下，每个生成环节后仍必须执行对应审查并自动修复（≤2 轮），审查报告落 `build/review/`，未解决的 blocker 必须停下升级给人。
