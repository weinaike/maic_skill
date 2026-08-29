# 上下文隔离与派发配置（导演-演员架构）

主 Agent 是**导演**：采访提问、门控确认、编辑指令理解与路由、级联调度（跑 scripts、
收敛循环）、最终汇报。**演员**（sub agent）：逐节场景生成、审查、按 findings 修复——
fresh context，只带契约文档与目标文件进出。

## 派发矩阵

| 任务 | 派发 | 条件 |
|---|---|---|
| interview / 门1·2·3 确认 / 用户对话 | 主 Agent | sub agent 无法与用户交互 |
| 编辑指令理解与路由（"改改刚才那页"） | 主 Agent | 需要对话语境 |
| 级联调度（check/tts/build/prune 循环） | 主 Agent | 编排职责 |
| 逐节场景生成 | **Sub Agent**（模板 A） | 协作模式单节可主 Agent 直做；≥3 节或自动模式必派；可 3-4 节并行 |
| 内容/规范/大纲/全课审查 | **Sub Agent**（模板 B，必派） | 审查有效性依赖隔离——同上下文自审只找得到小毛病（03-mcp r1 实证） |
| 按 findings 修复单场景 | Sub Agent（模板 C） | blocker 修复轮 |

**跨任务状态一律落盘**（本 skill 已具备）：大纲意图、讲稿、locks、findings 全在文件里；
sub agent 之间、sub↔主之间不靠对话记忆交接。**派发前自检**：用户在 interview 中说过的
口头偏好（"别太口语"/"多用例子"）必须已写入 course.yaml 或 outline——没落盘的信息
sub agent 永远看不到。

## 机制保证（注册 agent 类型）

提示词纪律只是第一层；本 skill 在 `agents/` 下维护三个**受限工具的注册 agent 类型**，
隔离由 Claude Code 的工具面机制兜底：

| 注册类型 | 工具面 | 机制保证 |
|---|---|---|
| `maic-scene-generator` | Read/Write/Glob/Grep/Bash | fresh context（进程级隔离）+ 自检两关 + 批后 git 校验（见下） |
| `maic-reviewer` | **Read/Glob/Grep（无写权限）** | 审查员**机制上无法修改任何文件**——只能读与返回；findings 由主 Agent 落盘 |
| `maic-fixer` | Read/Write/Edit/Glob/Grep/Bash | 只按 findings 修；音频级联明示禁区 |

**审查流（返回即所得）**：主 Agent 先跑 `check.mjs` 并把结果放进派发参数 →
reviewer 纯读审查 → 最终消息返回**纯 JSON findings** → 主 Agent 写入
`build/review/<scope>-review.rN.json` 并跑 `validate`/`verdict`。reviewer 全程零写盘。

**生成批后校验（写面核对）**：每批生成器返回后，主 Agent 在课程目录跑
`git status --porcelain`——变更文件集合必须 ⊆ 本批目标场景文件；多出来的变更
（越权写入）直接回滚该文件并重派。课程项目应 git 化（courses/ 已在 skill 仓库内）。

**安装**（agent 类型注册在会话启动时加载，装完需重启会话生效）：

```bash
mkdir -p <项目>/.claude/agents
for f in maic-scene-generator maic-reviewer maic-fixer; do
  ln -sfn <skillDir>/agents/$f.md <项目>/.claude/agents/$f.md
done
```

已注册时派发用 `subagent_type` + 短参数（模板正文即其系统提示词）；未注册/跨环境时
退回下方 A/B/C 内联模板（内容与注册版一致）。

---

## 模板 A：场景生成器（每节一个实例）

用 Agent 工具派发，prompt 按下式填充（`<>` 为占位符）：

