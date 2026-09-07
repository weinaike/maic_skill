# 审查体系 —— 框架规则与分域清单（O/C/S/T/I）

自动化生成的前提是自动化审查。**生成者不审自己的作业**：审查时切换为独立
reviewer 角色（建议开子代理或至少以全新视角+本清单逐项核对），只依据清单与
被审对象本身作判断，不引用"我生成时的思路"。

## 框架规则（所有审查共用）

1. **findings 结构化落盘**：`build/review/<scope>-review.r<round>.json`（格式见
   `scripts/review.mjs` 头注释；`scope` ∈ outline | content | spec | full）。
   每条 finding 必须可定位（文件 + 章节/元素 id）并给出可执行 fix。
2. **severity 语义**：
   - `blocker`：不修不能出包（事实错误、结构断裂、会让学习者被误导或导入失败）
   - `warning`：应修；不修出包时必须向用户明示
   - `nit`：可选打磨，不阻塞
3. **修复闭环（自动模式）**：blocker → 生成者按 findings 修复 → **重审该 scope**
   （round+1 新文件，旧轮保留）→ 直到清零；**≤2 轮**，仍有 blocker ⇒ 停，把
   未解决项呈给用户决定，不得带病出包。`node scripts/review.mjs verdict <dir>`
   与 build 的门禁会机械强制这一点。
4. **协作模式**：每个门（门1 大纲 / 门2 画布 / 门3 讲稿）向用户呈现的是
   "产物 + 审查报告"，人的注意力花在审查器拿不准的项上。
5. **诚实性**：审查报告禁止美化——未审的维度不装作已审；审过没问题的维度
   也要列出（记 `nit`/无发现均可，但结论要真实）。

---

## 一、大纲审查（scope: outline，对象 outline.md）

前置：`node scripts/outline.mjs lint <dir>` 先过（结构错误由 lint 报，审查者不重复）。

| # | 维度 | 核对问题 |
|---|------|----------|
| O1 | 目标对齐 | 每一节是否服务于 audience/goal？有无跑题页、自我介绍过多、与目标无关的展开？ |
| O2 | 结构完整 | 开场（定位/目标/受众）→ 主体 → 收尾（总结/行动指引）闭环？pbl/实战页是否有前置铺垫？ |
| O3 | 递进逻辑 | 有无跳步（后页用到前页未讲的概念）？有无重复（两页讲同一要点）？ |
| O4 | quiz 布点 | quiz 密度合理（约每 5-8 个教学页一测）？考点对应主体关键概念而非边角？ |
| O5 | 时长预算 | 各节 minutes 与信息密度匹配（要点多的页不该只有 1min）？合计 vs totalMinutes？ |
| O6 | 可落成性 | 每节"要点"能否落成一页画布（≤6 组视觉单元）+ 一段讲稿？画布意图是否具体到版式？ |
| O7 | 语言指令 | 术语处理是否遵循 course.yaml 的 language（如英文术语保留不译）？ |

## 二、内容审查（scope: content，对象 scenes/）

逐场景审（`--scope content`，target 记 scenes）。前置：`node scripts/check.mjs <dir>` 无 error。

| # | 维度 | 核对问题 |
|---|------|----------|
| C1 | 讲稿↔画布一致 | 讲稿讲到的每个要点，画布有对应元素承载？讲稿说"看这里/这三步"时元素确实存在且数量对？ |
| C2 | spotlight 正确 | `@[elementId]` 指向的元素确实是讲稿当时讲的内容？（错位指向是高频缺陷） |
| C3 | 内容正确性 | 事实与技术表述正确；术语遵循 language 指令；前后页无矛盾（数字/名单/结论一致） |
| C4 | 教学节奏 | 每页一个核心信息；按 speech-style.md §1/3/4/8 核查：单段 ≤120 字、承接链完整、金句口头化、引入句式 ≤2 次 |
| C5 | 时长匹配 | 讲稿字数 ≈ 分钟数 × 350（豆包实测）±15%（speech-style §9）；讲稿不写死时长数字；符号读法过 §6 表 |
| C6 | quiz 质量 | 答案正确；干扰项来自常见误解（不是显然错的凑数）；解析讲清"为什么"；题型（单选/多选/简答）与考点匹配 |

## 三、规范审查（scope: spec，对象 scenes/）

结构性问题优先由 `check.mjs`（L1/L2/L3）捕获；本清单审**脚本报不出来的残余**：

