# 翻译风格契约（translation-style）——地道、专业、表述正确的操作定义

讲稿与画布译文不是"把中文换成英文"，是**用英语重写同一堂课**。本契约是译者的
写作基准与审查（T3/T1）的核对依据。核心检验只有一条：**一个英语母语的科研
听众听/读这段话，会不会觉得"这是为我写的"？**

## 一、地道（idiomatic）——反翻译腔清单

写作顺序：先懂源文的意思，**忘掉源文的句子结构**，用英语的思维方式重说。
以下 calque 模式逐条自查（审查 T3 按此核对）：

| # | 翻译腔模式 | 反例（calque） | 正例（重说） |
|---|---|---|---|
| 1 | 逐词对应 | Welcome everyone to come to Agent Series Lecture 3 | Welcome to Lecture 3 of our Agent series |
| 2 | 话题-评论结构直译 | "As for tools, they are…" | Break it up: "Tools, though? That's where…" 或直接主谓宾 |
| 3 | 动词名词化堆叠 | do the integration of tools | integrate tools |
| 4 | 冗余程度副词 | very much / extremely overuse | 删；口语用 really 偶一为之 |
| 5 | 中文量词直译 | three items of prerequisites | three prerequisites |
| 6 | 被动句滥用 | the function is wrapped by you | you wrap the function |
| 7 | "according to / in order to" 起手过密 | — | by / to；每页 ≤1 次 |
| 8 | 破折号/冒号照搬中文节奏 | — — | 英文用句号切开；演讲体短句为王 |
| 9 | 全角标点残留 | （）！？：；—— | () ! ? : ; —（verify 机械拦截） |
| 10 | 直译成语/比喻 | "a brain that can only chat" ✓ 其实可留 | 具象比喻优先保留画面感，但用英语自然的说法 |

**朗读测试**（审查 T3 必做）：抽 2 段出声读——读到别扭、需要回读、或者能用
"which means…"向同事解释的地方，就是重写点。

## 二、专业（professional）——生态惯用表述表

术语对不对看 glossary；**表述地不地道看生态怎么说**。翻译技术内容时，优先
采用官方文档/社区的自然搭配（本课语料：fastmcp 与 MCP 官方文档）：

| 源文 | 惯用英文 | 不要写成 |
|---|---|---|
| 封装成工具 | wrap (a function) as a tool | encapsulate into tool |
| 暴露数据 | expose data as a resource | open/display the data |
| 接入客户端 | plug it into / add it to the client | access into client |
| 跑通 | get it working / end to end | run through |
| 排查 | debug / track down | troubleshoot search |
| 上下文撑爆 | blow up the context window | fill the context to explosion |
| 一次封装多端可用 | write once, works in any client | one package many use |
| 起服务 | spin up a server | start-up the service |
| 挑现成的 | use off-the-shelf servers | choose ready-made things |

规则：**遇到生态有固定说法的，用生态的说法**（译者不确定时在返回摘要里列出，
由术语表 pass 增补 phrases 区，全课统一）。

## 三、正确（correct）——表述正确性的三个核对点

1. **技术断言在英文语境里依然成立**：直译后读起来怪的技术句，往往是源文的
   中文习惯表达，重说而非硬译（如 N×M 问题 → "an N-by-M integration
   problem"，读作 "N by M"）。
2. **数字/单位/代码/命令逐字保真**（与 T1 重叠，审查时逐个核对）。
3. **口语数字写法按 TTS**：讲稿里小数字写出单词（twenty、three steps），
   带单位写阿拉伯（50 KB、24 kHz）；画布文本随意（不朗读）。

## 四、审查读法（给 translation reviewer 的规程）

1. **第一遍盲读**：只读译文（不打开源文件），以母语者身份标记一切"别扭/
   迟疑/像译文的"位置——先读源文会自动脑补语义，翻译腔就隐形了。
2. **第二遍对照**：打开源文件逐段核 T1（忠实）与漏译。
3. **回译抽查**：每场景抽 1 段，在心里回译成源语比对要点——意思漂移处
   即不忠实处；回译更顺的地方往往就是该重写的翻译腔。

## 五、机械层（verify 已内置 / 规划中）

- 全角标点残留（非 zh 目标）：`，。；：！？（）「」——……` → error 级
- `——` 双破折号、中文引号 → error 级
- 讲稿单句 >28 词 → info 级（演讲体建议 15-20 词/句）
- （规划）Flesch 可读性作为课程级 info 参考
