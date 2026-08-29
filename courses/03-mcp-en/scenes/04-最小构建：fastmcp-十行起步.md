---
type: slide
title: 最小构建：fastmcp 十行起步
---

## 讲稿

现在轮到自己动手了。目标很明确：把一个你已经在用的科研函数，变成 Agent 能调用的工具。我们用 Python 的 fastmcp 库，整个过程真的只有十行左右。 @[text_step_install]

看右边这段代码。第一步，安装：pip install fastmcp，然后创建一个 Server 实例，起个名字。第二步，关键的一步——在你原来的函数上面加一个 @mcp.tool 装饰器。就这么一下，普通函数立刻变成了 MCP 工具：函数名变成工具名，参数变成工具的入参，返回值就是结果。 @[code_minimal]

我们拿文献下载来举例。download_paper，原来就是你脚本里的一个函数：给它一个网址，它把 PDF 拉下来存好，返回保存路径。

加了装饰器、写上参数类型之后，Agent 就能"看到"这个工具，知道它叫什么、要传什么、会返回什么。注意函数下面那句 docstring——它是写给模型看的说明书，后面第五节会专门讲怎么写好它。

第三步，启动：mcp.run()，默认走 stdio，本地就能跑。然后用上一节的三步接入回去：claude mcp add 一条命令挂上，工具列表里立刻出现你的工具，试调用，通了。 @[text_step_run]

有同学可能想用 TypeScript——完全可以，官方 SDK 的写法是同构的，装饰器换成对应的注解就行。后面我们都用 Python 讲。

## 画布

```canvas
{
  "id": "slide_mcp_04",
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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">最小构建：fastmcp 十行起步</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">一个装饰器的距离：普通函数 → Agent 可调用的工具</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#6b7280"
    },
    {
      "id": "shape_step_install",
      "type": "shape",
      "left": 60,
      "top": 170,
      "width": 330,
      "height": 82,
      "shape": "roundRect",
      "fill": "#e8f1fb",
      "viewBox": [
        330,
        82
      ],
      "path": "M0 0 L330 0 L330 82 L0 82 Z",
      "fixedRatio": false
    },
    {
      "id": "text_step_install",
      "type": "text",
      "left": 80,
      "top": 182,
      "width": 295,
      "height": 60,
      "content": "<p style=\"font-size: 16px; color: #1e3a5f;\">① 安装与初始化<br /><span style=\"font-size: 13px; color: #475569;\">pip install fastmcp → FastMCP(名字)</span></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e3a5f"
    },
    {
      "id": "shape_step_tool",
      "type": "shape",
      "left": 60,
      "top": 262,
      "width": 330,
      "height": 82,
      "shape": "roundRect",
      "fill": "#ecfdf5",
      "viewBox": [
        330,
        82
      ],
      "path": "M0 0 L330 0 L330 82 L0 82 Z",
      "fixedRatio": false
    },
    {
      "id": "text_step_tool",
      "type": "text",
      "left": 80,
      "top": 274,
      "width": 295,
      "height": 60,
      "content": "<p style=\"font-size: 16px; color: #065f46;\">② @mcp.tool 装饰器<br /><span style=\"font-size: 13px; color: #475569;\">函数名/参数/返回值 → 工具的三件套</span></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#065f46"
    },
    {
      "id": "shape_step_run",
      "type": "shape",
      "left": 60,
      "top": 354,
      "width": 330,
      "height": 82,
      "shape": "roundRect",
      "fill": "#fff7ed",
      "viewBox": [
        330,
        82
      ],
      "path": "M0 0 L330 0 L330 82 L0 82 Z",
      "fixedRatio": false
    },
    {
      "id": "text_step_run",
      "type": "text",
      "left": 80,
      "top": 366,
      "width": 295,
      "height": 60,
      "content": "<p style=\"font-size: 16px; color: #9a3412;\">③ mcp.run() 启动<br /><span style=\"font-size: 13px; color: #475569;\">默认 stdio 本地跑，接回三步接入验收</span></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#9a3412"
    },
    {
      "id": "code_minimal",
      "type": "code",
      "left": 410,
      "top": 168,
      "width": 530,
      "height": 300,
      "language": "python",
      "showLineNumbers": false,
      "fontSize": 13,
      "lines": [
        {
          "id": "L1",
          "content": "from fastmcp import FastMCP"
        },
        {
          "id": "L2",
          "content": ""
        },
        {
          "id": "L3",
          "content": "mcp = FastMCP(\"paper-tools\")"
        },
        {
          "id": "L4",
          "content": ""
        },
        {
          "id": "L5",
          "content": "@mcp.tool"
        },
        {
          "id": "L6",
          "content": "def download_paper(url: str,"
        },
        {
          "id": "L7",
          "content": "        save_dir: str = \"~/papers\") -> str:"
        },
        {
          "id": "L8",
          "content": "    \"\"\"下载论文 PDF，返回保存路径\"\"\""
        },
        {
          "id": "L9",
          "content": "    path = fetch_and_save(url, save_dir)"
        },
        {
          "id": "L10",
          "content": "    return f\"已保存：{path}\""
        },
        {
          "id": "L11",
          "content": ""
        },
        {
          "id": "L12",
          "content": "mcp.run()  # stdio 启动"
        }
      ]
    },
    {
      "id": "text_footnote",
      "type": "text",
      "left": 60,
      "top": 482,
      "width": 880,
      "height": 40,
      "content": "<p style=\"font-size: 14px; color: #475569;\">接入回看 §3：claude mcp add paper-tools -- python server.py → 工具列表出现 → 试调用 ｜ TypeScript SDK 写法同构</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    }
  ],
  "animations": []
}
```
