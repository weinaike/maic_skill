# maic-course 视觉设计系统 —— 架构规范与决策记录

> 状态：**方案已获用户认可（2026-09-07），待落地**。本文档是唯一权威来源；
> 课程级实验稿在 `courses/06-skill/DESIGN.md`（将并入本体系后废弃）。

## 0. 目标（用户原话归纳）

1. maic_skill 生成的课程要**和平台观感一致**（平台 = OpenMAIC，其官方课程
   样式签名见 §1）
2. 同时**留出制作其他风格课程的空间**
3. 解法：**结构固定、皮肤可换**——骨架不认识颜色，颜色不认识布局

## 1. 平台证据（逆向结论，2026-09-07 实测）

来源：`/home/wnk/code/OpenMAIC/data/01-06*.maic.zip`（平台官方课程）+
`packages/@openmaic/generation/`（生成管线源码）。

### 1.1 平台的固定样式签名（三课交叉验证：01 Token / 02 Prompt / 04 Agent）

```
封面    深底 #0f172a + 大彩色装饰圆（#1e3a8a/#4c1d95/#312e81/#6b21a8 蓝紫系）
内容页  text  60,50  880×62-74            页标题
        shape 70,116-136 (80|860)×2-4     标题下划线（两种款式并存，见 1.3）
        text  60,118-140 880×44-56 灰     可选副标题
        shape 60,~150-210 浅蓝底卡         #eff6ff/#e8f4fd/#e3f2fd/#eef5ff/#f0f7ff
        shape 60,同y 4-6px 彩色左条        #3b82f6/#2563eb/#4285f4/#1976d2/#5b9bd5
语义色  绿卡 #dcfce7 / 橙警示 #fff3e0 / 红警示 #d93025
```

### 1.2 平台为什么"固定"——三个机制

1. **公式锁骨架**：`generation/templates/slide-content/system.md` 的 Design
   Rules（页边 60、标题 50、下划线 `left+10/width−20/高2-4`、间距表、字号表）
2. **查表锁高度**：Height Lookup Table（字号×行数→高度，= 20px padding +
   行数×字号×1.5 + 2px 余量；**此表直接采纳进我们的 L0**）
3. **示例即模板（主因）**：system.md few-shot 示例带具体色值（卡片示例
   `#e8f4fd`、三栏示例 `#dbeafe/#dcfce7/#fef3c7`），课 02 的实际用色与示例
   **逐字相同**——模型每页照抄示例，"固定样式"是示例 JSON 的复制品

### 1.3 平台的缺陷（我们的机会）

- **无主题系统**：theme 五色硬编码（scene-builder.ts:39），无选择入口；
  大纲提取的 "Visual style (minimal/colorful/…)" 字段**断线**未传入 slide 提示词
- **无版式模板**：`SlideTemplate` 接口是 PPTist 遗迹，全仓库零使用；
  每页独立生成（无前页上下文），跨课漂移已发生：**下划线课 02 全 860 通栏、
  课 01 混用、课 06 全 80 短线**——示例锚定的天花板
- 只有防错规则（契约层），没有视觉系统层

## 2. 三层架构

```
L0 契约层（永不变，全主题共用）  渲染契约 / 高度查表 / check 门禁（预算/重叠/密度）
L2 页型骨架（结构）              6 个骨架 JSON：坐标、层级、解剖。
                                颜色一律写 token 引用（$card-bg、$accent），禁色值
L1 主题包（皮肤）                themes/<name>.json：token → 色值/字体/装饰件
                                第一个：platform（§1.1 逆向校准）
```

生成流程：大纲标页型 → `generate.mjs` 读 `course.yaml` 的 `design.theme`
→ 骨架展开 + token 解析为具体色值 → 落盘 canvas JSON（平台 DSL 不认 token，
落盘前必须解析完）。**换风格 = 新增一个主题 json + course.yaml 改一行**。

## 3. 粒度划分（锁死 vs 归主题）

