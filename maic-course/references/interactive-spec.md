# 交互页规范（interactive-spec）——HTML 即画布，消息即动画

interactive 场景 = 一份**自包含 HTML 文档**（iframe srcDoc 渲染）+ 讲稿时间轴上的
`widget_*` 动作驱动。平台**不注入任何监听运行时**——页面响应讲稿动作的部分必须由
页面自己实现，这是本规范存在的理由。

事实源：`@openmaic/dsl` 的 `interactive.d.ts` / `action.d.ts`；平台运行时
`components/scene-renderers/InteractiveIframeHost.tsx`、`lib/action/engine.ts`、
`lib/interactive/logical-viewport.ts`。**生成 interactive 场景前必读。**

## 1. 内容契约（InteractiveContent）

`## 内容` fence（语言标记 `content`），编译为 `content` **原样透传**（DSL 只做结构
guard，不做语义校验——契约合规全靠本规范 + 审查）：

```jsonc
{
  "type": "interactive",
  "html": "<!DOCTYPE html>…",   // 与 url 二选一；html 优先（srcDoc 渲染）
  "url": "https://…",           // 无 html 时的 fallback src；skill 生成一律用 html
  "widgetType": "simulation",   // 可选，六枚举之一
  "widgetConfig": { "type": "simulation", … }  // 除 type 外全部 widget 自有
}
```

- `html` 必须是**完整文档**（`<!DOCTYPE html>` 起、自包含所有 CSS/JS、无构建步骤）。
- `widgetType` 枚举与用途：`simulation` 仿真实验 / `diagram` 交互图解 / `code` 代码
  演练 / `game` 游戏化练习 / `visualization3d` 三维可视化 / `procedural-skill` 流程
  操作训练。选最贴切的；拿不准就省略（可选字段）。
- 页面内以注释文档化 state 形状与 target 命名（审查配对的依据，见 §6）。

## 2. 消息协议（讲稿时间轴 → 页面，唯一动画通道）

链路：讲稿 raw action → 播放引擎 → `iframe.contentWindow.postMessage({type,
...payload}, '*')`。四个动作各对应一个大写消息类型：

| DSL 动作（讲稿里写） | 页面收到的 `e.data.type` | payload 字段 |
|---|---|---|
| `widget_highlight` | `HIGHLIGHT_ELEMENT` | `target`, `content?` |
| `widget_setState` | `SET_WIDGET_STATE` | `state`, `content?` |
| `widget_annotation` | `ANNOTATE_ELEMENT` | `target`, `content?` |
| `widget_reveal` | `REVEAL_ELEMENT` | `target`, `content?` |

- `target` 是 **widget 自有语言**（推荐 CSS selector，如 `#result-panel`），课程文档
  不校验其存在——配对责任在页面（§6）。
- `state` 形状 widget 自有；页面应提供**单一入口** `applyState(state)`。
- 每条消息后引擎固定等待 **300ms**（`WIDGET_MS`）再进下一动作——页面的视觉响应
  应在此窗口内起步（CSS transition 尽量 ≤300ms 起效）。
- 讲稿侧写法（raw action 逃生通道，按出现位置插入时间轴）：

```markdown
## 讲稿

我们把温度调到 80，观察曲线怎么变化。

<!-- action
{ "type": "widget_setState", "state": { "temperature": 80 } }
-->
```

页面→父方向无需手写：平台自动注入错误上报 shim（`window.onerror` / 未捕获
rejection / `console.error` 都会上报编辑器）。编辑器另有 `element-picker:*`
消息，播放无关，可忽略。

## 3. 视口（与 slide 同契约：16:9 横屏）

交互页与 slide 共用同一画布契约：**16:9 横屏**（slide 为 `viewportSize:1000` /
`viewportRatio:0.5625`，即 1000×562.5）。不支持竖屏，页面按横屏创作。

页面有两个运行时，CSS 视口**比例相同、绝对尺寸不同**，因此布局仍须流式：

- **live 播放**：iframe 固定逻辑视口 **1280×720**（`GENUI_LOGICAL_*`，与 slide
  同比例、像素密度更高以保文字清晰）+ `transform: scale()` contain 居中于舞台槽。
- **视频导出**：iframe `100%×100%` 直接拉伸填满 16:9 导出画布（1280×720 /
  1920×1080 / 3840×2160）。

**页面硬性要求（生成时逐条自检）：**

1. 按 16:9 横屏创作：无横向滚动、无内容截断、所有交互目标可达。
2. 流式布局（flex/grid、相对单位、`clamp()`）；主体内容**禁止**固定像素绝对定位
   ——live 逻辑视口与导出画布的绝对像素不同（1280 vs 1920/3840），固定像素在
   导出画布上相对错位。
3. 设计基准取 **1280×720**（与 live 逻辑视口一致）。

## 4. 沙箱与安全约束

iframe `sandbox="allow-scripts allow-forms allow-popups"`，**故意无
`allow-same-origin`**（LLM 产出的 HTML 不得触碰宿主源）。后果：

- **null origin**：`localStorage`/`sessionStorage` 抛 SecurityError——平台注入了内存
  shim 兜底，但**重启即失**。禁止做持久化设计（存进度、记忆输入等）。
- 无 cookie、无父窗口/宿主 DOM 访问（访问即抛错）。
- 外链 CDN 允许，但**必须可降级**：库加载失败 = 后续脚本中止 = 白屏（错误会被
  上报，但课就坏了）。能用内联/自包含就不外链；图片优先 data URI。
