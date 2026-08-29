# workflow-generate —— 课程内容生成（模块 2/4）

按**已冻结的大纲**（门1 通过）逐节生成场景文件 `scenes/NN-*.md`（画布 + 讲稿 + quiz），
经内容审查与规范审查闭环后到**门2（离线预览 + 人抽检）**。

前置：`outline.md` 冻结、`outline.mjs lint` 无 error。
必读：`references/layout-patterns.md`（版式配方）、`dsl-cheatsheet.md`（元素契约）、
`scene-source-spec.md`（源格式）。

## 流程

### 1. 骨架

```bash
node scripts/generate.mjs scaffold <courseDir> [--scenes 3-5]   # 全部或指定节
```

每节生成 `NN-标题.md` 骨架（frontmatter + TODO 注释：画布意图/讲稿意图/字数预算
随骨架写入文件，生成时对着自己的 brief 填）。**增量**：已存在的场景跳过（--force 覆盖）。

### 2. 逐节生成（派发规则见 references/agents.md：≥3 节或自动模式用模板 A 派 sub agent，3-4 节并行 + 第 1 页先行做风格锚点 + 批后承接缝合；协作模式单节可主 Agent 直做）

（以下为主 Agent 直做时的规程，sub agent 的完整版已内置于模板 A）

**画布**（slide）：
1. 由大纲"画布意图"关键词选配方（layout-patterns.md）：封面/三栏卡/四栏卡/2×2/
   左色条卡/数字模块/表格对比/流程/图文/大字结论
2. 按配方**坐标骨架**逐元素写 canvas JSON（页头 + 正文区；元素 id 用语义 slug，
   如 `text_card1_title`）
3. 填内容：要点 → 卡片标题/正文；字号按层级表；色板从 theme.themeColors 派生浅色底
4. `node scripts/generate.mjs normalize <file>`（补默认值/派生几何）
5. 立即 `node scripts/check.mjs <courseDir>`——本节无 error 才进下一节

**讲稿**（所有类型场景，**遵循 references/speech-style.md 十条规范**）：
- 按 TODO 里的字数预算（分钟 × 350 字 ±15%，豆包实测语速）拆段，**一段 = 一个要点**
- 首段承接上页（"上一页我们看到…，接下来…"），末段收口或引出下页
- **口语化**：是"说"不是"读"——短句、承接词、指代画布（"大家看左边这栏"）
- spotlight 对齐：讲到哪张卡，该段尾注 `@[该卡标题元素id]`；一段最多 1-2 个
- 术语遵循 course.yaml `language` 指令（如 Agent/MCP 保留英文）
- 单段 ≤120 字；段落间空行分隔（源格式）

**quiz**：按 quiz 意图出题——题干来自本页要点；干扰项写**常见误解**（不是凑数错项）；
每题必填 `analysis`（讲清为什么）；单选/多选/简答与考点匹配。

**pbl**：projectV2 按 dsl `PBLProject` 形状生成（title/description/learningObjective/
gains/proficiency/language…），生成后 `check.mjs` 会过 validatePBLContent。

### 3. 审查闭环（每 ~3 节一批，或用户指定批大小）

1. `node scripts/check.mjs <courseDir>` —— 结构层先清零
2. **用模板 B 派独立审查 sub agent**（审查永远隔离——同上下文自审只找得到小毛病），
   按 `review-checklists.md` §内容审查 C1-C6 + §规范审查 S1-S5 逐节审；findings 写
   `build/review/content-review.rN.json` 与 `build/review/spec-review.rN.json`
   （target 均为 `scenes`）
3. `node scripts/review.mjs verdict <courseDir>` —— open blocker ⇒ 生成者按 findings
   修复（改源）→ check → 重审（round+1），≤2 轮，仍 blocker ⇒ 停下升级用户

高频缺陷自查（生成时就避免，别等审查抓）：
- 讲稿说"这三点"但画布只有两卡（C1）
- spotlight 指向了装饰元素而非内容卡（C2）
- 要点页给了 1min 但讲稿写了 500 字（C5）
- 卡片浅底全用同一色系（S1/S2）

### 4. 门2 —— 预览抽检（协作模式）

```bash
node scripts/preview.mjs <courseDir>
open <courseDir>/build/preview.html
```

向用户呈现：preview 链接 + 审查结论。用户抽检版式与讲稿；点名重做的页
回到步骤 2 只重做该页（`scaffold --force` 或直接改文件），重跑该页审查。

### 5. 完成判据

- 所有场景文件无 TODO 残留（`grep -r "TODO" scenes/` 为空）
- `check.mjs` 0 error；`review.mjs verdict` 0 open blocker
- `outline.mjs lint` 交叉校验无漂移
- （M4 之前）讲稿缺音频是预期状态——preview 会标注"缺音频"，语音模块补齐

## 自动模式

用户说全自动时：跳过门2确认；批大小 = 全部；审查闭环照跑（≤2 轮修复）；
未解决 blocker 停下升级。完成后直接给出 preview 路径与审查报告摘要。
