---
type: slide
title: Minimal Build: fastmcp in Ten Lines
---

## 讲稿

Now it's our turn to build something. The goal is clear. Take a research function you already use, and turn it into a tool the Agent can call. We'll use the Python library fastmcp. The whole thing really is about ten lines. @[text_step_install]

Look at the code block on the right. Step one, install. pip install fastmcp, then create a Server instance and give it a name. Step two, and this is the key move. Add one @mcp.tool decorator on top of your existing function. Just like that, a plain function becomes an MCP tool. The function name becomes the tool name. The parameters become the tool's inputs. The return value is the result. @[code_minimal]

Let's use paper downloading as the example. download_paper used to be just a function in your script. Give it a URL, and it pulls the PDF down, saves it, and returns the saved path.

With the decorator on and the parameter types written in, the Agent can see the tool. It knows what the tool is called, what to pass in, and what comes back. Notice the docstring just under the function signature. That's the manual you write for the model. Section five comes back to how to write it well.

Step three, start it up. Call mcp.run(), stdio by default, so it runs right on your machine. Then use the three-step setup from the last part. One command, claude mcp add, to mount it. Your tool shows up in the list right away. Give it a trial call. It works. @[text_step_run]

Some of you may prefer TypeScript. That works too. The official SDK is shaped the same way. Just swap the decorator for the matching annotation. We'll stay with Python for the rest of the course.

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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">Minimal Build: fastmcp in Ten Lines</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">One decorator away: plain function → a tool the Agent can call</p>",
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
      "content": "<p style=\"font-size: 16px; color: #1e3a5f;\">① Install and initialize<br /><span style=\"font-size: 13px; color: #475569;\">pip install fastmcp → FastMCP(name)</span></p>",
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
      "content": "<p style=\"font-size: 16px; color: #065f46;\">② The @mcp.tool decorator<br /><span style=\"font-size: 13px; color: #475569;\">name/params/return → the tool's three parts</span></p>",
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
      "content": "<p style=\"font-size: 16px; color: #9a3412;\">③ Start with mcp.run()<br /><span style=\"font-size: 13px; color: #475569;\">stdio by default; then the 3-step check</span></p>",
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
          "content": "    \"\"\"Download the paper PDF and return the saved path\"\"\""
        },
        {
          "id": "L9",
          "content": "    path = fetch_and_save(url, save_dir)"
        },
        {
          "id": "L10",
          "content": "    return f\"Saved: {path}\""
        },
        {
          "id": "L11",
          "content": ""
        },
        {
          "id": "L12",
          "content": "mcp.run()  # starts on stdio"
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
      "content": "<p style=\"font-size: 14px; color: #475569;\">Recap §3: claude mcp add paper-tools -- python server.py → tool shows up → try a call | TypeScript SDK works the same</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    }
  ],
  "animations": []
}
```
