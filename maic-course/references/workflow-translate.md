# workflow-translate —— 课程翻译 + 翻译审查

把一门课程翻译成目标语言，产出**派生课程项目**（结构完整复制、内容翻译、目标语
配音），经 translation 审查（T1-T5）后独立出包。源课程保持不动。

## 架构与不变量

- **翻译不改结构**：场景数/顺序/类型、画布元素 id 与类型、非文本元素几何、
  spotlight 指向、讲稿句数、quiz 题数——全部与源课一致，由
  `translate.mjs verify` 机械校验（结构一致性不靠人眼）。
- **音频不复制**：缓存键含音色；目标语言换目标语音色，全量重合成是正确行为。
- **译文长度适配**是唯一允许的画布改动：text 元素可调宽/高/字号（zh→en 文本
  通常变长 1.5-2 倍——优先精炼措辞，其次字号降一档，禁止挪动位置）。

## 流程

### 1. 初始化派生课程

```bash
node scripts/translate.mjs init <srcCourse> <targetDir> --lang en [--voice <目标语音色>]
```

然后填 course.yaml 两个 TODO（译名；目标语言授课指令——明确哪些专有名词保留
原文）。未给 --voice 时配音前必须补（目标语言音色，`tts.mjs doctor` 试合成验证）。

### 2. 术语表 pass（单次，翻译前）

主 Agent（或单开一个 agent）通读源 outline + 抽 2-3 个场景，写定
`glossary.yaml`（源词: 译法；保留原文的写 源词: 源词）。**术语表先行**是为了
并行翻译不各造各的词——译者只读不写术语表。

### 3. 逐场景翻译（并行，派 maic-translator）

注册类型 `maic-translator`（见 agents/maic-translator.md），3-4 场景一批；
未注册环境按该文件内联模板派发。每个译者只翻自己那几个文件：
讲稿、画布 text、quiz、pbl（含 code 元素里的 docstring/注释——那是教学内容）。

### 4. 机械校验 + 画布适配复查

```bash
node scripts/translate.mjs verify <targetDir>           # 结构一致性 + 残留
node scripts/translate.mjs verify <targetDir> --strict  # 翻译完成后（残留>2% 即报）
node scripts/preview.mjs <targetDir>                    # 逐页目验译文是否溢出文本盒
```

### 5. 翻译审查（必派 maic-reviewer，scope=translation）

对照**源课程**按 T1-T5 审（清单见 review-checklists.md §四）：
忠实度/术语一致/目标语讲稿风格/画布适配/完整性。findings 落
`build/review/translation-review.rN.json`，闭环规则同其他 scope（≤2 轮修复）。

### 6. 配音与出包

```bash
node scripts/tts.mjs doctor                 # 目标语音色连通
node scripts/tts.mjs <targetDir>            # 全量合成（目标语）
node scripts/preview.mjs <targetDir> && open <targetDir>/build/preview.html
node scripts/build.mjs <targetDir>
```

时长对账用**目标语速率**（speech-style §9：zh ≈350字/min、en ≈150词/min——
大纲时长沿用源课即可，偏差在 ±20% 容差内不必回写）。

## 与门控的关系

协作模式：门2'（译文 preview 抽检）在 translation 审查通过后进行；
自动模式照跑审查闭环。源课程不受任何影响；两门课可各自演进（派生课的
translatedFrom 只用于审查对照，不追踪源课后续变更——需要同步源课更新时，
按 edit 工作流逐页重译并重审）。
