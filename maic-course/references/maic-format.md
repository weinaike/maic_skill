# .maic.zip 格式契约（逆向自平台 export/import 实现）

目标产物 = 一个 zip（平台用 **store** 不压缩），根下三样：

```
manifest.json          # 唯一必需入口
audio/ast_<id>.mp3     # speech 动作音频；mediaIndex 键 = zip 内路径
media/ast_<id>.<ext>   # 图片/生成媒体（可选）
```

## manifest.json（formatVersion 1）

```jsonc
{
  "formatVersion": 1,
  "exportedAt": "2026-08-15T02:28:02.474Z",   // ISO 时间
  "appVersion": "0.0.0",
  "stage": {
    "name": "…",                    // 必需
    "description": "",
    "language": "全程使用中文授课。…",   // → stage.languageDirective
    "style": "professional",
    "createdAt": 1786501220767,     // epoch ms
    "updatedAt": 1786756647763,
    "videoManifest": {},            // 可选
    "locale": "zh-CN",              // 可选，BCP-47；平台语言切换/折叠按此标注
    "translationGroupId": "maic-agent-05-mcp", // 可选；同课多语言共享同一 id → 平台折叠成一门课。全库唯一：命名空间-系列-讲号-主题，禁用裸讲号/裸目录名
    "translationOf": "…",           // 可选，仅派生课；源课名（源成员留空）
    "translatedAt": 1788410854278   // 可选，仅派生课；epoch ms
    // 注意：interactiveMode / taskEngineMode 平台导出时故意不携带
  },
  "agents": [                        // roster；身份按数组下标定位（无 id）
    { "name": "...", "role": "teacher|student|…", "persona": "...",
      "avatar": "...", "color": "#hex", "priority": 1,
      "voiceConfig": { "providerId": "...", "voiceId": "..." },   // 可选
      "voiceDesign": { "identity": "...", "texture": "...", "delivery": "..." } }  // 可选
  ],
  "scenes": [
    {
      "type": "slide",              // slide | quiz | pbl | interactive
      "title": "导论封面",
      "order": 1,                   // 1 起
      "content": { … },             // 与 type 绑定，见下
      "actions": [ … ],             // 可选；播放动作序列
      "whiteboards": [ … ],         // 可选
      "multiAgent": { "enabled": true, "agentIndices": [0], "directorPrompt": "…" }  // 可选，agentIndices 指向 agents[]
    }
  ],
  "mediaIndex": {
    "audio/ast_xxx.mp3": { "type": "audio", "format": "mp3", "duration": 5.064, "voice": "zh_male_…" },
    "media/ast_yyy.jpeg": { "type": "generated", "mimeType": "image/jpeg", "size": 243053, "prompt": "…" }
  }
}
```

**scene 无 id**：平台导入时对 stage/scene/action 全部铸造新 nanoid，源里的 id 只需自洽。

## content 与 type 的绑定

| type | content |
|---|---|
| slide | `{ "type": "slide", "schemaVersion": 1, "canvas": <PPTist Slide> }` |
| quiz | `{ "type": "quiz", "questions": [QuizQuestion…] }` |
| pbl | `{ "type": "pbl", "projectV2": {…} }`（DSL 已有 validatePBLContent/normalizePBLProject） |
| interactive | app 侧形状，透传 |

QuizQuestion：`{ id, type: 'single'|'multiple'|'short_answer', question, options?: [{label,value}], answer?: ["A"], analysis?, commentPrompt?, hasAnswer?, points? }`

## 动作（manifest 形态）

speech 动作在 manifest 里用 **audioRef**（zip 路径）而非 audioId：

```jsonc
{ "id": "action_…", "type": "speech", "text": "…", "audioRef": "audio/ast_xxx.mp3" }
{ "id": "action_…", "type": "spotlight", "elementId": "text_yyy" }   // 指向本页画布元素
```

其余动作类型（laser / play_video / discussion / wb_open,wb_draw_*,wb_edit_code,wb_clear,wb_close,wb_delete / widget_highlight,widget_setState… / wb 前缀族）见 dsl-cheatsheet.md，字段原样透传。

## 平台导入器（use-import-classroom.ts）的实际验收

1. `manifest.json` 必须存在且 JSON 可解析；`manifest.stage`、`manifest.scenes[]` 必需——否则整个导入拒绝。
2. `mediaIndex` 每个 **audio** 条目（非 missing）→ 铸造新 audioId，zip 内对应路径必须有文件（缺文件静默跳过该音频）。
3. `mediaIndex` 的 image/generated 条目：**文件名主干（去扩展名）被当作元素 id**，媒体写入以 `mediaFileKey(stageId, elementId)` 键控——主干与画布元素 id 不一致则媒体悬空。
4. speech 动作的 `audioRef` → 新 audioId 重写；audioRef 不在 mediaIndex audio 键中则绑定丢失（无声）。
5. roster 逐字段结构性校验：name/role/persona/avatar/color 必须非空字符串，priority 数值；voiceConfig/voiceDesign 畸形则丢弃该字段。
6. `multiAgent.agentIndices` → agents[] 下标 → 新 agent id。
7. 200MB 以上仅警告不拒绝。

check.mjs 的 L3 层逐条复刻以上语义。
