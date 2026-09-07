# 渲染契约细节 + T7+ 候选坐标 —— 版式权威已移至三层体系

> **本库已让位**（2026-09-07）：页型骨架的权威 = `references/design-system.md`
> §5（T1-T6 + C）；颜色/字体的权威 = `themes/<name>.json`（course.yaml
> `design.theme` 选包，缺省 platform）。旧"配方库+自配色"模式废弃——
> 逐页自配色是风格漂移的根因（design-system §1.3）。
>
> 本文件只保留两块仍有独立价值的资产：
> ① **文本框预算**（平台渲染契约的实施细则，check.mjs 按此估算）
> ② **T7+ 候选页型坐标**（00.Agent/03-mcp 课实测坐标缓存，未锚定；
>    使用时颜色一律走主题包 token，入库须按 design-system §9.3 声明变化点）

## 一、文本框预算（渲染契约细则——check.mjs L2 按此估算）

平台 `BaseTextElement` 的内容盒**四向内缩 10px**（预览同），`vAlign` 默认
`top`、`lineHeight` 默认 1.5。写字号/坐标时必须按"渲染后"算，不是按字形盒算：

- 高度 ≥ 行数 × 字号 × 行高 **+ 20**；宽度按 **width − 20** 估折行
  （CJK 字宽 ≈ 字号，ASCII ≈ 0.55 × 字号）——恰好塞满必然越界
- 单行标签/号牌/角注落在色块内：元素盒对齐背景卡（四边内缩 10-16px）+ 显式
  `"vAlign": "middle"`，**不要心算 top 居中**（平台默认顶对齐，心算必偏下）
- 相邻文本盒留 ≥8px 名义间隙（渲染整体下移 10px 后仍不相叠）
- 行盒高度速查（design-system §3）：18px 单行→48、16px→44、13px→40、
  12px→38；两行（18+13 lh1.4）→66；均含 10px×2 padding

**text content**：白名单 HTML（`<p style="font-size/color/text-align/…">`）；
多行要点用 `•` 或 `<br>` 分隔。字号阶梯（design-system §3 锁死）：
28 页标题 / 24 面板头·关键词 / 18-20 卡片小节题 / 14-16 正文 / 13 角注 /
12 副注 / 36 封面主标。**内容页字号天花板 32**（>32 即 check warning，
40+ 只属于封面）。

**页头三件套**（内容页公共骨架，坐标全课逐像素一致）：

```jsonc
{ "type": "text",  "left": 60, "top": 50,  "width": 880, "height": 62,  // 标题 28px
{ "type": "shape", "left": 70, "top": 116, "width": 80,  "height": 3,   // 下划线 $titleRule
{ "type": "text",  "left": 60, "top": 130, "width": 880, "height": 44,  // 副标 15px ≤18 字
```

正文区 y 190–508；T1 可 `generate.mjs skeleton <courseDir> T1 --spec …`
直接展开（主题色焙入）；其余页型按 design-system §5 解剖手写，
颜色 `$token` 写法由 `generate.mjs theme <file>` 落盘前解析。

## 二、T7+ 候选页型坐标（未锚定缓存）

以下来自 00.Agent/03-mcp 课实测，作为 design-system §9.3 候选页型的
坐标起点。**使用规则**：色值全部换成主题 token；先在 §5 注册表登记
（变化点+容量预算）再用于成课。

### cover-geometry · 封面几何（C 页型的坐标参考）
```
shape 出血大圆   (730,-140) 380×380   fill=$cover.deco[0]   ← 有意出血，唯一允许越界
shape 出血大圆   (-130,350) 340×340   fill=$cover.deco[0]
shape 顶部题线   (440,115) 120×3      fill=$titleRule.color
text  kicker     (350,130) 300×44     16px 居中 $cover.text.accent
text  主标题     (200,195) 600×74     36px 居中 $cover.text.title
shape 分隔线     (400,285) 200×3      fill=$titleRule.color
text  副标       (150,308) 700×50     20px 居中 $cover.text.muted
shape 标签底     (210,415) 580×50     fill=$cover.deco[3]
text  前置标签   (222,415) 556×50     13px 居中 $cover.text.title
```
（06-skill scenes/01 已按此几何 + platform 封面色落地，可作 C 锚参考。）

