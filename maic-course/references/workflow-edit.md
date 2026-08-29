# workflow-edit —— 课程编辑调整（模块 4/4）

用户的自然语言编辑指令 → 定位源文件 → **只改源** → 依赖级联收敛 → 全课终审 → 出包。

## 总原则

1. **编辑永远作用于源**（scenes/*.md、course.yaml、outline.md），产物靠重建
2. 每次编辑后跑 `node scripts/edit.mjs status <dir>` 看级联待办，清零才算完
3. 涉及内容语义变化的编辑（改观点/改数据/改题）→ 补跑对应 scope 审查

## 指令 → 操作 路由表

| 用户说 | 操作 | 级联 |
|---|---|---|
| "第 N 页讲稿改一下措辞 / 更口语" | 直接编辑该场景文件 讲稿 段落 | 该句音频失配 → `tts.mjs` 增量补；改动大则补 content 审查 |
| "这页重做 / 换个版式" | 按 layout-patterns 重写该页 canvas（走 workflow-generate 单页流程 + normalize） | 若元素 id 变了，检查 `@[elementId]` 悬空（check 会抓）；重跑 spec 审查该页 |
| "把第 N 页挪到第 M 位 / 调整顺序" | `node scripts/edit.mjs move <dir> N M` | outline 漂移 → 同步 outline.md 节号 |
| "删掉第 N 页" | `node scripts/edit.mjs delete <dir> N` | 死音频自动 prune；outline 同步 |
| "在 M 前插一页讲 XX" | `node scripts/edit.mjs insert <dir> M --type slide --title XX` | 走 workflow-generate 填充；outline 补节 |
| "加一道题 / 改题 / 改选项" | 编辑 quiz 场景 `## 题目` fence | 无音频级联；补 content 审查（C6） |
| "换个音色 / 说快一点" | `node scripts/edit.mjs voice <dir> --voice <id> [--speed 1.1]` | **全量重合成**（缓存键含音色/语速）：`tts.mjs --force` + `prune` |
| "换个配色 / 全局主题" | `node scripts/edit.mjs theme <dir> --colors a,b,c [--font F] [--bg #hex]` | 画布 theme 注入；**元素内联色不自动改写**——要彻底换肤需逐页调（向用户明示） |
| "课程名/描述/语言指令改一下" | 编辑 course.yaml（updatedAt 记得更新） | 无级联 |
| "改大纲：加一节/改要点" | 改 outline.md → lint → 对应场景按 generate 流程重做或新建 | 同 move/insert 级联 |

## 编辑后的收敛循环

```bash
node scripts/edit.mjs status <dir>     # 级联看板：①缺音频 ②审查过期 ③大纲漂移 ④TODO ⑤check
# 按提示逐项清零：
node scripts/tts.mjs verify <dir>      # ① 讲稿↔音频同步校验（失配/死音频/时长可疑）
node scripts/tts.mjs <dir>             # ① 增量补被改的句子
node scripts/review.mjs verdict <dir>  # ② 重新审查变更的 scope
node scripts/outline.mjs lint <dir>    # ③ 大纲对齐
node scripts/check.mjs <dir>           # ⑤ 结构校验
```

`status` exit 0 = 全部收敛，才进入终审。

## 全课终审（出包前最后一道，scope: full）

任何编辑批次之后、`build` 之前跑：

1. **跨场景一致性**：同一概念前后叫法一致、口吻统一、数字/结论无前后矛盾
2. **前后引用真实**："上一页讲过的 X"确实在前面出现过
3. **时长对账**：Σ(节时长) vs outline.totalMinutes 偏差 ≤20%；preview 里总音频时长
4. **术语与语言指令**符合 course.yaml language
5. findings 写 `build/review/full-review.rN.json`（target: full，全课）
6. open blocker ⇒ 修复重审（≤2 轮）；warning 呈报用户

## 出包与交付

```bash
node scripts/preview.mjs <dir> && open <dir>/build/preview.html   # 人最后过一遍
node scripts/build.mjs <dir>    # check error 门禁 + review blocker 门禁 → .maic.zip
```

协作模式：先 preview 再 build；自动模式：终审清零直接 build，产物路径与报告一起交付。

## 快速单页修复循环（用户点名"第 N 页有问题"时）

preview 定位 → 只动该页源 → `status` → 单页复检（check + 该页审查）→ 重新 preview。
不要因为一页问题触发全课重做——增量性是本模块的底线。