| 锁死（结构，全主题一致） | 归主题（皮肤，可换） |
|---|---|
| 字号阶梯 28/24/18/16/15/13/12 | 全部颜色（页面底/卡底/左条/各级文字/强调） |
| **内容页字号天花板 32**（页标题 28；单页唯一强调元素 ≤32；40+ 只属于封面 36；48 禁用） | 字体族、圆角、卡片底样式 |
| 行语法：18px 粗题 + 13px 灰副（可带 `n ·` 行内序号 / mono 命令副行） | 封面母题（深底大圆 vs 其他） |
| 页头三件套 (60,50 / 70,116 / 60,130) 与正文区 190–508 | 下划线款式（通栏 860 / 短线 80）、标题条深浅 |
| 密度预算：text≤18 / 元素≤26 / **内容页字数 110-220**（平台中位 145，check 上限 20/36） | 语义色变体（good/warn/danger） |
| 面板解剖：底 + 标题条(48px) + 行组(行高 66，间距 ≥12) | |

行盒高度速查（L0，来自平台表 + 实测校准）：单行 18px→48、16px→44、
13px→40、12px→38；两行（18+13 lh1.4）→66；均含 10px×2 padding。

## 4. platform 主题包（`themes/platform.json`，已落盘 2026-09-07）

**权威文件是 `maic-course/themes/platform.json`**，此处只记决策与证据。
色值来源：data/ 01/02/04 三课 38 页元素级频次统计（脚本
`/tmp/maic-ref/color-stats.mjs`），按几何特征分类（下划线 h≤5 宽 shape /
左条 w≤8 / 大浅卡 / 文字色 / 封面深底页）。

统计对草案的关键校准（与 §1.1 目测的差异）：

| token | 草案 | 校准后 | 证据 |
|---|---|---|---|
| titleRule.color | #5b9bd5 | **#3b82f6** | 下划线频次 17:15 略胜；且**短线款(80)只与 #3b82f6 同现**，#5b9bd5 全是 200+ 宽——短线+蓝6 是自洽变体，降级为 altColor |
| panel.warn | #fff3e0 | **#fef3c7** | 琥珀卡频次 #fef3c7×15 ≫ #fff3e0×2，且带一族变体（#fffbeb/#fff7ed…）全量收录 |
| 语义卡深字 | 无 | **info #1e40af / good #166534 / warn #92400e / danger #991b1b** | 浅卡上的文字永远用同族深色（#1e40af×32 居文字色第 3 位）——accent 与浅底成对定义（KingDee/Mck 机制，平台原生存在） |
| cover.text | 无 | **#f1f5f9 主 / #93c5fd 强调 / #94a3b8 弱** | 三课封面文字实测 |
| canvas.theme | 5 色 | **整块收录**（含 outline/shadow） | 三课逐字相同=scene-builder.ts:39 硬编码，生成时整块照抄 |

新字段（§9.2 采纳）：`seq[]`（实例轮换，platform 全蓝系近色趋同；他主题可放彩）、
`panelSeq[]`（并列多卡轮换槽：成对定义 bg+text+bar+sub，如绿/蓝/橙/紫，使多栏卡片在保持主题可控与 lint 合规的前提下呈现丰富色彩）、
`forbidden[]`（含"正文禁纯黑，最深 #1e293b"）、`rules[]`（构图约束）。
**色板 lint 约定**：check.mjs 递归收集主题文件内所有 `#hex` 即合法色集——
主题文件本身就是色板，无第二份清单。

**开放决策**（未拍板前默认 short）：`titleRule.style` = `underline-short`
（80×3，课 01/06 主流）还是 `underline-full`（860 通栏，课 02 主流）。

## 5. 页型骨架（6 个，变化点声明制）

每页型声明四件事：**解剖**（结构）、**变化点**（仅此处允许变）、
**容量预算**（超限=check 报错，借 Mck layout-matrix 思路）、**密度档**。
场景 frontmatter 标 `layout: T1` 身份标记，check.mjs 据此分档 lint、
并拒绝未登记页型（借 guizang layout-lock 思路）。

