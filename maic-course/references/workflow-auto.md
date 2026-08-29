# workflow-auto —— 全自动模式（brief 进，成品 zip 出）

用户说"全自动/不要问我/一条命令出课"时走本流程：**无人工门**，但**每个生成环节
的审查闭环一个不少**——自动化省的是人肉确认，不是质量环节。

## 输入

- 一份 brief（一段话 / 文档路径 / URL / 已有课件）
- 可选约束：总时长或页数、音色、风格、quiz 密度

环境前置：`node scripts/tts.mjs doctor` 通过（豆包默认，arkcli key 自动解析）；
不通则跑到语音环节前停下报告，**不要用无声出包**。

## 流水线

```
0  init        scripts/init.mjs <dir> --name … --audience …
1  大纲        workflow-outline（brief 模式）→ outline.mjs lint 清零
2  大纲审查    scope=outline，blocker ≤2 轮自动修复 → review.mjs verdict 过
3  生成        workflow-generate 全量：scaffold → 逐节（配方→画布→normalize→check）
                → 内容+规范审查（scope=content/spec），同 ≤2 轮闭环
4  语音        门3 由 content 审查代替人工终审 → tts.mjs（增量）→ prune
5  终审        scope=full 全课终审（跨页一致性/引用/时长对账）
6  出包        build.mjs（check error + review blocker 双门禁）→ preview 一并产出
7  报告        汇总：产物路径、页数/时长/音频、审查轨迹（各 scope 轮次与清零过程）、
                遗留 warning、未自动解决的项
```

## 停止条件（红线，出现即停并向用户报告，不得带病出包）

- 任一审查 scope 修复 2 轮后仍有 open blocker
- `check.mjs` error 无法自动修复（结构/契约问题）
- TTS 不可用/配额耗尽（已合成部分入缓存，重跑续传）
- brief 信息不足以定大纲（受众/目标完全缺失且无法从 brief 推断）

## 执行纪律

1. **审查者与生成者隔离**：审查轮次用独立 reviewer 视角/子代理执行
   （review-checklists.md 框架规则）
2. **诚实报告**：第 7 步的报告必须如实列出所有 warning 与修复轨迹，禁止只报喜
3. **增量性**：任何一步失败重跑时，从断点续（源文件、voice.lock 都支持）
4. 耗时预算提示：语音环节是主要成本，dry-run 数字写进最终报告

## 协作模式总览（对照）

协作模式 = 同一条流水线，但在三处停下等人：
- 门1（大纲冻结，outline 审查后）
- 门2（preview 抽检，content/spec 审查后）
- 门3（讲稿终审，TTS 前）
全自动模式把这三个门换成对应的审查闭环。两模式可混用（例如全自动出初稿、
协作模式精修）。

## 产物清单（报告模板）

```
✅ 课程成品：<name>.maic.zip（N 场景 / M 分钟音频 / X 页画布）
   preview：  <dir>/build/preview.html
   导入：     平台 → 课程列表 → 导入 → 选择 zip
   审查轨迹： outline r1→r2（3 blocker 清零）/ content r1（1 warning 遗留）/ full r1
   遗留项：   <warning 列表与理由>
```
