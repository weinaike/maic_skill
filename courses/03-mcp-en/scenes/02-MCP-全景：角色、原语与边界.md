---
type: slide
title: The MCP Landscape: Roles, Primitives, and Boundaries
---

## 讲稿

Before we start, let's look at the whole map. The MCP world has just three roles. The Host is the client, like Claude Code or WorkBuddy. The Server is the tool provider, the program you write. And in the middle, the Client is the protocol layer, passing messages by the MCP spec. They speak JSON-RPC, stdio locally, HTTP remotely. Remember that much. No need to memorize the details. @[text_roles]

So what can a Server offer? Three things, and we call them the three primitives. Check the three cards, left to right. First, Tools. A tool is a function the Agent can call. It lets the Agent run an action and get a result back. Tools are what you'll use most. @[text_card_tools]

Second, Resources. A resource is read-only data. Think files, database tables, experiment results. They're exposed at an address for the client to read. Third, Prompts. A prompt is a template for questions you ask often, parameterized so users can apply it with one click. @[text_card_res]

So when should you reach for MCP? Remember one quick rule. To execute an action, make it an MCP tool. To capture process knowledge, write a Skill. To split work across several roles, use SubAgents. Each of the three owns its own lane. Don't mix them up. @[text_boundary]

Now you might ask, how is this different from traditional function calling? The difference comes down to one word: standard. Function calling is tied to one model. MCP is client-agnostic. Wrap it once, and Claude Code can use it, and so can any other MCP-capable client. That's why it's worth learning.

## 画布

```canvas
{
  "id": "slide_mcp_02",
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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">The MCP Landscape: Roles, Primitives, and Boundaries</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">Get the whole map first: who's talking, what gets passed, how it connects to what you know</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#6b7280"
    },
    {
      "id": "text_roles",
      "type": "text",
      "left": 60,
      "top": 162,
      "width": 880,
      "height": 34,
      "content": "<p style=\"font-size: 14px; text-align: center; color: #475569;\">Host (client, e.g. Claude Code) — Client (protocol layer) — Server (tool provider)</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "shape_card_tools",
      "type": "shape",
      "left": 60,
      "top": 215,
      "width": 270,
      "height": 220,
      "shape": "roundRect",
      "fill": "#e8f1fb",
      "viewBox": [
        270,
        220
      ],
      "path": "M0 0 L270 0 L270 220 L0 220 Z",
      "fixedRatio": false
    },
    {
      "id": "text_card_tools",
      "type": "text",
      "left": 80,
      "top": 238,
      "width": 230,
      "height": 46,
      "content": "<p style=\"font-size: 20px; color: #1e3a5f;\">Tools</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e3a5f"
    },
    {
      "id": "text_card_tools_body",
      "type": "text",
      "left": 80,
      "top": 292,
      "width": 230,
      "height": 120,
      "content": "<p style=\"font-size: 14px; color: #475569;\">• Functions the Agent can call<br />• Run an action, get a result back<br />• e.g. search papers, download PDFs, run cleaning scripts</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "shape_card_res",
      "type": "shape",
      "left": 365,
      "top": 215,
      "width": 270,
      "height": 220,
      "shape": "roundRect",
      "fill": "#ecfdf5",
      "viewBox": [
        270,
        220
      ],
      "path": "M0 0 L270 0 L270 220 L0 220 Z",
      "fixedRatio": false
    },
    {
      "id": "text_card_res",
      "type": "text",
      "left": 385,
      "top": 238,
      "width": 230,
      "height": 46,
      "content": "<p style=\"font-size: 20px; color: #065f46;\">Resources</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#065f46"
    },
    {
      "id": "text_card_res_body",
      "type": "text",
      "left": 385,
      "top": 292,
      "width": 230,
      "height": 120,
      "content": "<p style=\"font-size: 14px; color: #475569;\">• Read-only data, exposed by URI<br />• e.g. files, database tables, experiment results<br />• The client reads by address</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "shape_card_prompt",
      "type": "shape",
      "left": 670,
      "top": 215,
      "width": 270,
      "height": 220,
      "shape": "roundRect",
      "fill": "#fff7ed",
      "viewBox": [
        270,
        220
      ],
      "path": "M0 0 L270 0 L270 220 L0 220 Z",
      "fixedRatio": false
    },
    {
      "id": "text_card_prompt",
      "type": "text",
      "left": 690,
      "top": 238,
      "width": 230,
      "height": 46,
      "content": "<p style=\"font-size: 20px; color: #9a3412;\">Prompts</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#9a3412"
    },
    {
      "id": "text_card_prompt_body",
      "type": "text",
      "left": 690,
      "top": 292,
      "width": 230,
      "height": 120,
      "content": "<p style=\"font-size: 14px; color: #475569;\">• Parameterized question templates<br />• e.g. paper review outline, weekly report skeleton<br />• Users apply one in a click</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#475569"
    },
    {
      "id": "text_boundary",
      "type": "text",
      "left": 60,
      "top": 462,
      "width": 880,
      "height": 64,
      "content": "<p style=\"font-size: 14px; color: #334155;\">Boundary rule: an action to run → MCP tool | process know-how → Skill | split roles → SubAgent<br />Compared with function calling, MCP wins by being a standard: wrap it once, works in any client</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#334155"
    }
  ],
  "animations": []
}
```
