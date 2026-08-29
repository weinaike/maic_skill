---
type: slide
title: 课程MCP连接方法
---

## 讲稿

前面我们聊了工具选择，接下来是要进行课程项目实践， 我们先建立本地Agent和课程的MCP连接。 这一步是后续所有 Agent 实战的基础，这一页是配置说明，具体参数和连接命令，可以到项目页面获取。

第一步，在 Claude Code 中配置课程 MCP比较简单，申请一个API Key,然后在终端发送连接指令就可以了。 具体看项目页面说明。 @[text_r9ioCvmD]

第二步，确认 MCP 连接生效。配置完之后，大家要做一个简单的验证，看看 Claude Code 能不能正确调用课程 MCP 提供的工具集。如果连接没通，后面所有步骤都走不下去，所以这一步千万别跳过。试下这个斜杠命令能否正常调出 @[text_advRG_Vb] @[image_8ENc1Gb9]

连接成功后，这个workflow指令，能够触发项目的工作流，它会指引你开展项目工作。接下来你可以到项目页试试手了。 @[text_VZfbS850]

## 画布

```canvas
{
  "id": "4DpLBSUqbxRkn6U2-dlw4",
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
  "elements": [
    {
      "id": "shape_YlgmQJv4",
      "type": "shape",
      "left": 0,
      "top": 0,
      "width": 1000,
      "height": 6,
      "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#0369a1",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_wcT6TL6l",
      "type": "shape",
      "left": 820,
      "top": -30,
      "width": 120,
      "height": 120,
      "path": "M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 A 0.5 0.5 0 1 1 1 0.5 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#e0f2fe",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_iwvwQD2z",
      "type": "shape",
      "left": -40,
      "top": 380,
      "width": 200,
      "height": 200,
      "path": "M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 A 0.5 0.5 0 1 1 1 0.5 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#f0f9ff",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "text_Ci0nwA2p",
      "type": "text",
      "left": 60,
      "top": 50,
      "width": 880,
      "height": 68,
      "content": "<p style=\"text-align: center;\"><strong><span style=\"font-size: 32px;\"><span style=\"color: rgb(12, 74, 110);\">Claude Code 课程 MCP 连接方法</span></span></strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#0c4a6e",
      "rotate": 0
    },
    {
      "id": "shape_Ic738m4h",
      "type": "shape",
      "left": 400,
      "top": 124,
      "width": 200,
      "height": 4,
      "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#0369a1",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_E6hUV0sL",
      "type": "shape",
      "left": 145,
      "top": 144,
      "width": 50,
      "height": 50,
      "path": "M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 A 0.5 0.5 0 1 1 1 0.5 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#1e40af",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_FkQazzNH",
      "type": "shape",
      "left": 365,
      "top": 144,
      "width": 50,
      "height": 50,
      "path": "M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 A 0.5 0.5 0 1 1 1 0.5 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#0369a1",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_VNcUWfde",
      "type": "shape",
      "left": 585,
      "top": 144,
      "width": 50,
      "height": 50,
      "path": "M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 A 0.5 0.5 0 1 1 1 0.5 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#0891b2",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "text_r9ioCvmD",
      "type": "text",
      "left": 145,
      "top": 144,
      "width": 50,
      "height": 50,
      "content": "<p style=\"text-align: center;\"><span style=\"font-size: 20px;\"><span style=\"color: rgb(255, 255, 255);\">1</span></span></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#ffffff",
      "rotate": 0
    },
    {
      "id": "text_advRG_Vb",
      "type": "text",
      "left": 365,
      "top": 143,
      "width": 50,
      "height": 50,
      "content": "<p style=\"font-size: 20px; text-align: center; color: #ffffff;\">2</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#ffffff",
      "rotate": 0
    },
    {
      "id": "text_VZfbS850",
      "type": "text",
      "left": 585,
      "top": 143,
      "width": 50,
      "height": 50,
      "content": "<p style=\"font-size: 20px; text-align: center; color: #ffffff;\">3</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#ffffff",
      "rotate": 0
    },
    {
      "id": "line_6gS7p8FH",
      "type": "line",
      "left": 200,
      "top": 168,
      "width": 3,
      "start": [
        0,
        0
      ],
      "end": [
        160,
        0
      ],
      "style": "solid",
      "color": "#94a3b8",
      "points": [
        "",
        "arrow"
      ],
      "rotate": 0
    },
    {
      "id": "line_6S9qgl8r",
      "type": "line",
      "left": 420,
      "top": 168,
      "width": 3,
      "start": [
        0,
        0
      ],
      "end": [
        160,
        0
      ],
      "style": "solid",
      "color": "#94a3b8",
      "points": [
        "",
        "arrow"
      ],
      "rotate": 0
    },
    {
      "id": "text_NiX-j_sT",
      "type": "text",
      "left": 60,
      "top": 204,
      "width": 220,
      "height": 68,
      "content": "<p style=\"font-size: 14px; text-align: center; color: #1e293b;\">Claude Code</p><p style=\"font-size: 14px; text-align: center; color: #1e293b;\">配置课程 MCP</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e293b",
      "rotate": 0
    },
    {
      "id": "text_nk__CopW",
      "type": "text",
      "left": 280,
      "top": 204,
      "width": 220,
      "height": 68,
      "content": "<p style=\"font-size: 14px; text-align: center; color: #1e293b;\">确认 MCP</p><p style=\"font-size: 14px; text-align: center; color: #1e293b;\">连接生效</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e293b",
      "rotate": 0
    },
    {
      "id": "text_QVOV_Ah-",
      "type": "text",
      "left": 500,
      "top": 204,
      "width": 220,
      "height": 68,
      "content": "<p style=\"font-size: 14px; text-align: center; color: #1e293b;\">获取 Agent</p><p style=\"font-size: 14px; text-align: center; color: #1e293b;\">项目指引</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e293b",
      "rotate": 0
    },
    {
      "id": "shape_6M6cHfkm",
      "type": "shape",
      "left": 160,
      "top": 274,
      "width": 200,
      "height": 238,
      "path": "M 0.05 0 L 0.95 0 Q 1 0 1 0.05 L 1 0.95 Q 1 1 0.95 1 L 0.05 1 Q 0 1 0 0.95 L 0 0.05 Q 0 0 0.05 0 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#e0f2fe",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_aXTM00sZ",
      "type": "shape",
      "left": 380,
      "top": 274,
      "width": 460,
      "height": 238,
      "path": "M 0.05 0 L 0.95 0 Q 1 0 1 0.05 L 1 0.95 Q 1 1 0.95 1 L 0.05 1 Q 0 1 0 0.95 L 0 0.05 Q 0 0 0.05 0 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#e0f2fe",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "image_ScKl7dR0",
      "type": "image",
      "left": 170,
      "top": 296,
      "width": 180,
      "height": 168,
      "src": "data:image/png;base64,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",
      "fixedRatio": true,
      "rotate": 0
    },
    {
      "id": "image_8ENc1Gb9",
      "type": "image",
      "left": 390,
      "top": 282,
      "width": 440,
      "height": 169,
      "src": "data:image/png;base64,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",
      "fixedRatio": true,
      "rotate": 0
    },
    {
      "id": "text_BiL7ufDf",
      "type": "text",
      "left": 170,
      "top": 458,
      "width": 180,
      "height": 44,
      "content": "<p style=\"font-size: 14px; text-align: center; color: #0369a1;\"><strong>配置课程 MCP</strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#0369a1",
      "rotate": 0
    },
    {
      "id": "text_TSQdLTa8",
      "type": "text",
      "left": 390,
      "top": 458,
      "width": 440,
      "height": 44,
      "content": "<p style=\"text-align: center;\"><strong><span style=\"font-size: 14px;\"><span style=\"color: rgb(3, 105, 161);\">确认MCP连接生效</span></span></strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#0369a1",
      "rotate": 0
    }
  ],
  "background": {
    "type": "solid",
    "color": "#ffffff"
  },
  "animations": []
}
```
