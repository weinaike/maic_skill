---
name: maic-course
description: 在 Claude Code 中创作符合 OpenMAIC DSL 协议的课程：大纲生成、课程内容生成、语音配套（TTS）、编辑调整与审查，产物为可直接导入 OpenMAIC 平台播放的 .maic.zip。当用户要"创建/生成/编辑 MAIC 课程"、提到课程大纲、讲稿、课件、配音、.maic.zip 导入导出、或解包已有 .maic.zip 课程时使用。
---

# maic-course —— OpenMAIC 课程创作 skill

把"课程"当作一个**源码项目**（人擅长改的大纲与讲稿 + agent 生成的画布 JSON），
编译产出平台可导入的 `.maic.zip`。四个功能模块（大纲 / 内容 / 语音 / 编辑）+ 贯穿的
编译-校验-打包管线。**自动执行时每个生成环节后必须跑对应审查（规程见 review-checklists.md
与各 workflow-*.md；全自动串联见 workflow-auto.md）。**

## 快速路由

| 用户意图 | 动作 |
|---|---|
| 全自动出课（brief 进 zip 出） | **workflow-auto**：init → 大纲+审查 → 生成+审查 → 语音 → 全课终审 → build → 报告 |
| 新建课程 / 从 brief 出大纲 | **workflow-outline**：interview 或 brief → `outline.md` → lint → 大纲审查闭环 → 门1 冻结 |
| 解包课程后补大纲 | `node scripts/outline.mjs sync <dir>` → 充实 → lint → 审查 |
| 审查 / 复审 | `node scripts/review.mjs …`（规程见 review-checklists.md） |
| 逐页生成课件与讲稿 | **workflow-generate**：scaffold → 逐节生成（配方库+normalize+check）→ 内容/规范审查闭环 → 门2 预览抽检 |
| 离线预览 / 审片 | `node scripts/preview.mjs <dir>` → `open <dir>/build/preview.html` |
| 给讲稿配音 | **workflow-voice**：doctor → 门3 讲稿终审 → dry-run 成本清单 → 增量合成 → prune → 审片 |
| 改课程（任何措辞/顺序/版式/音色/配色） | **workflow-edit**：指令路由表 → 只改源 → `edit.mjs status` 级联收敛 → 全课终审 |
| 解包已有 .maic.zip 继续编辑 | `node scripts/unpack.mjs <zip> <dir>` |
| 出包 / 交付 | `node scripts/build.mjs <dir>`（内置 check error 门禁 + review blocker 门禁） |

## 命令（scripts/，零依赖 node ≥ 20）

```bash
node scripts/setup.mjs                  # 同步 @openmaic/dsl dist 到 vendor/ + 环境体检（首次必跑）
node scripts/setup.mjs --check          # skill 完整性自检（SKILL·文档·脚本·dsl 四层）
node scripts/init.mjs <dir> --name 课程名 [--audience …]   # 新课程脚手架
node scripts/unpack.mjs <a.maic.zip> <courseDir> [--force]
node scripts/outline.mjs lint|sync <courseDir>     # 大纲结构校验 / 从场景反推大纲
node scripts/generate.mjs scaffold <courseDir> [--scenes 3-5]   # 从大纲生成场景骨架
node scripts/generate.mjs normalize <scene.md>…    # 生成画布补 DSL 默认值（只对生成场景用）
node scripts/review.mjs init|validate|verdict …    # 审查 findings（blocker 门禁）
node scripts/compile.mjs <courseDir> [--stdout]     # 源 → manifest（确定性、无损）
node scripts/check.mjs  <courseDir>     # 三层校验：DSL 契约 / 文档 lint / 导入模拟（error 时 exit 1）
node scripts/preview.mjs <courseDir>    # 离线审片台 build/preview.html（门2 产物）
node scripts/tts.mjs doctor|prune …     # 语音连通检查 / 死音频清理
node scripts/tts.mjs <courseDir> [--dry-run] [--force] [--scenes 3-5]   # 增量 TTS 合成
node scripts/edit.mjs status|move|delete|insert|theme|voice …  # 编辑操作 + 级联看板
node scripts/build.mjs  <courseDir>     # compile + check/review 门禁 + zip(store) → build/<name>.maic.zip
```

工作目录即课程项目；产物永远在 `<courseDir>/build/`，**不要手改产物**。

## 必读 references（按任务加载，不要一次全读）

- `references/scene-source-spec.md` —— 源格式全契约（**编辑任何课程文件前必读**）
- `references/maic-format.md` —— .maic.zip manifest 契约 + 平台导入器真实验收逻辑
- `references/dsl-cheatsheet.md` —— 画布元素 / 动作类型 / 主题 / 白名单（**生成画布前必读**）
- `references/workflow-outline.md` —— 大纲模块流程（**做大纲前必读**）
- `references/workflow-generate.md` —— 生成模块流程（**生成场景前必读**）
- `references/layout-patterns.md` —— 版式配方库，校准坐标（**写画布时必读**）
- `references/review-checklists.md` —— 审查框架规则 + 三类清单（**任何审查前必读**）
- `references/workflow-voice.md` —— 语音模块流程 + 密钥/音色参考（**配音前必读**）
- `references/workflow-edit.md` —— 编辑模块：指令路由表 + 级联收敛 + 全课终审（**任何编辑前必读**）
- `references/workflow-auto.md` —— 全自动模式流水线 + 停止红线 + 报告模板（**自动出课前必读**）

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
