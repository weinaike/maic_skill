# workflow-outline —— 大纲生成（模块 1/4）

产出 `outline.md`（课程的结构真相源），经大纲审查闭环后到**门1（人确认冻结）**，
作为 M3 generate 模块的输入。

## 判定输入模式

- 用户给了 brief（一段话 / 文档路径 / URL / 已有课件）→ **brief 模式**
- 什么都没有 → **interview 模式**（协作默认）
- 用户明说"全自动/不要问我" → brief 模式 + 跳过门1（审查闭环后直接冻结）

## interview 模式（协作）

用 AskUserQuestion 分批问，别一次全问。建议 3 批：

1. **定位**：受众是谁（职业/技术水平）？课程目标一句话？解决他们什么痛点？
2. **规模与素材**：期望总时长或页数？有无已有素材（PPT/文档/上一门课）？要 quiz 吗、多密？
3. **风格**：style（professional/casual/academic…）？默认音色偏好？（技术课常用
   `zh_male_liufei_uranus_bigtts` 一类沉稳男声；可后换）

用户答不全的字段，用合理默认并在 outline 里注明假设——**别让 interview 卡死流程**。

## 生成 outline.md

格式（lint 强校验，`node scripts/outline.mjs lint <dir>`）：

```markdown
---
course: 课程名
audience: 一线科研人员
goal: 理解 Agent 底层原理并搭建定制化智能体
totalMinutes: 25
style: professional
voice: zh_male_liufei_uranus_bigtts
---

## 1. 导论封面 · slide · 1.5min

要点：
- 正式开场；课程名与双主线定位（原理+实践）
- 核心目标与受众

画布意图：封面版式——大标题+副标题+装饰弧（参考 layout-patterns 的 cover）
讲稿意图：开场白；点出"是什么/为什么值得学/学完能做什么"

## 2. 为什么要学Agent · slide · 3min
…

## 5. 检验理解 · quiz · 2min

要点：
- 检验 Agent 与 Chatbot 区别、上下文管理时机
quiz 意图：2 单选（概念辨析）+ 1 简答（场景判断）；干扰项来自常见误解
```

写法要求：

- 每节一个核心信息；要点 ≤4 条、每条一行可读
- `· type · Xmin`：slide/quiz/pbl/interactive；时长=讲稿预算（分钟 ≈ 字数/240）
- quiz 大约每 5-8 个教学页一布点；pbl/实战页前须有方法铺垫页
- 画布意图写到版式级（"两栏对比：左问题右方案"），generate 模块照此选版式配方
- 术语遵循 course.yaml `language` 指令
- 收尾页要有（总结 / 行动指引 / 下一课预告）

## 结构 lint

```bash
node scripts/outline.mjs lint <courseDir>     # error ⇒ 修到 0 再进审查
```

## 大纲审查闭环（自动/协作都跑）

1. 切换 reviewer 角色（见 `references/review-checklists.md` 框架规则 + §大纲审查 O1-O7）
2. `node scripts/review.mjs init <dir> --scope outline --round N` → 填 findings
3. `node scripts/review.mjs verdict <dir>` —— open blocker 存在则：
   - 生成者按 findings 修 outline → lint → reviewer 重审（round+1）
   - ≤2 轮仍有 blocker ⇒ 停，把未解决项呈给用户
4. blocker 清零 ⇒ verdict pass

## 门1 —— 大纲冻结（协作模式）

向用户呈现：outline.md 全文 + 审查结论（pass / 带出的 warnings）。
用户确认或改完后确认 → 大纲冻结。**冻结后改大纲必须重跑交叉校验**
（outline.mjs lint 会抓 outline↔scenes 漂移）。

## 门1之后（衔接 M3）

冻结的大纲交给 generate 模块逐节展开成 `scenes/NN-*.md`（文件前缀 = 大纲节号）。
本模块不生成场景文件。

## 解包课程的快捷路径

平台导出的已有课程可用 sync 反推大纲骨架再人工充实：

```bash
node scripts/outline.mjs sync <courseDir>       # 从 scenes/ 反推，时长用真实音频
```

sync 的要点条目是从画布文本提取的**提示**，需人/agent 充实为教学要点后过审查。
