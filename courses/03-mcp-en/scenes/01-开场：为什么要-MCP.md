---
type: slide
title: Opening: Why MCP?
---

## 讲稿

Alright, welcome to Lecture Three of the Agent series. We've come a long way. You've worked with the tools hands-on. You met Token, and saw how the model reads text. You picked up Prompting, and learned to explain a task clearly. And last time, we built the Agent framework. By now, your Agent can think and plan. @[text_main_title]

But can it get real work done? Not yet. You've got paper-processing functions, data-cleaning scripts, plotting code. But they all live in your codebase, out of the Agent's reach. For now, it's just a brain that can chat. @[text_subtitle]

Here's the bigger headache: before, getting a client to use a tool meant writing a custom integration just for that pair. More tools, more clients — there's no way to maintain all that one-to-one custom code.

MCP, the Model Context Protocol, is the open standard built to solve exactly this. One protocol: wrap a tool once, and any client can use it. The goal is concrete: by the end, you'll wrap one of your own research functions as an MCP with your own hands. The roadmap is three steps: first put it to use, then learn to build, and finally, build it well. @[text_tag]

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
      "content": "<p style=\"font-size: 14px; text-align: center; color: #38bdf8;\">Agent Series · Lecture 3 · Tool Protocol</p>",
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
      "content": "<p style=\"font-size: 32px; text-align: center; color: #1f2937;\">MCP: Plug Your Agent into Your Tools</p>",
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
      "content": "<p style=\"font-size: 18px; text-align: center; color: #6b7280;\">From using ready-made tools to wrapping your own research function as MCP</p>",
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
      "content": "<p style=\"font-size: 13px; text-align: center; color: #e2e8f0;\">Prereq: Tools · Prompt · Token · Agent framework | You'll build: your first MCP</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#e2e8f0"
    }
  ],
  "animations": []
}
```
