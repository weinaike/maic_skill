---
type: slide
title: The Three Primitives: Tools / Resources / Prompts
---

## 讲稿

So far, tool is the only primitive we've touched. This section walks through the interfaces of all three, no deep dive, just enough to recognize each one and know what belongs where. @[text_title]

Three interfaces, three cards, read them left to right. First, @mcp.tool, an old friend by now. Arguments in, results out; this is what the Agent uses to act. Batch-downloading papers, for example: hand it a list of URLs and a save directory, and it pulls every PDF back and returns the saved-file list. @[code_card_tool]

Second, @mcp.resource, and notice the URI address inside the decorator. A fixed URI exposes one config item; a template URI takes path parameters and opens a whole class of read-only data: results directories, database tables. @[code_card_res]

Third, @mcp.prompt, a parameterized prompt template. Take "review this paper from three angles, methods, data, and conclusions", freeze it into a template, and reuse it with one click from then on. @[code_card_pr]

Here's the rule of thumb: to run an action, use tool; to expose read-only data, use resource; to freeze a way of asking, use prompt. @[text_pick]

On return values, all three primitives can return text. A tool can also return an Image or structured content, say a chart saved as a picture and shown straight to the Agent. The most fun you can have in a research setting is returning a matplotlib figure directly as a tool result.

As for the advanced primitives, Sampling, Elicitation, and Roots: this course skips them; check the docs when you need them.

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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">The Three Primitives: Tools / Resources / Prompts</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">A first look at the interfaces: three decorators, three ways to package</p>",
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
      "content": "<p style=\"font-size: 18px; color: #1e3a5f;\">@mcp.tool · Action</p>",
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
          "content": "    \"\"\"Batch-download paper PDFs\"\"\""
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
      "content": "<p style=\"font-size: 13px; color: #475569;\">Run an action, get results back</p>",
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
      "content": "<p style=\"font-size: 18px; color: #065f46;\">@mcp.resource · Data</p>",
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
      "content": "<p style=\"font-size: 13px; color: #475569;\">Expose read-only data by URI</p>",
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
      "content": "<p style=\"font-size: 18px; color: #9a3412;\">@mcp.prompt · Template</p>",
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
          "content": "    return f\"Review paper: {name}\""
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
      "content": "<p style=\"font-size: 13px; color: #475569;\">Freeze a reusable way of asking</p>",
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
      "content": "<p style=\"font-size: 14px; color: #334155;\">Pick: run an action → tool | expose read-only data → resource (URI template params) | freeze a question → prompt<br />Returns: all three can return text; a tool can also return an Image or structured content</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#334155"
    }
  ],
  "animations": []
}
```