| 模板 | 解剖 | 变化点 | 容量预算（初稿，06-skill 实测定稿） | 密度档 |
|---|---|---|---|---|
| T1 双面板 | 等宽 panel×2（各=底+标题条+3行），同 y 同高同底色 | 行数 2-4、序号 L/R/无、宽比 1:1/3:2 | 行 2-4/侧；行题 ≤12 字；副行 ≤22 字；110-240 字 | 中 |
| T2 清单页 | 单 panel（标题条+4-6 行） | 行数、mono 副行有无 | 行 4-6；行题 ≤12 字；副行 ≤26 字；130-260 字 | 中高 |
| T3 结论页 | 结论带（28-32px）+ 依据行 2-3 | 结论字号、依据行数 | 结论 ≤16 字；依据行 2-3 × ≤20 字；110-160 字 | 低 |
| T4 解剖页 | 主体命名（32px mono）+ 双清单 panel | 清单 mono/文本、左右比例 | 主体 ≤14 字；清单 3-5 行/侧 × ≤14 字；110-250 字 | 中 |
| T5 流程页 | 3-4 拍横排节点 + 箭头 | 节点数、节点内行数 | 节点 3-4；节点题 ≤8 字；节点注 ≤14 字 ×2 行；130-220 字 | 中 |
| T6 原则页 | 关键词 2-4 枚（24-28px）+ 每词两行注（定义+示例） | 枚数、强调色用否 | 词 2-4 枚 × ≤6 字；注每词 ≤40 字；130-220 字 | 中 |

页型全局纪律（多项目交叉采纳）：
- **结构主角，不是字号主角**（2026-09-07 平台密度校准后修订）：每页一个
  视觉锚 = 面积/位置/色占优的主卡或主面板；**内容页非页标题字号 ≤32**
  （页标题 28；单页至多一个 32px 元素；40+ 只属于封面；48 禁用）。
  平台三课 38 页实测：内容页最大字号 28-36、无 40+；密度靠卡片装真内容
  （中位 145 字/页），不靠口号大字——"大字太多内容少"是发布会美学，
  培训课美学是结构密度
- **副行装实物**：13px 副行写命令/参数/文件名/判据/数字，不写口号；
  讲稿负责解释，画布负责可查
- **连接符**：面板间"先后/流向"关系用一枚 accent 三角（16-18px）表达，
  不画线不画箭头链
- **扩展不换系**：缺页型 = 在当前主题内新造并回填注册表（§5 表 + T7+ 候选
  §9.3），永不跨包拼接；新页夹在老页中间看不出是外来户
- **节奏交替**：连续 3 页同页型/同构图 = check warning（借 visual-explainer
  构图多样性规则；课级页序模板见 §7 第 12 项）

**结构锚点实现**：`courses/06-skill/scenes/05-*.md` 当前版（对称双面板 +
标题条版）= T1 的参照物；骨架 JSON 化时以它为准。

## 6. 防漂移：check.mjs 主题合规 lint

- 校验画布所有色值（fill + content 内 color）∈ 当前主题包色板（允许
  主题包内声明的语义变体）→ 越界 = warning
- 既有 L2 规则（预算/字形重叠/密度）与颜色无关，天然跨主题
- 风格自由只发生在**选主题/建主题**时，不发生在逐页生成时

## 7. 落地清单（顺序执行）

1. [x] `themes/platform.json` 落盘（2026-09-07 三课元素级统计，见 §4）
2. [x] `generate.mjs`：design.theme 读取（lib/theme.mjs）+ `theme` 子命令
   （$token 解析，色值字段严格/内容文本尽力）+ `skeleton` 子命令
   （skeletons/T1.json 锚自黄金样例，未锚页型拒绝展开）；serializeSceneMd
   保真 layout 标记
3. [x] `check.mjs`：主题色板 lint（越界=warning；主题文件即色板）
4. [x] §5 换 platform 皮验证（2026-09-07：只改色值不动结构，DOM 实测
   `#eff6ff`×2+`#dbeafe`×2+`#3b82f6` 落位；前后截图 skin-before/after-05.png）
5. [x] 06-skill 其余 9 页换 platform 皮（2026-09-07：脚本化换色 + 页型打标
   01=C 02=T6 03=T4 04=T5 05=T1 06=T4 07=T6 08=T4 09=T1 10=T5，无三连同型；
   全课 check 0 error；讲稿/音频/spotlight id 未动）
6. [x] `courses/06-skill/DESIGN.md` 已并入（主角语法进 §5 全局纪律）并删除；
   layout-patterns.md 重定位为"渲染契约细则 + T7+ 候选坐标缓存"（权威让位本文件）
