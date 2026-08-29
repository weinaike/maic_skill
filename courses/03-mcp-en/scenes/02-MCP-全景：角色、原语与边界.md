---
type: slide
title: MCP 全景：角色、原语与边界
---

## 讲稿

开始之前，先把地图看全。MCP 的世界里就三个角色：Host 是客户端，比如 Claude Code、WorkBuddy；Server 是工具提供方，也就是你写的程序；中间的 Client 是协议层，负责按 MCP 的规范传话。通信走 JSON-RPC，本地用 stdio，远程用 HTTP——这两句记住就行，细节不用背。 @[text_roles]

Server 能往外提供三样东西，我们叫三原语——从左往右看这三张卡。第一是 Tools，工具——可以被调用的函数，让 Agent 执行动作、拿回结果，这是最常用的。 @[text_card_tools]

第二是 Resources，资源——只读的数据，比如文件、数据库表、实验结果，按地址暴露出来给客户端读。第三是 Prompts，提示词模板——把常用的提问方式固化成参数化模板，用户一键套用。 @[text_card_res]

那什么时候该用 MCP？记住一条速记：要执行动作，做成 MCP 工具；要沉淀流程知识，写成 Skill；要多个角色分工协作，用 SubAgent——这三件套各管一摊，别混着用。 @[text_boundary]

可能有同学问：这和传统的 function calling 有什么区别？区别就在"标准"两个字——function calling 绑定在某一家模型上，而 MCP 是客户端无关的：你封装一次，Claude Code 能用，其他支持 MCP 的客户端也都能用。这就是它值得学的原因。

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
      "content": "<p style=\"font-size: 28px; color: #1f2937;\">MCP 全景：角色、原语与边界</p>",
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
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">先把地图看全：谁在通信、传什么、和我们已有知识的关系</p>",
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
      "content": "<p style=\"font-size: 14px; text-align: center; color: #475569;\">Host（客户端，如 Claude Code）── Client（协议层）── Server（工具提供方）</p>",
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
      "content": "<p style=\"font-size: 20px; color: #1e3a5f;\">Tools · 工具</p>",
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
      "content": "<p style=\"font-size: 15px; color: #475569;\">• 可调用的函数<br />• 让 Agent 执行动作并拿回结果<br />• 例：检索文献、下载 PDF、跑清洗脚本</p>",
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
      "content": "<p style=\"font-size: 20px; color: #065f46;\">Resources · 资源</p>",
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
      "content": "<p style=\"font-size: 15px; color: #475569;\">• 只读数据，按 URI 暴露<br />• 例：文件、数据库表、实验结果<br />• 客户端按地址读取</p>",
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
      "content": "<p style=\"font-size: 20px; color: #9a3412;\">Prompts · 提示词模板</p>",
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
      "content": "<p style=\"font-size: 15px; color: #475569;\">• 参数化的提问模板<br />• 例：论文评审提纲、周报框架<br />• 用户一键套用</p>",
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
      "content": "<p style=\"font-size: 14px; color: #334155;\">边界速记：要执行动作 → MCP 工具｜要流程知识 → Skill｜要分身协作 → SubAgent<br />相比 function calling，MCP 赢在标准化——一次封装，任意客户端可用</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#334155"
    }
  ],
  "animations": []
}
```
