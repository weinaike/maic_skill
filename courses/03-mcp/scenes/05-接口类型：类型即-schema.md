---
type: slide
title: 接口类型：类型即 schema
---

## 讲稿

工具能被调用，只是及格线；要让它被"调得准"，靠的是接口类型。这一节是整门课最值得记住的一句：类型写得越准，模型调用越稳。 @[text_sub]

先看左边这个反面例子。参数 q 和 limit 没写类型——模型只能猜：q 是字符串吗？limit 要传数字还是文字？猜错了调用就失败，失败了你还得排查半天。 @[code_naive]

再看右边：query 标了 str，limit 是 int 还带默认值，排序字段用 Literal 限定成两个取值，返回声明是 list[dict]。这些类型信息会被自动转成 JSON Schema，随着工具一起发给模型——模型是"看着说明书"在传参，不是在猜。 @[code_strong]

类型之外还有文档。函数的 docstring，以及 Annotated 里的说明文字，都会变成模型可见的工具描述。所以那句"按关键词检索文献，返回标题、年份、链接"，不只是给人看的注释——它是写给模型的使用说明。

这套机制带来三个直接好处：第一，哪些参数必传、哪些可选清清楚楚——默认值或 Optional 标出来的就是可选；第二，Literal 这类枚举约束，把"传错值"这个高频错误直接堵死；第三，长参数可以用 Pydantic 模型或 list[dict] 收纳，接口保持干净。 @[text_mapping]

建议大家现在就打开自己准备封装的那个函数，把每个参数补上类型，再写一句像样的 docstring——这一步的投入产出比，是整个 MCP 开发里最高的。

## 画布

```canvas
{
  "id": "slide_mcp_05",
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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">接口类型：类型即 schema</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">类型写得越准，模型调用越稳——类型会自动变成模型可见的 schema</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#6b7280"
    },
    {
      "id": "text_bad_label",
      "type": "text",
      "left": 60,
      "top": 158,
      "width": 430,
      "height": 32,
      "content": "<p style=\"font-size: 15px; color: #b91c1c;\">✕ 朴素写法：模型只能猜</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#b91c1c"
    },
    {
      "id": "code_naive",
      "type": "code",
      "left": 60,
      "top": 192,
      "width": 430,
      "height": 252,
      "language": "python",
      "showLineNumbers": false,
      "fontSize": 12,
      "lines": [
        {
          "id": "L1",
          "content": "@mcp.tool"
        },
        {
          "id": "L2",
          "content": "def search(q, limit):"
        },
        {
          "id": "L3",
          "content": "    return search_papers(q, limit)"
        },
        {
          "id": "L4",
          "content": ""
        },
        {
          "id": "L5",
          "content": "# q 是什么类型？必传吗？"
        },
        {
          "id": "L6",
          "content": "# limit 传 10 还是 \"10\"？"
        },
        {
          "id": "L7",
          "content": "# 模型不知道，只能靠猜"
        }
      ]
    },
    {
      "id": "text_good_label",
      "type": "text",
      "left": 510,
      "top": 158,
      "width": 430,
      "height": 32,
      "content": "<p style=\"font-size: 15px; color: #047857;\">✓ 强类型 + 文档：模型看得懂</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#047857"
    },
    {
      "id": "code_strong",
      "type": "code",
      "left": 510,
      "top": 192,
      "width": 430,
      "height": 252,
      "language": "python",
      "showLineNumbers": false,
      "fontSize": 12,
      "lines": [
        {
          "id": "L1",
          "content": "from typing import Literal"
        },
        {
          "id": "L2",
          "content": ""
        },
        {
          "id": "L3",
          "content": "@mcp.tool"
        },
        {
          "id": "L4",
          "content": "def search_papers("
        },
        {
          "id": "L5",
          "content": "    query: str,"
        },
        {
          "id": "L6",
          "content": "    limit: int = 10,"
        },
        {
          "id": "L7",
          "content": "    sort: Literal[\"date\", \"relevance\"]"
        },
        {
          "id": "L8",
          "content": "         = \"relevance\","
        },
        {
          "id": "L9",
          "content": ") -> list[dict]:"
        },
        {
          "id": "L10",
          "content": "    \"\"\"检索文献，返回标题/年份/链接\"\"\""
        },
        {
          "id": "L11",
          "content": "    return do_search(query, limit, sort)"
        }
      ]
    },
    {
      "id": "text_mapping",
      "type": "text",
      "left": 60,
      "top": 462,
      "width": 880,
      "height": 60,
      "content": "<p style=\"font-size: 14px; color: #334155;\">映射：str/int/float/bool → schema 基本类型｜docstring / Annotated → 工具描述｜Literal → 枚举约束取值｜Pydantic / list[dict] → 收纳长参数</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#334155"
    }
  ],
  "animations": []
}
```
