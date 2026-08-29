# maic_skill —— OpenMAIC 课程创作 skill（maic-course）

在 Claude Code 中离线创作符合 `@openmaic/dsl` 协议的课程，产出可直接导入
OpenMAIC 平台播放的 `.maic.zip`。四个功能模块 + 审查体系 + 编译/校验/打包管线。

## 设计要点

- **课程即源码项目**：人擅长改的（大纲、讲稿 Markdown）与 agent 生成的（画布坐标级 JSON）
  分层共存于一个 git 友好目录；产物永远编译生成，可随时重建。
- **确定性编译**：动作 id 内容哈希铸造 ⇒ 源不变 manifest 逐字节稳定；黄金测试证明
  unpack→compile 与平台原生导出深度相等。
- **三层校验门禁**：L1 DSL 契约（vendored `@openmaic/dsl`）→ L2 文档 lint（audioRef/
  elementId/媒体交叉引用、HTML 白名单、几何越界）→ L3 平台导入模拟（逐条复刻
  `use-import-classroom` 的验收语义）。error 拒绝出包。
- **审查体系（自动化必备）**：大纲审查 / 内容审查 / 规范审查，独立 reviewer + findings
  落盘 `build/review/` + 有界自动修复闭环（≤2 轮，未解决 blocker 升级给人）。
- **TTS 可插拔**：豆包首发（对齐平台 `generateDoubaoTTS` 契约，同一把 key 两边通用），
  `MAIC_TTS_*` 环境变量配置；讲稿-音频经 `voice.lock.yaml` 哈希缓存，改一句只重合成一句。

## 目录

```
maic-course/     skill 本体（自包含，可整体 symlink 到 ~/.claude/skills/ 或项目 .claude/skills/）
  SKILL.md       入口 + 路由 + 硬性规则
  references/    契约文档：scene-source-spec / maic-format / dsl-cheatsheet（+M2+ 的 layout-patterns、review-checklists、workflow-*）
  scripts/       setup / unpack / compile / check / build（+M4 的 tts、preview）
  templates/     新课程骨架
  vendor/dsl/    @openmaic/dsl dist 副本（setup 同步，gitignore）
courses/         本地课程项目（样例：00-agent-intro）
test/            golden-roundtrip.mjs
```

## 安装

```bash
node maic-course/scripts/setup.mjs          # vendor DSL dist + 环境体检（需要 zip/unzip/ffprobe）
# 作为个人 skill（任意目录可用）：
ln -s "$(pwd)/maic-course" ~/.claude/skills/maic-course
# 或作为项目 skill（仅该 repo 内会话）：
ln -s "$(pwd)/maic-course" /path/to/OpenMAIC/.claude/skills/maic-course
```

## 使用

```bash
# 解包一门平台导出的课程继续编辑
node maic-course/scripts/unpack.mjs ~/Desktop/00.Agent*.maic.zip courses/00-agent-intro

# 校验 / 出包
node maic-course/scripts/check.mjs courses/00-agent-intro
node maic-course/scripts/build.mjs courses/00-agent-intro
# → courses/00-agent-intro/build/00.Agent-系列课程介绍.maic.zip
# 平台 → 课程列表 → 导入 → 选择该 zip

# 大纲（解包课程反推骨架 → 充实 → 审查）
node maic-course/scripts/outline.mjs sync courses/00-agent-intro
node maic-course/scripts/outline.mjs lint courses/00-agent-intro
```

在 Claude Code 会话中直接对话（"帮我生成大纲/给这页配音/把第 3 页改成两栏"），
skill 按 SKILL.md 路由。

## 里程碑

| M | 内容 | 状态 |
|---|------|------|
| M1 | 骨架 + 编译/三层校验/打包 + 黄金测试 | ✅ 完成（`node test/golden-roundtrip.mjs` 三项全过） |
| M2 | 审查框架 + outline 模块（大纲审查闭环） | ✅ 完成（findings 门禁已接入 build；outline lint/sync） |
| M3 | generate 模块（内容+规范审查、修复闭环、版式配方、preview） | ✅ 完成（layout-patterns 校准坐标；generate scaffold/normalize；preview 离线审片台） |
| M4 | voice 模块（豆包 adapter + env + doctor + 哈希缓存） | ✅ 完成（**真实豆包合成验证**；改一句只重合成一句；prune 死音频清理） |
| M5 | edit 模块 + 全课终审 | ⬜ |
| M6 | `--auto` 全自动打磨 + 文档 | ⬜ |

## 已知事实（实现时踩过/验证过）

- 平台仓库的 `packages/@openmaic/dsl/dist` 可能落后于源码（本 skill 开发时即如此）；
  先 `pnpm --filter @openmaic/dsl build` 再 `setup.mjs`。当前 vendor 的 `DSL_VERSION = 0.3.0`。
- 平台导出的 zip 用 store（不压缩）；本 skill 同样用 `zip -X -0`，字节习惯一致。
- 真实课程（00.Agent）的画布里存在装饰性出血形状（故意越界）与孤儿媒体文件——
  check 对这两类只报 warning，与平台自身行为一致。
- 平台导入器把 `media/<文件名主干>` 当作画布元素 id 挂媒体；主干不匹配只是媒体悬空，不炸导入。
