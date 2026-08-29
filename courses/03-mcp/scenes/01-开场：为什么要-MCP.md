---
type: slide
title: 开场：为什么要 MCP
---

## 讲稿

好，欢迎大家来到 Agent 系列的第三讲。前几讲我们一路走过来：也上手了工具的使用，认识了 Token，理解了模型是怎么读文字的；学了 Prompt，学会了怎么把任务讲清楚；上一讲又搭起了 Agent 的框架。到这里，你的 Agent 已经会思考、会规划了。 @[text_main_title]

但它会干活吗？还不会。你手里有现成的文献处理函数、数据清洗脚本、绘图代码，可这些都在你的代码库里，Agent 够不着——它现在还只是个会聊天的脑子。 @[text_subtitle]

更麻烦的是，以前想让某个客户端用上某个工具，就得为它俩专门写一次集成。工具越来越多、客户端越来越多，这种两两定制的写法根本维护不过来。

MCP 就是来解决这件事的开放标准——Model Context Protocol，模型上下文协议。一套协议，工具封装一次，任何客户端都能用。这一讲的目标很实在：学完之后，你能亲手把一个自己的科研函数封装成 MCP。路线是三步——先用起来、再学会建、最后把它建好。 @[text_tag]

## 画布

```canvas
{
  "id": "slide_mcp_01",
  "viewportSize": 1000,
  "viewportRatio": 0.5625,
  "theme": {
    "backgroundColor": "#ffffff",
    "themeColors": [
      "#5b9bd5",
      "#ed7d31",
      "#a5a5a5",
      "#ffc000",
      "#4472c4"
    ],
    "fontColor": "#333333",
    "fontName": "Microsoft YaHei",
    "outline": {
      "color": "#d14424",
      "width": 2,
      "style": "solid"
    },
    "shadow": {
      "h": 0,
      "v": 0,
      "blur": 10,
      "color": "#000000"
    }
  },
  "background": {
    "type": "background",
    "color": "#ffffff"
  },
  "elements": [
    {
      "id": "shape_deco_tr",
      "type": "shape",
      "left": 730,
      "top": -140,
      "width": 380,
      "height": 380,
      "shape": "ellipse",
      "fill": "#1e3a5f",
      "viewBox": [
        380,
        380
      ],
      "path": "M0 0 L380 0 L380 380 L0 380 Z",
      "fixedRatio": false
    },
    {
      "id": "shape_deco_bl",
      "type": "shape",
      "left": -130,
      "top": 350,
      "width": 340,
      "height": 340,
      "shape": "ellipse",
      "fill": "#1e3a5f",
      "viewBox": [
        340,
        340
      ],
      "path": "M0 0 L340 0 L340 340 L0 340 Z",
      "fixedRatio": false
    },
    {
      "id": "shape_topbar",
      "type": "shape",
      "left": 440,
      "top": 115,
      "width": 120,
      "height": 3,
      "shape": "rect",
      "fill": "#38bdf8",
      "viewBox": [
        120,
        3
      ],
      "path": "M0 0 L120 0 L120 3 L0 3 Z",
      "fixedRatio": false
    },
    {
      "id": "text_kicker",
      "type": "text",
      "left": 350,
      "top": 130,
      "width": 300,
      "height": 44,
      "content": "<p style=\"font-size: 16px; text-align: center; color: #38bdf8;\">AGENT 系列第三讲 · 工具连接协议</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#38bdf8"
    },
    {
      "id": "text_main_title",
      "type": "text",
      "left": 200,
      "top": 195,
      "width": 600,
      "height": 74,
      "content": "<p style=\"font-size: 36px; text-align: center; color: #1f2937;\">MCP：让 Agent 接入你的工具</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1f2937"
    },
    {
      "id": "shape_divider",
      "type": "shape",
      "left": 400,
      "top": 285,
      "width": 200,
      "height": 3,
      "shape": "rect",
      "fill": "#38bdf8",
      "viewBox": [
        200,
        3
      ],
      "path": "M0 0 L200 0 L200 3 L0 3 Z",
      "fixedRatio": false
    },
    {
      "id": "text_subtitle",
      "type": "text",
      "left": 150,
      "top": 308,
      "width": 700,
      "height": 50,
      "content": "<p style=\"font-size: 20px; text-align: center; color: #6b7280;\">从用上现成工具，到把你的科研函数封装成 MCP</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#6b7280"
    },
    {
      "id": "shape_tag_bg",
      "type": "shape",
      "left": 230,
      "top": 415,
      "width": 540,
      "height": 50,
      "shape": "roundRect",
      "fill": "#152a4a",
      "viewBox": [
        540,
        50
      ],
      "path": "M0 0 L540 0 L540 50 L0 50 Z",
      "fixedRatio": false
    },
    {
      "id": "text_tag",
      "type": "text",
      "left": 250,
      "top": 417,
      "width": 500,
      "height": 44,
      "content": "<p style=\"font-size: 14px; text-align: center; color: #e2e8f0;\">前置：工具 · Prompt · Token · Agent 框架｜本课产出：你的第一个 MCP</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#e2e8f0"
    }
  ],
  "animations": []
}
```
