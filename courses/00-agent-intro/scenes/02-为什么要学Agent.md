---
type: slide
title: 为什么要学Agent
---

## 讲稿

好，我们正式进入第一个话题——为什么要学 Agent？这个问题其实很简单，但很关键。我们来看三个方面的现状。 @[text_oCy_P7tW]

第一点，AI 工具已经全面普及了。像 Claude Code、Cursor 这样的编程 Agent，发展速度非常快。日常科研中，用 AI 聊天来辅助工作，已经成为很多人的习惯。 @[text_pevseUO0]

第二点，科研中的应用场景非常广泛。不管你是哪个学科方向，基本都会用到这几类工作。 @[text_UFMFMl7_]

代码编写与调试、文献检索与分析、数据清洗与处理——这三件事，几乎覆盖了科研人员日常工作的核心环节。AI 在这些场景中的价值是实实在在的。 @[text_qMVpwTL6]

但这里有一个核心矛盾，也是我们这门课要解决的关键问题。 @[text_UCL_LrtG]

工具封装得越来越完善，点点按钮就能用。但正因如此，我们很难理解底层到底发生了什么。一旦遇到非标准化的需求——比如你的研究流程比较特殊，或者需要把多个步骤串联起来——你会发现，不掌握底层原理，就没办法做定制化的应用。这恰恰是我们这门课的核心目标：理解Agent的组成和内部的工作机制，能够实现定制化应用。这也是我们接下来所有内容的出发点。 @[text_dhcwcfXY]

## 画布

```canvas
{
  "id": "qIcaLObguhnWcMwXXFfle",
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
      "id": "text_oCy_P7tW",
      "type": "text",
      "left": 60,
      "top": 50,
      "width": 880,
      "height": 62,
      "content": "<p style=\"font-size: 28px;\"><strong>为什么要学 Agent</strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1e3a5f",
      "rotate": 0
    },
    {
      "id": "text_nxJfTo7E",
      "type": "text",
      "left": 60,
      "top": 125,
      "width": 880,
      "height": 44,
      "content": "<p style=\"font-size: 14px; color: #6b7280;\">理解底层原理 · 实现定制化应用</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#6b7280",
      "rotate": 0
    },
    {
      "id": "shape_vIBffCm8",
      "type": "shape",
      "left": 70,
      "top": 180,
      "width": 860,
      "height": 2,
      "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#5b9bd5",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "shape_ZVtICLbw",
      "type": "shape",
      "left": 60,
      "top": 205,
      "width": 273,
      "height": 240,
      "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#e8f1fb",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "text_pevseUO0",
      "type": "text",
      "left": 80,
      "top": 230,
      "width": 233,
      "height": 50,
      "content": "<p style=\"font-size: 20px;\"><strong>① AI 工具普及</strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#1a56c4",
      "rotate": 0
    },
    {
      "id": "text_kJxuwg61",
      "type": "text",
      "left": 80,
      "top": 300,
      "width": 233,
      "height": 92,
      "content": "<p style=\"font-size: 16px;\">• Claude Code · Cursor</p><p style=\"font-size: 16px;\">• 编程 Agent 快速普及</p><p style=\"font-size: 16px;\">• AI 聊天：科研日常</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#374151",
      "rotate": 0
    },
    {
      "id": "shape_PszcUyFN",
      "type": "shape",
      "left": 363,
      "top": 205,
      "width": 274,
      "height": 240,
      "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#ecfdf5",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "text_UFMFMl7_",
      "type": "text",
      "left": 383,
      "top": 230,
      "width": 234,
      "height": 50,
      "content": "<p style=\"font-size: 20px;\"><strong>② 科研应用广泛</strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#047857",
      "rotate": 0
    },
    {
      "id": "text_qMVpwTL6",
      "type": "text",
      "left": 383,
      "top": 300,
      "width": 234,
      "height": 92,
      "content": "<p style=\"font-size: 16px;\">• 代码编写与调试</p><p style=\"font-size: 16px;\">• 文献检索与分析</p><p style=\"font-size: 16px;\">• 数据清洗与处理</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#374151",
      "rotate": 0
    },
    {
      "id": "shape_l3FD7Qm1",
      "type": "shape",
      "left": 667,
      "top": 205,
      "width": 273,
      "height": 240,
      "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "viewBox": [
        1,
        1
      ],
      "fill": "#fff7ed",
      "fixedRatio": false,
      "rotate": 0
    },
    {
      "id": "text_UCL_LrtG",
      "type": "text",
      "left": 687,
      "top": 230,
      "width": 233,
      "height": 50,
      "content": "<p style=\"font-size: 20px;\"><strong>③ 核心矛盾</strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#c2410c",
      "rotate": 0
    },
    {
      "id": "text_dhcwcfXY",
      "type": "text",
      "left": 687,
      "top": 300,
      "width": 233,
      "height": 92,
      "content": "<p style=\"font-size: 16px;\">• 工具封装完善</p><p style=\"font-size: 16px;\">• 缺乏底层理解</p><p style=\"font-size: 16px; color: #c2410c;\"><strong>→ 无法定制化使用</strong></p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#374151",
      "rotate": 0
    }
  ],
  "background": {
    "type": "solid",
    "color": "#ffffff"
  }
}
```