```
角色：MAIC 课程场景生成器。你只生成一个场景文件，不参与其他任何流程。

工作目录：<courseDir>
目标文件：scenes/<NN-文件名>.md（不存在则创建；scaffold 骨架已给出 TODO brief）

第一步，按序读以下文件（只读这些，不要浏览目录）：
1. course.yaml —— 语言指令（术语保留英文规则）、风格、音色
2. outline.md 中 "## <N>. <节标题>" 一节 —— 要点 / 画布意图 / 讲稿意图 / 时长预算
3. skill 目录 <skillDir>/references/ 下四份契约：
   scene-source-spec.md（源格式）、layout-patterns.md（版式配方与坐标）、
   dsl-cheatsheet.md（元素与动作契约）、speech-style.md（讲稿十条规范）
4. 风格锚点：scenes/01-*.md 的 讲稿 部分——口吻、称呼、承接句式与第一页对齐；
   若目标就是第 1 页，跳过此项

第二步，生成目标文件：
- 画布：按画布意图选配方，严格用配方坐标骨架；元素 id 用语义 slug；
  text 只用白名单 HTML；字号按层级表
- 讲稿：字数 = 时长 × 350 ±15%；一段一要点 ≤120 字；首段承接上一节（读上一节
  文件末段获取承接点）、末段引出下一节；讲到哪张卡尾注 @[该卡元素id]；
  符号写读法（speech-style §6）
- quiz 节按 quiz 意图出题（干扰项=常见误解，每题带 analysis）；
  pbl 节按 dsl PBLProject 形状写内容 fence

第三步，自检（两项都过才算完成）：
1. node <skillDir>/scripts/generate.mjs normalize <目标文件绝对路径>
2. node <skillDir>/scripts/check.mjs <courseDir> —— 目标场景相关行必须 0 error

硬约束：只写目标这一个文件；TODO 全部清除；不改 outline/其他场景/任何锁文件。
返回（仅此一行摘要，不要贴文件内容）：文件名 | 元素数 | 讲稿段数/字数 | check 结论
```

并行派发：3-4 节一批（每 agent 写不同文件，无写冲突）；第 1 页先单独生成作为风格
锚点，其余节并行。**承接句注意**：并行时无法读到下一节的末段——统一由主 Agent 在
全批完成后做一次"承接缝合"（只改各节首段的承接半句，改动走 check）。

## 模板 B：独立审查员（每个 scope 一个实例）

```
角色：MAIC 课程独立审查员。你没有参与生成，只依据文件本身与清单判断；
禁止引用任何"生成者的意图"做辩护——文件说了什么就是什么。

审查对象：<scope（outline | content | spec | full）> / 目标：<文件或目录>
课程目录：<courseDir>；skill 目录：<skillDir>

第一步，读：
1. <skillDir>/references/review-checklists.md —— 对应 scope 的清单（逐项核对）
2. <skillDir>/references/speech-style.md —— C4/C5 的核查基准
3. 被审对象全部文件；content 审查另读对应节的大纲条目；full 审查另读 outline.md 全文
前置：<skillDir>/scripts/check.mjs <courseDir> 已 0 error（有 error 先报 error 不细审）

第二步，逐项审：按清单编号输出 findings，每条必须可定位（文件+位置/元素id）+
可执行 fix；不确定的记 warning 并说明不确定点，不猜测不脑补。
诚实性：没审到的维度不要装作审过；没问题的维度明确记"无发现"。

第三步（未注册 agent 类型时的内联流程）：把 findings JSON 写入
build/review/<scope>-review.r<N>.json，运行 review.mjs validate 自校格式。
已注册 maic-reviewer 时：不写任何文件，最终消息直接返回纯 JSON（主 Agent 落盘）。
返回：一行摘要（blocker/warning/nit 计数），不要贴 findings 全文。
```

## 模板 C：修复器（blocker 修复轮）

```
角色：MAIC 课程修复器。按 findings 精确修复，不做清单之外的"顺手优化"。

输入：<courseDir> / findings 文件 build/review/<scope>-review.r<N>.json /
skill 目录 <skillDir>
读：findings 全部条目 + 被指到的源文件 + 涉及契约的对应 references（按 finding
所指：讲稿问题读 speech-style，版式问题读 layout-patterns……）

逐条修复 open 的 blocker/warning；每条修复后确认其 fix 已生效。
改讲稿文本的：被改句子音频会自动失配——不要动 audio/ 与 voice.lock（级联由主 Agent 跑）。
完成后运行 node <skillDir>/scripts/check.mjs <courseDir> 必须 0 error。
返回：逐条一行（finding id → 修复动作），以及是否有你无法修复的条目及原因。
```

## 与门控的关系

门1/2/3 的**确认动作**永远在主 Agent（用户交互）；门前的**审查**永远在 sub agent。
自动模式省掉确认，不省审查。修复轮 ≤2 次的计数由主 Agent 维护（读 review 目录的
轮次文件数即可，无需记忆）。
