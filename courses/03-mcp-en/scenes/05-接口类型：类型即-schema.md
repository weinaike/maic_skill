---
type: slide
title: Interface Types: Types Are the Schema
---

## 讲稿

A tool that can be called at all is just the passing bar; getting it called accurately is what interface types are for. This section gives you the line most worth remembering in this course: the tighter your types, the steadier the model's calls. @[text_sub]

Start with the bad example on the left. Parameters q and limit carry no types, so the model can only guess: is q a string? Should limit be a number or text? One bad guess and the call fails, and you're the one stuck debugging it for ages. @[code_naive]

Now the right side: query is a str, limit an int with a default, sort pinned by Literal to two values, and the return a list of dicts. Those types turn into a JSON Schema automatically and travel with the tool, so the model passes arguments from the manual, not from guesswork. @[code_strong]

Beyond types, there is documentation. The function's docstring, and the notes you put inside Annotated, all become part of the tool description the model sees. So the line "search papers, return title, year, and link" is not a comment for humans; it is the manual written for the model.

This setup hands you three direct wins. Defaults or an Optional make optional parameters obvious; enum constraints like Literal block the classic wrong-value error outright; and Pydantic or a list of dicts keeps long interfaces clean. @[text_mapping]

Here's something to do right now: open the function you plan to wrap, give every parameter a type, and write one decent docstring. The payoff on this step is the highest in all of MCP development.

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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">Interface Types: Types Are the Schema</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">The tighter your types, the steadier the model's calls — types become the schema the model sees</p>",
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
      "content": "<p style=\"font-size: 15px; color: #b91c1c;\">✕ Naive: the model can only guess</p>",
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
          "content": "# What type is q? Is it required?"
        },
        {
          "id": "L6",
          "content": "# limit: 10 or \"10\"?"
        },
        {
          "id": "L7",
          "content": "# The model can't tell; it guesses"
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
      "content": "<p style=\"font-size: 15px; color: #047857;\">✓ Strong types + docs: the model understands</p>",
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
          "content": "    \"\"\"Search papers; return title/year/link\"\"\""
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
      "content": "<p style=\"font-size: 14px; color: #334155;\">Mapping: str/int/float/bool → schema primitives | docstring / Annotated → tool description | Literal → enum constraint | Pydantic / list[dict] → wraps long parameter lists</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#334155"
    }
  ],
  "animations": []
}
```
