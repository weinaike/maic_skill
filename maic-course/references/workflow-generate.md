# workflow-generate —— 课程内容生成（模块 2/4）

按**已冻结的大纲**（门1 通过）逐节生成场景文件 `scenes/NN-*.md`（画布 + 讲稿 + quiz），
经内容审查与规范审查闭环后到**门2（离线预览 + 人抽检）**。

前置：`outline.md` 冻结、`outline.mjs lint` 无 error。
必读：`references/design-system.md`（三层视觉体系权威：页型骨架 §5 + 主题包
themes/*.json + 容量预算）、`dsl-cheatsheet.md`（元素契约）、
`scene-source-spec.md`（源格式）、`layout-patterns.md`（渲染契约细则 +
T7+ 候选坐标）；大纲含 interactive 节时另读
`references/interactive-spec.md`（交互页全契约）。
**观感锚**：动笔前先看黄金样例 `maic-course/samples/platform.*.json`
（对齐观感，不抄文案）——主题的"示例即模板"机制（design-system §7-11）。

## 流程

### 1. 骨架

```bash
node scripts/generate.mjs scaffold <courseDir> [--scenes 3-5]   # 全部或指定节
```

每节生成 `NN-标题.md` 骨架（frontmatter + TODO 注释：画布意图/讲稿意图/字数预算
随骨架写入文件，生成时对着自己的 brief 填）。**增量**：已存在的场景跳过（--force 覆盖）。

### 2. 逐节生成（派发规则见 references/agents.md：≥3 节或自动模式用模板 A 派 sub agent，3-4 节并行 + 第 1 页先行做风格锚点 + 批后承接缝合；协作模式单节可主 Agent 直做）

（以下为主 Agent 直做时的规程，sub agent 的完整版已内置于模板 A）

**画布**（slide）——三层体系流程（design-system.md §2/§5）：
1. **选页型**：按内容性质映射到 T1-T6（对比选型→T1/T3、清单→T2、结构解剖→T4、
   流程机制→T5、原则收束→T6、封面→C），frontmatter 写 `layout: T1`；
   T1 可直接 `node scripts/generate.mjs skeleton <courseDir> T1 --spec spec.json
   --out NN-x.md` 展开（主题色已焙入）
2. **写画布**：按页型解剖逐元素写 canvas JSON（页头三件套 + 正文区 190-508；
   元素 id 用语义 slug）；**颜色一律 `$token` 引用**（`$panel.bg`、`$text.sub`、
   `$titleRule.color`…），不写裸 hex——换风格永远发生在主题层
3. **解析 token**：`node scripts/generate.mjs theme <file>`（落盘前把 $token
   换成主题具体色值；course.yaml `design.theme` 选包，缺省 platform）
4. `node scripts/generate.mjs normalize <file>`（补默认值/派生几何）
5. 立即 `node scripts/check.mjs <courseDir>`——本节无 error（含色板/页型 lint）
   才进下一节

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
gains/proficiency/language…），生成后 `check.mjs` 会过 validatePBLContent，且强制 v2 协议
（缺 projectV2 或携带 legacy projectConfig 均报 error）。

**interactive**（全契约见 `references/interactive-spec.md`，骨架模板在其 §5）：
- `## 内容` fence 写 `{type:'interactive', html, widgetType?, widgetConfig?}`——html 是
  **完整自包含文档**（16:9 横屏、1280×720 基准、流式布局、零外链或可降级）
- **先页面后讲稿**：HTML 先埋带语义 id 的状态/隐藏层/可高亮元素；讲稿 raw action
  的 `widget_*` 只引用既有 id
- 页面**必须自带** `window.addEventListener('message', …)` 监听器（平台不注入运行时，
  四个消息类型见 interactive-spec §2）
- **首帧自含主要信息**：视频导出会把页面冻结在 load 瞬间，`widget_reveal` 揭示的
  关键信息讲稿必须口播兜底
- **注意**：`check.mjs` 对 interactive 内容零校验（透传）——配对自检
  （interactive-spec §6）是唯一的机器外把关，必须做；抽检 = 提取 html 开 1280×720
  窗口核对

### 3. 审查闭环（每 ~3 节一批，或用户指定批大小）

1. `node scripts/check.mjs <courseDir>` —— 结构层先清零
2. **用模板 B 派独立审查 sub agent**（审查永远隔离——同上下文自审只找得到小毛病），
   按 `review-checklists.md` §内容审查 C1-C6 + §规范审查 S1-S6（含 S2.5 主题合规/
   S2.6 页型匹配）逐节审（interactive 场景另加 §交互审查 I1-I5）；findings 写
   `build/review/content-review.rN.json` 与 `build/review/spec-review.rN.json`
   （target 均为 `scenes`）
3. `node scripts/review.mjs verdict <courseDir>` —— open blocker ⇒ 生成者按 findings
   修复（改源）→ check → 重审（round+1），≤2 轮，仍 blocker ⇒ 停下升级用户

高频缺陷自查（生成时就避免，别等审查抓）：
- 讲稿说"这三点"但画布只有两卡（C1）
- spotlight 指向了装饰元素而非内容卡（C2）
- 要点页给了 1min 但讲稿写了 500 字（C5）
- 文本盒按字形尺寸写高度——平台内容盒四向内缩 10px，必然越界/偏下（按 layout-patterns
  「文本框预算」：行数×字号×行高+20；单行落色块内用 `vAlign:"middle"`）
- 单页塞两个完整配方（如 流程线+迭代环）——text>20 / 元素>36 即密度超限（S6）
- 画布写了裸 hex 而非 $token，或 token 解析后越出主题色板（S2.5，check 色板 lint）
- slide 场景忘写 frontmatter `layout`，或内容量超页型容量预算（S2.6/S4）
- 并排面板/同类卡各配一色——颜色纪律在主题包，不在页内（S2.5）
- interactive 页忘写 message 监听器 / widget_* 引用了页面不存在的 id（I1）
- interactive 关键信息只靠 widget_reveal 揭示、讲稿没口播（I5）

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