7. [x] workflow-generate.md（三层流程：选页型→$token→theme 解析→check；
   高频缺陷同步）/ review-checklists.md（新增 S2.5 主题合规、S2.6 页型匹配）
8. [x] 历史：上一轮已修的 check 估算器混排字号缺陷（check.mjs
   estimateTextNeed 按行内声明字号估宽高）保持有效
9. [x] check.mjs 页型 lint：frontmatter `layout` 身份（未登记=error；
   C 封面已注册）+ 容量预算分档（T1 以黄金锚点定 pageChars 240/行分侧
   2-4；T4 行语法可选）+ 连续 3 页同型 warning。**宽限期结束**：06-skill
   已全课打标，新课程 slide 无 layout 标记将逐步升 error（当前 info）
10. [x] platform.json 含 `seq`/`forbidden`/`rules` 字段（§9.2 采纳）
11. [x] 黄金样例入库：`maic-course/samples/platform.T1.json`（16 元素）+
    `platform.T5.json`（20 元素）；workflow-generate 已把"动笔前先看样例"
    设为必读锚——平台"示例即模板"机制从此是显式设计
12. [ ] 课级页序节奏层（讲授课/实操课/复习课各自的页型序列模板 +
    `max_consecutive_same` 约束）——T1-T6 全落地后做

附带产出：preview.mjs 支持 `#s5` 深链直达场景（审片定位与无头截图共用）。

## 8. 外部参考模板评估框架（用户将提供参考模板，按此决策）

用户后续会投喂参考模板。逐份按四问评估，产出"采纳 / 改造后采纳 / 拒绝"：

1. **它解决结构还是皮肤？** 结构（布局/层级/节奏）→ 进 L2 候选骨架；
   皮肤（配色/字体/质感）→ 进 L1 候选主题包；两者都动 → 拆开评估
2. **有益判断**：是否提供我们 6 页型没有的场景解法（如时间线、数据表、
   代码对比分屏）？是否比现有骨架更利于"一页一个主角"？密度是否在我们的
   预算内？
3. **限制自由判断**：是否绑死色值（拒绝——必须 token 化）？是否只有单一
   页型（拒绝作为骨架、可作单页特例）？是否要求平台 DSL 不支持的元素
   （阴影/描边/渐变字——拒绝或降级）？变化点是否太少（<2 个声明维度 →
   太死，除非场景极固定）？
4. **场景匹配**：内容性质 ↔ 页型映射表——流程/机制→T5，对比选型→T1/T3，
   清单/目录→T2，结构解剖→T4，原则收束→T6，数据/时间线/代码分屏→新页型
   候选（T7+，须声明变化点后入库）

每份评估结论回写本文件 §9。该框架已于 2026-09-07 经 `/home/wnk/code/html-course/`
24 项目批量验证（结论见 §9）；实践补充——最常见的三类拒绝理由：①运行时机制
不可迁移（CSS 变量运行时换肤/JS 动效，DSL 无运行时）②动画层 N/A（画布无动画，
动画属 actions 编排域）③规模目标不符（主题市场/多格式分发，我们只要 1 默认
+可扩展）。

## 9. 参考模板评估记录

### 9.1 批量调研：`/home/wnk/code/html-course/` 24 项目（2026-09-07）

6 组并行调研（代码管线 / SKILL 型 PPT 技能 / 模板集合 / design-token 派 /
frontend-slides 家族 / 动画解说派）。逐组定位：

