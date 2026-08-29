---
type: slide
title: （场景标题）
---

## 讲稿

（第一段讲稿；一段 = 一个 speech 动作。讲到哪个画布元素，就加尾注 `@[元素id]`。）

（第二段讲稿 @[text_example]）

## 画布

```canvas
{
  "id": "slide_01",
  "viewportSize": 1000,
  "viewportRatio": 0.5625,
  "theme": {
    "backgroundColor": "#ffffff",
    "themeColors": ["#5b9bd5", "#ed7d31", "#a5a5a5", "#ffc000", "#4472c4"],
    "fontColor": "#333333",
    "fontName": "Microsoft YaHei",
    "outline": { "color": "#d14424", "width": 2, "style": "solid" },
    "shadow": { "h": 0, "v": 0, "blur": 10, "color": "#000000" }
  },
  "background": { "type": "background", "color": "#ffffff" },
  "elements": [
    {
      "id": "text_example",
      "type": "text",
      "left": 350,
      "top": 260,
      "width": 300,
      "height": 44,
      "content": "<p style=\"font-size: 24px; text-align: center; color: #333333;\">标题文本</p>",
      "defaultFontName": "Microsoft YaHei",
      "defaultColor": "#333333",
      "rotate": 0
    }
  ],
  "animations": []
}
```
