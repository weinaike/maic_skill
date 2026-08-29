# 课程源格式规范（scene source spec）

课程是一个目录（git 友好、人机共同编辑）。**产物（.maic.zip）永远由源编译生成，不要手改产物。**

```
<course>/
  course.yaml        # 课程元数据（stage）+ 音色偏好。人可改。
  agents.json?       # 讲师团 roster（ManifestAgent[]），多讲师课才有
  scenes/NN-*.md     # 一页一文件；文件名数字前缀 = 播放顺序
  audio/*.mp3        # 语音模块合成的讲稿音频
  media/*            # 图片/生成媒体
  voice.lock.yaml    # TTS 缓存：audioKey(text|voice|speed) → {file,duration,voice,format}
  media.lock.yaml    # 媒体元数据：basename → {type,mimeType,size,prompt}
  build/             # 产物与报告（gitignore）
```

## course.yaml

```yaml
name: 课程名
description: ""            # 可省略
language: 全程使用中文授课。技术术语如 Agent、MCP 保留英文…   # → stage.languageDirective
style: professional
createdAt: 1786501220767   # epoch ms
updatedAt: 1786756647763   # 编辑课程内容时应更新
appVersion: 0.0.0
videoManifest: {}          # 可选；嵌入 JSON
voice:
  voice: zh_male_liufei_uranus_bigtts   # 默认音色（非密钥；密钥走 MAIC_TTS_* 环境变量）
  speed: 1.0
```

子集 YAML：两层嵌套 map + 标量。标量以 `{`/`[` 开头按内联 JSON 解析。列表-of-map 不支持（用 .json 文件）。

## 场景文件 scenes/NN-title.md

```markdown
---
type: slide            # slide | quiz | pbl | interactive
title: 导论封面
---

## 讲稿

这里是讲稿段落，一段 = 一个 speech 动作。 @[text_2FzIQGyp]

`@[元素id]` 尾注编译为紧邻其前的 spotlight 动作；可叠加多个。
段落内换行折叠为空格。

<!-- action
{ "type": "laser", "points": [[500, 280]], "duration": 1500 }
-->

HTML 注释包裹的原始动作按出现位置原样插入（wb_*、laser、discussion、
widget_*、play_video 等一切高级动作的逃生通道）。

## 画布

\```canvas
{ "id": "slide_xxx", "viewportSize": 1000, "viewportRatio": 0.5625,
  "theme": {…}, "background": {…}, "elements": […], "animations": [] }
\```
```

各 section：

| Section | 适用类型 | fence 语言 | 编译为 |
|---|---|---|---|
| `## 讲稿` | 全部 | —（散文） | `actions`（speech/spotlight/raw） |
| `## 画布` | slide | `canvas` | `content.canvas`（完整 PPTist Slide JSON，原样透传） |
| `## 题目` | quiz | `quiz` | `content.questions`（`{questions: [...]}`） |
| `## 内容` | pbl/interactive | `content` | `content` 原样透传（pbl 过 validatePBLContent） |
| `## 白板` | 全部 | `whiteboards` | `whiteboards`（Slide[]） |
| `## 多智能体` | 全部 | `multiAgent` | `multiAgent`（manifest 形状：`{enabled, agentIndices, directorPrompt}`，索引指向 agents.json） |

规则：

- **顺序**：文件名 `NN-` 前缀排序，`order` 由编译器派生（1 起），不写在文件里。
- **确定性**：动作 id 由内容哈希铸造（`action_<hash>`），源不变 ⇒ manifest 逐字节稳定；action id 在平台侧只是不透明键，不必保号。
- **无损**：画布/内容/原始动作不做 normalize、不改写——normalize 差异由 check 报告，由生成模块负责产出已规范的内容。
- **音频绑定**：编译器用 `audioKey(text, voice, speed)` 查 `voice.lock.yaml` 命中则填 `audioRef`；未命中输出 warning（语音模块待跑）。改了讲稿文本 ⇒ 键变 ⇒ 旧音频自动失配，重跑 voice 即可，天然增量。

## voice.lock.yaml（语音模块管理，人一般不碰）

```
"t:<sha1(text|voice|speed)>":
  file: audio/ast_xxx.mp3
  format: mp3
  duration: 5.064
  voice: zh_male_liufei_uranus_bigtts
"orphan:audio/ast_yyy.mp3":   # 解包带出的、无讲稿引用的音频
  …
```

## media.lock.yaml（媒体模块管理）

```
ast_ezg75….jpeg:
  type: generated      # audio 之外：image | generated
  mimeType: image/jpeg
  size: 243053
  prompt: An abstract professional illustration…
```

注意平台约定：`media/<文件名主干>` 若与画布 image 元素 id 一致，导入时该媒体会挂到该元素；不一致仅是仓库里有这份字节（warning）。

## 工作流不变量

1. **编辑只改源**：改讲稿 ⇒ voice 增量重合成；改画布 ⇒ check 重跑；改页序 ⇒ 文件改名。
2. **提交前 `build`**：compile + 三层校验（error 拒绝出包）+ zip（store 压缩）。
3. **导入**：平台 → 课程列表 → 导入 → 选 `.maic.zip`。