| 组 | 代表项目 | 构建方式一句话 | 关键借鉴 |
|---|---|---|---|
| 代码管线 | open-slide / NanoBanana / Auto-Slides | theme md+demo+design const 三件套；风格md×页型×内容三段拼接；plan→验证→修复环 | open-slide 三层与我们几乎一一对应 |
| SKILL 型 | html-ppt-skill / guizang / ppt-agent / huashu | base.css token+36 主题 css+31 页型文件；S01-S22 版式锁+validator；style.json+density_contract；无模板、2 页 showcase 定 grammar | 三层同构度最高的一组 |
| 模板集合 | beautiful-html-templates | 34 模板；新 7 个 ZONE A(token)/ZONE B(engine) 单文件分区 + 9 语义页型 class | ZONE 分层注释契约；"扩展不换系" |
| design-token | KingDee / Mck / slide-writer / ppt-svg | 唯一定义源+语义色槽；char_budget 矩阵+机读门禁；主题包三段式+内容形态决策表；同构风格包 | 机制密度最高，多数直接可抄 |
| slides 家族 | frontend-slides→editable→next-slide | design.md 文档驱动；+slot 编辑运行时；56 风格 demo×11 页型×5 场景矩阵 | 场景=叙事弧+逐页表；风格=可运行 demo |
| 动画解说 | visual-explainer / future-slide / html-video / ppt-agent-workflow-san | 10 slide type+内容→表示映射；S01-S22 注册表+validator；storyboard-first+content-graph IR；preset 决策规则+QA 启发式 | 布局注册表形态；QA/密度清单 |

**构建方式光谱**（24 项目的共同收敛点：token 与版式分离）：

```
无模板（规则+示例涌现）  ←→  文档型模板（design.md/SKILL.md）  ←→  结构化工件（token css/json + 版型文件 + validator）
huashu、平台 few-shot        frontend-slides、KingDee、Mck        html-ppt-skill、guizang、ppt-agent、open-slide
```

平台（OpenMAIC）停在光谱最左端靠 few-shot 撞一致性；24 个成熟项目全部
收敛到右端。我们的三层架构在光谱右端，方向被整个生态交叉验证。

### 9.2 机制级评估（四问框架过筛后的裁决）

**采纳（已写进本规范，见 §4/§5/§7 增量）**：

| # | 机制 | 来源 | 落点 |
|---|---|---|---|
| 1 | 页型容量预算矩阵（Max Items/Title Chars/Body Chars+溢出警告） | Mck `layout-matrix.yaml` | §5 每页型声明容量；check.mjs 按页型分档 lint |
| 2 | 页型身份标记+validator 白名单（`data-layout="Sxx"`） | guizang `swiss-layout-lock.md`+validate 脚本 | 场景 frontmatter 标 `layout: T1`；check 校验登记 |
| 3 | 主题禁用清单 `forbidden[]`（风格声明"绝不能是什么"） | ppt-agent `decoration_dna.forbidden` | §4 platform.json 新字段 |
| 4 | 黄金样例=生成锚（风格配可运行 demo；2 页 showcase 定调） | next-slide styles/、huashu showcase | 每主题配 1-2 个成品样例场景 JSON 作 few-shot 锚——把平台"示例即模板"机制从事故变成设计 |
| 5 | 密度按页型分档（低/中/高是页型声明属性） | ppt-svg `page-templates.md`、ppt-agent `density_contract` | §5 密度档列 |
| 6 | 语义色槽+实例轮换序列（`COLOR_SEQ`/`inferColors`） | KingDee `design-tokens.md` | §4 `seq[]`：T5 步骤 i、T1 左右面板走轮换槽，platform 主题可全同色、他主题可分化 |
| 7 | 课级页序节奏层（页型序列+`max_consecutive_same`） | KingDee `rhythm-templates.md`、visual-explainer 构图交替规则 | §7 新清单项，T1-T6 落地后做 |
| 8 | 规划中间产物（page→layout→reason 表 / 策划稿层） | future-slide、ppt-workflow `method.md` | 大纲→画布之间的逐页规划表（workflow 侧强化） |
| 9 | CJK/ASCII 宽度估算（CJK 1.0 / ASCII 0.55） | ppt-agent-workflow-san `weightedLen` | check.mjs 现值被独立交叉验证，保持 |

**改造后采纳**：
- CSS 变量运行时换肤（slide-writer/html-ppt/open-slide）→ 机制保留，但我们的
  token→色值解析发生在**生成时**（平台 DSL 不认运行时变量），落盘前完成——
  §2 既定设计被再次验证
- "扩展不换系"契约措辞（beautiful-html-templates AGENTS.md §5）→ 借用原话
  精神：缺页型 = 在当前主题内新造并回填注册表，永不跨包拼接；新页夹在老页
  中间看不出是外来户
