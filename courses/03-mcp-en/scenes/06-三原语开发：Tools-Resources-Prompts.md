---
type: slide
title: 三原语接口：Tools / Resources / Prompts
---

## 讲稿

前面我们一直在用 tool，这一节把三个原语的接口都过一遍——不深入，就是让你认识它们长什么样、什么内容该装进哪个。 @[text_title]

三个接口，从左往右看这三张卡。第一个，@mcp.tool，你已经熟了。参数进去、结果出来，Agent 执行动作用它——比如批量下载论文：给它一组网址和一个保存目录，它把 PDF 逐个拉回来，返回保存清单。 @[code_card_tool]

第二个，@mcp.resource，注意装饰器里带了一个 URI 地址：固定地址暴露一份配置，模板地址还能带上路径参数，把一整类只读数据挂出来——你的实验结果目录、数据库表，都可以这样暴露。 @[code_card_res]

第三个，@mcp.prompt，参数化的提示词模板：比如把"请从方法、数据、结论三个角度评审这篇论文"固化成模板，以后一键套用。 @[code_card_pr]

一句话选型：要执行动作，用 tool；要暴露只读数据，用 resource；要固化提问方式，用 prompt。 @[text_pick]

返回值方面，三个原语都可以返回文本，tool 还可以返回 Image 图片或者结构化内容——比如图表存成图片直接回给 Agent 看。科研场景里最有意思的玩法，就是把 matplotlib 出的图直接作为工具返回值。

至于 Sampling、Elicitation、Roots 这些进阶原语，本课不讲，用到的时候再查文档就好。

## 画布

```canvas
{
  "id": "slide_mcp_06",
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
      "id": "text_title",
      "type": "text",
      "left": 60,
      "top": 40,
      "width": 880,
      "height": 62,
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">三原语接口：Tools / Resources / Prompts</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1f2937"
    },
    {
      "id": "shape_underline",
      "type": "shape",
      "left": 70,
      "top": 106,
      "width": 60,
      "height": 3,
      "shape": "rect",
      "fill": "#5b9bd5",
      "viewBox": [
        60,
        3
      ],
      "path": "M0 0 L60 0 L60 3 L0 3 Z",
      "fixedRatio": false
    },
    {
      "id": "text_sub",
      "type": "text",
      "left": 60,
      "top": 120,
      "width": 880,
      "height": 30,
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">接口层面的简单认识：三个装饰器，三种装法</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#6b7280"
    },
    {
      "id": "shape_card_tool",
      "type": "shape",
      "left": 60,
      "top": 170,
      "width": 270,
      "height": 250,
      "shape": "roundRect",
      "fill": "#e8f1fb",
      "viewBox": [
        270,
        250
      ],
      "path": "M0 0 L270 0 L270 250 L0 250 Z",
      "fixedRatio": false
    },
    {
      "id": "text_card_tool_t",
      "type": "text",
      "left": 80,
      "top": 184,
      "width": 230,
      "height": 40,
      "content": "<p style=\"font-size: 18px; color: #1e3a5f;\">@mcp.tool · 动作</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e3a5f"
    },
    {
      "id": "code_card_tool",
      "type": "code",
      "left": 75,
      "top": 228,
      "width": 240,
      "height": 130,
      "language": "python",
      "showLineNumbers": false,
      "fontSize": 11,
      "lines": [
        {
          "id": "L1",
          "content": "@mcp.tool"
        },
        {
          "id": "L2",
          "content": "def batch_download(urls: list[str],"
        },
        {
          "id": "L3",
          "content": "        save_dir: str) -> list[dict]:"
        },
        {
          "id": "L4",
          "content": "    \"\"\"批量下载论文 PDF\"\"\""
        },
        {
          "id": "L5",
          "content": "    return save_all(urls, save_dir)"
        }
      ]
    },
    {
      "id": "text_card_tool_use",
      "type": "text",
      "left": 80,
      "top": 368,
      "width": 230,
      "height": 40,
      "content": "<p style=\"font-size: 13px; color: #475569;\">执行动作并拿回结果</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "shape_card_res",
      "type": "shape",
      "left": 365,
      "top": 170,
      "width": 270,
      "height": 250,
      "shape": "roundRect",
      "fill": "#ecfdf5",
      "viewBox": [
        270,
        250
      ],
      "path": "M0 0 L270 0 L270 250 L0 250 Z",
      "fixedRatio": false
    },
    {
      "id": "text_card_res_t",
      "type": "text",
      "left": 385,
      "top": 184,
      "width": 230,
      "height": 40,
      "content": "<p style=\"font-size: 18px; color: #065f46;\">@mcp.resource · 数据</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#065f46"
    },
    {
      "id": "code_card_res",
      "type": "code",
      "left": 380,
      "top": 228,
      "width": 240,
      "height": 130,
      "language": "python",
      "showLineNumbers": false,
      "fontSize": 11,
      "lines": [
        {
          "id": "L1",
          "content": "@mcp.resource(\"data://{path}\")"
        },
        {
          "id": "L2",
          "content": "def get(path: str) -> str:"
        },
        {
          "id": "L3",
          "content": "    return read(path)"
        }
      ]
    },
    {
      "id": "text_card_res_use",
      "type": "text",
      "left": 385,
      "top": 368,
      "width": 230,
      "height": 40,
      "content": "<p style=\"font-size: 13px; color: #475569;\">按 URI 暴露只读数据</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "shape_card_pr",
      "type": "shape",
      "left": 670,
      "top": 170,
      "width": 270,
      "height": 250,
      "shape": "roundRect",
      "fill": "#fff7ed",
      "viewBox": [
        270,
        250
      ],
      "path": "M0 0 L270 0 L270 250 L0 250 Z",
      "fixedRatio": false
    },
    {
      "id": "text_card_pr_t",
      "type": "text",
      "left": 690,
      "top": 184,
      "width": 230,
      "height": 40,
      "content": "<p style=\"font-size: 18px; color: #9a3412;\">@mcp.prompt · 模板</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#9a3412"
    },
    {
      "id": "code_card_pr",
      "type": "code",
      "left": 685,
      "top": 228,
      "width": 240,
      "height": 130,
      "language": "python",
      "showLineNumbers": false,
      "fontSize": 11,
      "lines": [
        {
          "id": "L1",
          "content": "@mcp.prompt()"
        },
        {
          "id": "L2",
          "content": "def review(name: str) -> str:"
        },
        {
          "id": "L3",
          "content": "    return f\"请评审：{name}\""
        }
      ]
    },
    {
      "id": "text_card_pr_use",
      "type": "text",
      "left": 690,
      "top": 368,
      "width": 230,
      "height": 40,
      "content": "<p style=\"font-size: 13px; color: #475569;\">固化参数化的提问方式</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "text_pick",
      "type": "text",
      "left": 60,
      "top": 448,
      "width": 880,
      "height": 60,
      "content": "<p style=\"font-size: 14px; color: #334155;\">选型：要执行动作 → tool｜要暴露只读数据 → resource（URI 模板带参数）｜要固化提问 → prompt<br />返回：三原语皆可文本；tool 另可回传 Image 或结构化内容</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#334155"
    }
  ],
  "animations": []
}
```
