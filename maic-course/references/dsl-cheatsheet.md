# DSL 速查（生成画布与动作时的契约约束）

来源：`@openmaic/dsl`（vendor 于 `maic-course/vendor/dsl/`，加载器 `scripts/lib/dsl.mjs`）。
校验入口：`validateScene` / `validateAction` / `validatePBLContent`；修复入口：`normalizeElement` / `normalizeSlide` / `normalizeScene` / `normalizePBLProject`。

## 画布（PPTist Slide，slide 场景的 content.canvas）

```jsonc
{
  "id": "slide_xxx",                  // 任意稳定字符串
  "viewportSize": 1000,               // 固定 1000
  "viewportRatio": 0.5625,            // 16:9 ⇒ 画布高 562.5
  "theme": {
    "backgroundColor": "#ffffff",
    "themeColors": ["#5b9bd5", "#ed7d31", "#a5a5a5", "#ffc000", "#4472c4"],
    "fontColor": "#333333",
    "fontName": "Microsoft YaHei",
    "outline": { "color": "#d14424", "width": 2, "style": "solid" },
    "shadow": { "h": 0, "v": 0, "blur": 10, "color": "#000000" }
  },
  "background": { "type": "background", "color": "#ffffff" },   // 或 image
  "elements": [ … ],
  "animations": [],
  "script": "…",                      // 可选：本页备注
  "turningMode": "slide",             // 可选
  "sectionTag": ""                    // 可选
}
```

坐标系：**left/top/width/height 为 1000×562.5 绝对坐标**。装饰性出血（圆弧溢出画布）是平台惯用手法，check 报 warning 不报 error。

### 元素（常见）

通用字段：`id`（spotlight 的目标）、`left/top/width/height`、`rotate?`、`animations?`、`lock?`。

- **text**：`content` = **内联样式 HTML 字符串**，如 `<p style="font-size: 16px; text-align: center; color: #38bdf8;">AGENT · 智能体技术</p>`；`defaultFontName`、`defaultColor`、`vAlign?`（默认 `top`——单行标签/号牌落色块内必须显式 `middle`）、`lineHeight?`（默认 1.5）。**渲染契约：内容盒四向内缩 10px**——高度 ≥ 行数×字号×行高+20、折行宽度按 width−20 估（详见 layout-patterns「文本框预算」）。白名单（校准自真实课程）：标签 `p span br b strong i em u a`；style 属性 `font-size text-align color text-decoration font-weight font-family line-height letter-spacing text-indent background-color margin* padding*`。
- **shape**：`shape`（`ShapePathFormulasKeys` 枚举：rect/roundRect/ellipse/triangle/…）、`path`/`viewBox`（normalize 可推导）、`fill`（颜色或 `{ type:'gradient', … }` 或 `{ type:'image', src, … }`）、`outline`（描边；player 不读 `line`）、`radius?`、`opacity?`。
- **image**：`src` = base64 data URI（自包含、最稳）或引用；`mediaRef?`。
- **table**：`data: TableCell[][]`（cell 带 `text/id/colspan/rowspan/borders?/padding?/vAlign?: top|middle|bottom`）、`rowHeights?`、`colWidths`、`theme`（表头/行色）。
- **chart**：`chartType: 'bar'|'line'|'pie'`、`data: { labels, series:[{name,data,color?}] }`、`grid?`、`legend?`、`title?`。
- **code** / **latex** / **video**（`mediaRef` + `poster?`）/ **audio**（`src`+`loop`）。

`ELEMENT_DEFAULTS`（normalize.ts）是元素默认值的单一事实源；生成元素后可 `normalizeElement(el)` 补全几何派生字段。

## 动作全集（action.ts；`ACTION_TYPES` 冻结集）

播放语法的主力（真实课程占比 ~100%）：

- `speech`：`{ text, audioId?(运行时) / audioRef?(manifest), voice?, speed? }`
- `spotlight`：`{ elementId }` —— 高亮本页元素，**elementId 必须存在于本页画布**

讲授增强：

- `laser`：`{ points: [[x,y]…]（百分比）, duration? }`
- `play_video`：`{ elementId, … }`
- `wb_open` / `wb_close` / `wb_clear` / `wb_delete`：白板容器控制
- `wb_draw_shape` / `wb_draw_line` / `wb_draw_text` / `wb_draw_table` / `wb_draw_chart` / `wb_draw_code` / `wb_draw_latex` / `wb_edit_code`：白板内作图（payload 为对应数据形状）
- `discussion`：`{ topic, agentIndex|agentId }` 触发多智能体讨论
- `widget_highlight` / `widget_setState` / `widget_annotation` / `widget_reveal`：交互组件控制

类别：`SLIDE_ONLY_ACTIONS`（仅幻灯片场景合法）、`SYNC_ACTIONS`（需等待完成）、`FIRE_AND_FORGET_ACTIONS`。

## Stage 级

`Stage { id, name, description?, createdAt, updatedAt, languageDirective?, style?, whiteboard?, videoManifest?, agentIds?, generatedAgentConfigs?, interactiveMode?, taskEngineMode? }` —— manifest 的 stage 是其子集（见 maic-format.md）。

`GeneratedAgentConfig { id, name, role, persona, avatar, color, priority, voiceConfig?, voiceDesign? }`；`VoiceDesign = { identity, texture, delivery }`（三层声纹描述，随文档旅行）。

`DSL_VERSION`（当前 0.3.0）：文档契约版本；`migrate(doc)` 幂等迁移。mediaIndex 不在其管辖内（ZIP 格式 version 自持 `formatVersion`）。

## 版本升级注意

- `packages/@openmaic/dsl/dist` 可能过期（源先行）——`pnpm --filter @openmaic/dsl build` 后重跑 `scripts/setup.mjs` 同步 vendor。
- skill 的 vendor 目录被 gitignore；setup 会在报告中打出 vendored 的 `DSL_VERSION`，检查报告与生成内容版本一致。