- 机读门禁反模式（Mck："passed 必须由程序派生，不由 AI 口头宣布"）→
  check.mjs 已是此形态；豁免清单进代码不进对话

**拒绝（明确不进体系）**：
- 动画/动效模式库（animate-css、web-animation-skills、GSAP cookbooks）→
  DSL 画布无动画层；动画只存在于 actions（spotlight 时序），属讲稿编排域
- 主题市场规模（36/56 主题库、marketplace/bundle 分发）→ 目标是 1 个高一致
  默认主题 + 可扩展空间，不做主题分发
- HTML 编辑器/slot 运行时（frontend-slides-editable）→ 平台侧职责，非生成侧
- 竖版/社媒模板（xhs 3:4）、Beamer 主题（Auto-Slides）→ 画布固定 1000×562.5

### 9.3 页型候选 T7+（来自 24 项目页型清单交叉高频项）

| 候选 | 出现于 | 场景 | 入库条件 |
|---|---|---|---|
| T7 时间线 | guizang S01、Mck timeline、next-slide、visual-explainer、html-video flowchart | 演进史/版本对比/学习路径 | 声明变化点+容量预算后入库 |
| T8 数据表 | Mck table 系、html-ppt slide-table | 参数对比/命令速查（DSL 有 table 元素） | 同上 |
| T9 代码对比 | html-ppt code/diff 页 | 代码课 before/after（06-skill 真实需求） | 同上 |
| T10 矩阵 2×2 | Mck matrix_2x2/swot | 选型决策 | 同上 |
| T11 数据大字 | stat-highlight/KPI tower | 数字主导页（与 T3 结论页互为镜像） | 同上，或并入 T3 变化点 |

### 9.4 教学场景的交叉证据

- 正面：next-slide Teaching 场景（campus-white 五变体+学科变体）、html-ppt
  `course-module`（学习目标侧栏+MCQ 自测）、visual-explainer（概念讲解 10 页型
  +密度上限表）证明教学课件是成熟品类，且都走"低密度+结构化页型"路线
- 反面：guizang 明确把"培训课件"列为反场景（低信息密度哲学）——发布会式
  大字报与教学承载天然冲突；我们的密度预算（text≤14/字≤130）站对了边
- presenter-mode-reveal 的"讲稿 150-300 字/页、幻灯片不出现讲稿文字"与我们
  "讲稿/画布分离"契约同构

## 10. 状态快照（2026-09-07）

- **2026-09-07 第二轮（密度回调，用户反馈"大字太多内容少"）**：以平台三课
  38 页实测为基准（内容页 max 字号 28-36 无 40+、中位 145 字）废除"大字主角"
  制度，改**结构主角**；06-skill 7 页重排（02/03/04/06/07/08/09/10）——
  40-48px 大字全部降级为 24-28px 或行内序号，腾出版面装判据/代价/反例/适用
  场景行；全课内容页字数 119-217、max 字号 ≤32、10 页 0 溢出 0 越界
  （DOM 逐页实测）；check 新增空转页下限 + 字号天花板（>32 warning）

- **已完成**：06-skill 全课 10 页按"对称面板+行语法"重做（check 0 error、
  密度全达标、0 溢出 0 相交）；check.mjs 三类渲染规则 + 混排估算器修复；
  平台管线逆向（本文 §1）；**参考模板批量调研**（24 项目，§9）；**三层体系
  落地**：themes/platform.json（§4 统计校准）+ check 色板/页型双 lint +
  06-skill 全课 platform 换皮与页型打标（§7-1,3,4,5,9,10 ✅）
- **titleRule 开放决策已按默认落地**：underline-short 80×3 `#3b82f6`
  （全课统一，含黄金样例；课 02 的 860 通栏留作未来变体）
- **06-skill 页型分布**：C,T6,T4,T5,T1,T4,T6,T4,T1,T5（无三连同型；
  讲稿/音频/spotlight id 全程未动，仅换色值+加 frontmatter layout）
- **待办** = §7 剩余：课级节奏层（#12 延后至需要时）；T2-T6 骨架 JSON 化
  （等各自锚点课）；T7+ 候选入库（§9.3）
- 06-skill-en 翻译课为旧几何（130 存量 error），中文课定稿后再同步