### cards-3 · 三栏卡片（T7 候选：三方案并列）
```
每栏 i=0,1,2：x = 60 + i*305，宽 273，高 240，y=205
shape 卡底 (x,205) 273×240  fill=$panel.bg（三栏同色；语义分化走 info/good/warn）
text  卡题 (x+20,230) 233×50  18-20px
text  卡文 (x+20,300) 233×92  14-16px，要点 "• " 逐行
```

### cards-4 · 四栏编号卡（T7 候选）
```
每栏 i=0..3：x = 60 + i*290，宽 200，高 295，y=200
shape 卡底 (x,200) 200×295 + shape 色头 (x,200) 200×56 + text 编号反白
+ text 卡题 (x+10,268) 180×47 18px + shape 短线 (x+60,322) 80×2 + text 卡文 14px
```

### grid-2x2 · 四象限（T10 矩阵候选）
```
卡 (60,185)(510,185)(60,345)(510,345) 430×110，标题+说明同框（<br> 或粗细分档）
```

### feature-cards · 左色条卡（T2 变体坐标）
```
卡 270×140：x=60/365/670（y=210）或 212/517（y=370 交错）
shape 卡底 + shape 左条 5×140 $panel.accentBar + text 题 18px + text 说明 14px
```

### table-compare · 表格对比（T8 数据表候选）
```
3 选择卡 y=130 高 160（同 cards-3）+ table (60,315) 880×~200
table: colWidths 均分，首行表头深主色反白，cell 14-16px
```

### process-3 · 号牌三步（T5 变体坐标）
```
每步 i=0,1,2：cx = 145 + i*220
shape 号牌 (cx,144) 50×50 $panel.accentBar + text 号码反白 20px
text 步骤名 (cx-85,204) 220×68 14px 居中；内容区 y=274 高 238
```

### image-hero · 图主文辅（T7 候选）
```
image 大图 (~24,96) ~952×371 + text 角标数字 28px 定位图上 + text 底部提示条 16px
```

### code-variants · 代码版式（T9 候选，03-mcp 实测）
code 元素：`{ "type": "code", "language": "…", "lines": [{"id":"L1","content":"…"}], "fontSize": N, "showLineNumbers": false }`
- **code-right**（步骤+代码）：左步骤卡 (60,170) 330 宽；右 code (410,168) 530×300 fs13 ≤12 行
- **code-compare**（正反对比）：双 code (60/510,168) 430×275 fs12；上方 ✕/✓ 标签；底部映射行 (60,455) 880×56
- **code-cards**（卡内嵌码）：cards-3 卡内 (卡x+15,y+50) 240×130 fs11 ≤5 行
- 代码行长度 ≤46 字符（不折行实测安全值）；code 元素渲染高度可能大于声明值，
  下方元素留 ≥24px 余量（check 对 code 是盲区，靠坐标自律）

## 三、生成规则（与 workflow-generate 配合）

1. 页头三件套必须有（C/image-hero 除外）；标题 = 大纲节标题的可读化。
2. 页型选择按 design-system §5；新页型先注册再使用（check 拒绝未登记 layout）。
3. 颜色一律 `$token` 或主题包色值；check 色板 lint 越界即 warning。
4. 卡片标题元素是 spotlight 主要目标——讲到一个要点加 `@[卡标题id]`；
   spotlight 引用的 id **原样保留**。
5. 元素 id 规范：`text_<slug>` / `shape_<slug>`（语义短词）。
6. chart 元素色取 `themeColors`，仅用于真数据。
7. 生成后必跑：`generate.mjs normalize <file>` →（若有 $token）`generate.mjs
   theme <file>` → `check.mjs <dir>`（0 error 才算完）。