| # | 维度 | 核对问题 |
|---|------|----------|
| S1 | 版式规范 | 元素无无谓重叠遮挡（有意叠放除外）；标题/要点/正文字号层级一致；页边距均衡 |
| S2 | 一致性 | 全课同版式族的页（封面×n、正文×n）布局骨架一致？字体统一 theme.fontName？ |
| S2.5 | 主题合规 | 色值是否全部来自主题包语义槽而非裸 hex（check 色板 lint 报越界，这里审**用对了没有**）：语义卡文字是否用同族深色（info→#1e40af 系）、强调色是否只出现在下划线/序号/左条三处、并排面板是否同色（T1）、`forbidden[]` 禁用项有无踩线；黄金样例 `maic-course/samples/platform.*.json` 是观感基准 |
| S2.6 | 页型匹配 | frontmatter `layout` 与实际结构是否相符（T1=双面板/C=封面/T5=流程拍…）；内容量是否在页型容量预算内（check 按页型分档报，这里审"没超但也没撑起页型"的空转页）；连续页型节奏是否单调 |
| S3 | 文本规范 | text 元素 content 只用白名单 HTML；换行用 `<br>`；无空元素、无占位文本残留（"TODO"/lorem） |
| S4 | 源规范 | 场景文件 NN- 前缀连续；frontmatter type/title/layout 完整（slide 无 layout 标记是缺陷）；`@[elementId]` 无悬空（check 会抓，这里确认没有新增） |
| S5 | 媒体卫生 | 无未引用的 audio/ 堆积（改稿后的死音频应清理 voice.lock 与文件）；media/ 文件在 media.lock 有记录 |
| S6 | 文本框预算 | check 的预算/重叠/密度规则报不出来的残余：**单行标签/号牌在色块内是否显式 `vAlign:"middle"` 且盒对齐背景卡**（顶对齐+10px 内缩会让文字系统性偏下，机器测不了视觉居中）；多行卡片正文末行与卡底是否留 ≥8px 余量；紧凑页实际留白是否还能喘气（密度 warning 只是下限信号） |

## 四、翻译审查（scope: translation，对象 目标课程 scenes + glossary，对照源课程）

前置：`node scripts/translate.mjs verify <targetDir>` 通过（结构一致性由脚本
保证，审查者不重复查 id/几何/句数）。

| # | 维度 | 核对问题 |
|---|------|----------|
| T1 | 忠实+表述正确 | 逐段对照：语义无漂移、无增删要点；数字/单位/代码/URL/命令逐字不变；技术断言在目标语语境成立（生态惯用表述，见 translation-style §二/§三） |
| T2 | 术语一致 | glossary 逐条落实；同一术语全课同一译法；目标 course.yaml language 的"保留原文清单"被遵守 |
| T3 | 地道+目标语风格 | **先盲读译文再对照源文**（translation-style §四）：按 §一 反翻译腔清单逐条核（全角标点/calque/被动堆叠…）；朗读测试抽 2 段；回译抽查 1 段；速率 zh≈350字/min、en≈150词/min ±15% |
| T4 | 画布适配 | 译文不溢出文本盒（建议对照 preview 实测）；字号仍在层级表内；无因加长导致的压叠 |
| T5 | 完整性 | 源文要点逐条有落点、无漏译段；无源语残留（CJK in 非zh 目标）；quiz/pbl 同步译出；spotlight 仍指向承载该要点的元素 |

## 五、交互审查（interactive 场景；content/spec 审查时附加核对）

`check.mjs` 对 interactive 内容**零校验**（透传）——本清单是交互页唯一的把关。
基准：`references/interactive-spec.md`；抽检方法：从 `## 内容` fence 提取 `html`
存 `.html`，浏览器开 1280×720 窗口核对。

| # | 维度 | 核对问题 |
|---|------|----------|
| I1 | 动作↔监听配对 | 讲稿每个 `widget_*` 动作的 `target`/`state` 键，页面监听器或 DOM 有对应物？反向：页面不响应的消息类型不在讲稿里用？（spec §2/§6） |
| I2 | 首帧自含 | 页面 load 冻结帧承载本页主要信息？主体内容不依赖用户交互或时间推进才出现？（spec §7——导出视频即冻结帧） |
| I3 | 视口合规 | 16:9 横屏、1280×720 设计基准；流式布局（flex/grid/相对单位）；主体内容无固定像素绝对定位？（spec §3） |
| I4 | 沙箱合规 | 无 localStorage 持久化设计（null-origin 内存 shim，刷新即失）；外链 CDN 可降级或无外链；不访问父窗口/宿主 DOM？（spec §4） |
| I5 | reveal 口播兜底 | `widget_reveal` 揭示的关键信息，讲稿已完整口播？（spec §7——导出视频里揭示不可见） |

---

## 全课终审（scope: full，build 前最后一道）

- 跨场景术语/风格一致性（同一概念前后叫法一致；口吻统一）
- 总时长 = Σ(节时长) vs outline.totalMinutes，偏差 >20% 报 warning
- 前后引用真实（"上一页讲过的 X"确实在前面出现过）
- outline.md ↔ scenes/ 无漂移（`outline.mjs lint` 的交叉校验通过）

---

## 命令速查

```bash
node scripts/review.mjs init <dir> --scope outline --round 1     # 脚手架
# …reviewer 填写 findings…
node scripts/review.mjs validate <file>                          # 格式校验
node scripts/review.mjs verdict <dir>                            # 聚合最新轮次；blocker ⇒ exit 1
node scripts/build.mjs <dir>                                     # 出包（内置 review 门禁）
```