- 首帧就要有可见内容——初始渲染依赖 JS 才出现的主体，容易被误判为坏页。

## 5. 页面骨架模板（生成器起步件）

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  /* 流式骨架（16:9 横屏，1280×720 基准；相对单位适配导出画布拉伸） */
  .stage { display: flex; gap: 4%; align-items: stretch; justify-content: center;
           height: 100%; padding: 4%; box-sizing: border-box; }
  .panel { flex: 1; border-radius: 12px; padding: 24px; }
  .is-hidden   { visibility: hidden; }              /* widget_reveal 目标：藏而不删 */
  .is-highlight{ outline: 4px solid #f59e0b; }      /* widget_highlight 效果 */
</style>
</head>
<body>
<main class="stage">
  <!-- state 形状：{ temperature: number }；target 命名：#sim-panel / #result-panel -->
  <section id="sim-panel" class="panel">…交互主体…</section>
  <section id="result-panel" class="panel is-hidden">…结论（讲稿揭示）…</section>
</main>
<script>
  // 讲稿时间轴 → 页面的唯一入口。平台不注入运行时，必须自带。
  var state = { temperature: 25 };
  function applyState(next) { Object.assign(state, next || {}); render(); }
  function render() { /* 由 state 重绘 #sim-panel */ }
  function flash(target) {
    var el = document.querySelector(target); if (!el) return;
    el.classList.add('is-highlight');
    setTimeout(function () { el.classList.remove('is-highlight'); }, 1200);
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    var el;
    switch (d.type) {
      case 'SET_WIDGET_STATE':  applyState(d.state); break;          // widget_setState
      case 'HIGHLIGHT_ELEMENT': flash(d.target); break;              // widget_highlight
      case 'ANNOTATE_ELEMENT':
        el = document.querySelector(d.target || '');
        if (el) el.setAttribute('data-note', d.content || '');       // 或自绘浮动标注
        break;
      case 'REVEAL_ELEMENT':
        el = document.querySelector(d.target || '');
        if (el) el.classList.remove('is-hidden');                     // widget_reveal
        break;
    }
  });
  render();  // 首帧即有内容
</script>
</body>
</html>
```

## 6. 编写范式：动作-监听配对

1. **先页面后讲稿**：HTML 先埋好带语义 id 的状态、隐藏层、可高亮元素；讲稿 raw
   action **只引用既有 id**，不发明页面里不存在的目标。
2. **配对自检**（生成器返回前必须过）：讲稿里每个 `widget_*` 的 `target` /
   `state` 键，在页面监听器或 DOM 里必须存在对应物；反向——页面不支持的消息类型
   不在讲稿里用。
3. 时长纪律不变：交互页也是课，讲稿预算照 `分钟 × 350 字 ±15%`；`widget_setState`
   之间留足讲解段（每条动作后引擎只等 300ms，其余时长靠 speech 填）。

## 7. 视频导出行为（静态冻结契约）

导出 MP4 时 interactive 页面被**完全静态化**（`lib/video-export-app/prepare-interactive-html.ts`）：
资源内联 → 等待 fonts/图片/视频就绪 → 静置 250ms → **冻结**（清 timer、patch 掉
`setTimeout/rAF`、暂停全部动画与媒体）。`widget_*` 动作在导出时间轴上只贡献 300ms
静止驻留（归为 markers，emitter 不渲染），**不会驱动页面**。

由此的设计硬约束：

1. **导出视频里的交互页 = load 瞬间的冻结帧**。首帧必须承载本页主要信息——依赖
   时间推进或用户交互才出现的内容，视频观众永远看不到。
2. **`widget_reveal` 的隐藏内容在导出视频中不可见**——被揭示的关键信息必须由
   讲稿口播兜底（讲稿本来就全量口播，通常天然满足；审查会核对）。
3. 冻结失败（资源加载失败、8s 就绪超时）⇒ 整页替换为 fallback 占位——又一层
   "必须可降级、少外链"的理由（§4）。

## 8. 校验与审查挂接

- `check.mjs` 对 interactive 内容**零校验**（透传）——本规范合规靠审查清单
  （`review-checklists.md` 的 I 系列，待加入）。
- `preview.mjs` 现状不渲染交互页（纯 slide 审片台）。抽检方法：从场景
  `## 内容` fence 提取 `html` 存成 `.html`，浏览器开 1280×720 窗口核对 §3
  硬性要求。
- 讲稿↔音频级联与普通场景一致（改讲稿 ⇒ 失配重配）。

## 9. 高频缺陷（生成时就避免，别等审查抓）

| 缺陷 | 后果 |
|---|---|
| 忘写 `message` 监听器 | 所有 widget_* 动作空放（最常见） |
| `target` / `state` 键与页面不配对 | 动作空放或 JS 报错 |
| 用 localStorage 做持久化 | null-origin 内存 shim，刷新即失 |
| 主体内容固定像素绝对定位 | live 1280 视口正常、导出画布上相对错位 |
| 主体依赖外链 CDN 无降级 | 加载失败 = 白屏 / 导出 fallback |
| 首帧依赖 JS 才有内容 | 被误判坏页（与白屏不可区分） |
| 关键信息只靠 `widget_reveal` 揭示 | 导出视频观众永远看不到（§7） |
