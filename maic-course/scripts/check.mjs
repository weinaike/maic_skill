#!/usr/bin/env node
/**
 * check.mjs — three-layer validation of a course project, run standalone or
 * as build's gate.
 *
 *   L1  DSL contract     vendored @openmaic/dsl: validateScene (hydrated),
 *                        validateAction per action, validatePBLContent
 *                        (+ PBL v2 gating: projectV2 required, legacy
 *                        projectConfig forbidden on newly generated courses).
 *   L2  Document lint    cross-reference integrity the DSL cannot see:
 *                        audioRef ↔ audio/ files, spotlight.elementId ↔ canvas
 *                        elements, mediaIndex ↔ files, canvas HTML whitelist,
 *                        geometry bounds, text-box budget (platform 10px inner
 *                        padding / lh 1.5), text-on-text overlap, density lint,
 *                        lock orphans.
 *   L3  Import rehearsal a faithful replay of what the platform's
 *                        use-import-classroom will accept/reject.
 *
 * Usage:
 *   node scripts/check.mjs <courseDir> [--quiet]
 *
 * Exit code 1 when any error-severity finding exists.
 */
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from './lib/course.mjs';
import { compileCourse } from './compile.mjs';
import { loadDsl, loadConfig } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';

/** @typedef {{ layer: 'L1'|'L2'|'L3', severity: 'error'|'warning'|'info', location: string, message: string }} Finding */

const isMain = isMainModule(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Tags / style properties observed in real platform exports (calibrated on the 00.Agent sample). */
const HTML_TAG_ALLOWLIST = new Set(['p', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'sub', 'sup']);
const STYLE_PROP_ALLOWLIST = new Set([
  'font-size', 'text-align', 'color', 'text-decoration', 'font-weight', 'font-family',
  'line-height', 'letter-spacing', 'text-indent', 'background-color', 'margin', 'margin-top',
  'margin-bottom', 'padding', 'padding-top', 'padding-bottom',
]);

const VIEWPORT_W = 1000;
const VIEWPORT_H = 562.5;

// ---- 设计体系（references/design-system.md）：主题包 + 页型骨架 ----

/** 页型注册表（§5；C=封面母题（L1 管），T7+ 按 §9.3 入库条件扩这里 + 同步规范表）。 */
const LAYOUT_REGISTRY = new Set(['C', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6']);

/**
 * 每页型容量预算（§5 表 + 2 字容差；只声明可机械校验的维度）。
 * pageChars: [min,max] 全页可见加权字数（CJK=1 / ASCII=0.55）——下限抓
 *       "空转页"（大字口号占版面、没装内容），上限防满屏字。
 *       区间取自平台三课 38 页实测（中位 145，区间 105-246）。
 * rows: [min,max] **每侧**两行行元素数（18px 题 + 13px 副的 <br> 模式，
 *       T1 双面板按 left<500 / ≥500 分侧计数）
 * rowTitle/rowSub: 行元素首行/副行字数上限
 * fontCeiling: 内容页非页标题字号上限（>32 warning；封面 C 豁免）——
 *       平台内容页实测 28-36 无 40+，"大字主角"已废（design-system §5）
 */
const LAYOUT_BUDGETS = {
  C:  { pageChars: [60, 160] },
  T1: { pageChars: [110, 240], rows: [2, 4], rowTitle: 14, rowSub: 24 },
  T2: { pageChars: [130, 260], rows: [4, 6], rowTitle: 14, rowSub: 28 },
  T3: { pageChars: [110, 160], bigLine: 18 },
  T4: { pageChars: [110, 250], rowTitle: 16 },
  T5: { pageChars: [130, 220] },
  T6: { pageChars: [130, 220] },
};

/** 语义字段（纯文字说明，里面出现的 #hex 是禁用例不是色板成员）。 */
const PROSE_KEYS = new Set(['forbidden', 'rules', '$comment', 'name', 'style']);

/** 递归收集主题包内全部色值——主题文件本身就是合法色板（§4）。 */
function collectPaletteHex(node, key = '') {
  const out = [];
  if (PROSE_KEYS.has(key)) return out;
  if (typeof node === 'string') {
    for (const m of node.matchAll(/#[0-9a-fA-F]{3,8}/g)) out.push(normHex(m[0]));
  } else if (Array.isArray(node)) {
    for (const v of node) out.push(...collectPaletteHex(v, key));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) out.push(...collectPaletteHex(v, k));
  }
  return out;
}

/** #RGB → #RRGGBB 小写；带 alpha 截前 6 位。 */
function normHex(h) {
  const s = h.toLowerCase().replace('#', '');
  const full = s.length === 3 ? [...s].map((c) => c + c).join('') : s.slice(0, 6);
  return '#' + full;
}

/**
 * Run all three layers against a compiled manifest + its source project.
 * @param {import('./lib/course.mjs').CourseProject} project
 * @param {Record<string, unknown>} manifest
 * @param {{ audioMisses: { scene: string, text: string }[] }} notes
 * @returns {Promise<Finding[]>}
 */
export async function checkCourse(project, manifest, notes) {
  /** @type {Finding[]} */
  const findings = [];
  const dsl = await loadDsl();
  const scenes = /** @type {any[]} */ (manifest['scenes']);

  // ---------------------------------------------------------------- L1: DSL
  scenes.forEach((scene, index) => {
    const where = `scenes[${index}] ${scene.title ?? ''}`;
    // Hydrate to the full Scene shape the validator expects (manifest scenes
    // carry no id/stageId — the platform mints fresh ones on import).
    const hydrated = {
      id: `check_${index}`,
      stageId: 'check_stage',
      title: scene.title ?? '',
      order: scene.order ?? index,
      type: scene.type,
      content: scene.content,
      ...(scene.actions ? { actions: scene.actions } : {}),
      ...(scene.whiteboards ? { whiteboards: scene.whiteboards } : {}),
    };
    const result = dsl.validateScene(hydrated);
    if (!result.valid) {
      for (const err of result.errors) {
        findings.push({ layer: 'L1', severity: 'error', location: where, message: `${err.path || '/'}: ${err.message}` });
      }
    }
    for (const action of scene.actions ?? []) {
      const r = dsl.validateAction(action);
      if (!r.valid) {
        for (const err of r.errors) {
          findings.push({ layer: 'L1', severity: 'error', location: `${where} action ${action.type}`, message: `${err.path || '/'}: ${err.message}` });
        }
      }
    }
    if (scene.type === 'pbl' && scene.content) {
      const r = dsl.validatePBLContent(scene.content);
      if (!r.valid) {
        for (const err of r.errors) {
          findings.push({ layer: 'L1', severity: 'error', location: `${where} pbl content`, message: `${err.path || '/'}: ${err.message}` });
        }
      }
      // PBL v2 协议规则：validatePBLContent 只在 projectV2 存在时才校验其结构，
      // 对"缺 projectV2 / 只写 legacy projectConfig"的退化产物是放行的——
      // 平台 #1058 后 projectConfig 已只读，生成侧必须落在 projectV2 上。
      if (scene.content.projectV2 === undefined) {
        findings.push({ layer: 'L1', severity: 'error', location: `${where} pbl content`, message: 'pbl content 缺少 projectV2 —— 平台 v2 协议以 projectV2 为准，DSL 校验对空 content 放行属兼容旧档，新产物不允许' });
      }
      if (scene.content.projectConfig !== undefined) {
        findings.push({ layer: 'L1', severity: 'error', location: `${where} pbl content`, message: 'pbl content 不应携带 projectConfig —— legacy v1 镜像（平台 #1058 后只读历史），新课程只写 projectV2' });
      }
    }
    // ---- 渲染保真规则（player 契约；三类历史 bug 的固化） ----
    const canvas = scene.type === 'slide' ? scene.content?.canvas : undefined;
    const bg = canvas?.background;
    if (bg && !['solid', 'image', 'gradient'].includes(bg.type)) {
      findings.push({ layer: 'L1', severity: 'error', location: `${where} canvas.background`, message: `background.type "${bg.type}" 不在枚举 solid|image|gradient —— 平台渲染器对未知类型一律回落白色（预览则照画 color，两边分叉）` });
    }
    for (const el of canvas?.elements ?? []) {
      if (el.type !== 'shape') continue;
      if ('line' in el) {
        findings.push({ layer: 'L1', severity: 'error', location: `${where} shape ${el.id}`, message: `shape 描边字段应为 outline（player 读 elementInfo.outline，line 是非法属性且被忽略）` });
      }
      const label = String(el.shape ?? '');
      const d = String(el.path ?? '');
      if ((label === 'ellipse' || label === 'circle') && d && !/[Aa]/.test(d)) {
        findings.push({ layer: 'L1', severity: 'warning', location: `${where} shape ${el.id}`, message: `shape 标注为 ${label} 但 path 无弧线命令（A）——平台按 path 画会变成方形，预览若按标签画圆则两边分叉` });
      }
      if (label === 'roundRect' && d && !/Q/.test(d)) {
        findings.push({ layer: 'L1', severity: 'warning', location: `${where} shape ${el.id}`, message: `shape 标注为 roundRect 但 path 无 Q 曲线——平台按 path 画会是直角` });
      }
    }
  });

  // ---------------------------------------------------------------- L2: lint
  // audioRef ↔ files
  for (const miss of notes.audioMisses) {
    findings.push({ layer: 'L2', severity: 'warning', location: miss.scene, message: `speech without synthesized audio (voice module pending): "${miss.text}…"` });
  }
  for (const scene of scenes) {
    const where = `scenes[${scene.order ?? '?'}] ${scene.title ?? ''}`;
    const elementIds = new Set(
      (scene.content?.canvas?.elements ?? []).map((/** @type {any} */ el) => String(el.id ?? '')),
    );
    for (const action of scene.actions ?? []) {
      if (action.type === 'spotlight') {
        if (!elementIds.has(String(action.elementId ?? ''))) {
          findings.push({ layer: 'L2', severity: 'error', location: where, message: `spotlight targets missing canvas element "${action.elementId}"` });
        }
      }
      if (action.type === 'speech' && typeof action.audioRef === 'string') {
        const local = action.audioRef.replace(/^audio\//, '');
        if (!project.audioFiles.has(local)) {
          findings.push({ layer: 'L2', severity: 'error', location: where, message: `audioRef "${action.audioRef}" has no file in audio/` });
        }
      }
    }
    // canvas hygiene
    const canvas = scene.content?.canvas;
    if (scene.type === 'slide') {
      if (!canvas) {
        findings.push({ layer: 'L2', severity: 'error', location: where, message: 'slide scene without 画布 canvas' });
      } else {
        lintCanvas(canvas, where, findings);
      }
    }
    if (scene.type === 'quiz') {
      const questions = scene.content?.questions ?? [];
      if (questions.length === 0) {
        findings.push({ layer: 'L2', severity: 'error', location: where, message: 'quiz scene with zero questions' });
      }
      questions.forEach((/** @type {any} */ q, /** @type {number} */ qi) => {
        if (q.type === 'short_answer') return;
        if (!Array.isArray(q.options) || q.options.length < 2) {
          findings.push({ layer: 'L2', severity: 'error', location: `${where} q${qi}`, message: 'choice question needs ≥2 options' });
        }
        if (q.hasAnswer !== false && (!Array.isArray(q.answer) || q.answer.length === 0)) {
          findings.push({ layer: 'L2', severity: 'warning', location: `${where} q${qi}`, message: 'question has no answer recorded' });
        }
      });
    }
  }
  // voice.lock orphans
  for (const [key, entry] of Object.entries(project.voiceLock)) {
    if (key.startsWith('orphan:')) {
      findings.push({ layer: 'L2', severity: 'info', location: 'voice.lock.yaml', message: `orphan audio not referenced by any speech: ${entry['file']}` });
    }
  }
  // media naming convention: media/<stem> should match an image element id
  const allElementIds = new Set();
  for (const scene of scenes) {
    for (const el of scene.content?.canvas?.elements ?? []) allElementIds.add(String(el.id ?? ''));
  }
  for (const ref of Object.keys(manifest['mediaIndex'] ?? {})) {
    if (!ref.startsWith('media/')) continue;
    const stem = ref.split('/').pop()?.replace(/\.\w+$/, '') ?? '';
    if (!allElementIds.has(stem)) {
      findings.push({ layer: 'L2', severity: 'warning', location: ref, message: 'media file stem matches no canvas element id — the platform import keys generated media by element id' });
    }
  }

  // ---- 主题色板 lint（design-system.md §6：风格自由只发生在选/建主题时）----
  const themeName = String(project.course?.['design']?.['theme'] ?? 'platform');
  const themePath = path.join(SKILL_DIR, 'themes', `${themeName}.json`);
  if (!existsSync(themePath)) {
    findings.push({ layer: 'L2', severity: 'error', location: `themes/${themeName}.json`, message: `主题包缺失（course.yaml design.theme="${themeName}"）——无色板即无一致性基准` });
  } else {
    const palette = new Set(collectPaletteHex(JSON.parse(readFileSync(themePath, 'utf8'))));
    scenes.forEach((scene, index) => {
      const canvas = scene.content?.canvas;
      if (scene.type !== 'slide' || !canvas) return;
      const where = `scenes[${index}] ${scene.title ?? ''}`;
      const used = new Set([...JSON.stringify(canvas).matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => normHex(m[0])));
      const off = [...used].filter((c) => !palette.has(c));
      if (off.length) {
        findings.push({ layer: 'L2', severity: 'warning', location: `${where} canvas`, message: `色值越出 ${themeName} 主题色板：${off.join(' ')}——换肤只许选/建主题包（§6），逐页不许自配色` });
      }
    });
  }

  // ---- 页型 lint（design-system.md §5：layout 身份 + 容量预算 + 连续同型）----
  lintLayouts(project, scenes, findings);

  // ---------------------------------------------------------------- L3: import rehearsal
  const stage = manifest['stage'];
  if (!stage || typeof stage !== 'object') findings.push({ layer: 'L3', severity: 'error', location: 'manifest', message: 'manifest.stage missing — platform import rejects' });
  else {
    if (typeof stage['name'] !== 'string' || !stage['name']) findings.push({ layer: 'L3', severity: 'error', location: 'manifest.stage', message: 'stage.name missing' });
    if (typeof stage['createdAt'] !== 'number' || typeof stage['updatedAt'] !== 'number') {
      findings.push({ layer: 'L3', severity: 'warning', location: 'manifest.stage', message: 'createdAt/updatedAt should be epoch ms' });
    }
  }
  if (!Array.isArray(manifest['scenes'])) findings.push({ layer: 'L3', severity: 'error', location: 'manifest', message: 'manifest.scenes must be an array' });
  // every mediaIndex key must resolve to a staged file
  for (const ref of Object.keys(manifest['mediaIndex'] ?? {})) {
    const local = ref.replace(/^(audio|media)\//, '');
    const dir = ref.startsWith('audio/') ? project.audioFiles : project.mediaFiles;
    if (!dir.has(local)) {
      findings.push({ layer: 'L3', severity: 'error', location: `mediaIndex ${ref}`, message: 'key has no matching file in the course project' });
    }
  }
  // every speech audioRef must be a mediaIndex audio key (the import rewrites
  // refs→ids only for mediaIndex audio entries)
  const audioKeys = new Set(
    Object.entries(manifest['mediaIndex'] ?? {})
      .filter(([, e]) => e.type === 'audio')
      .map(([k]) => k),
  );
  for (const scene of scenes) {
    for (const action of scene.actions ?? []) {
      if (action.type === 'speech' && action.audioRef && !audioKeys.has(action.audioRef)) {
        findings.push({ layer: 'L3', severity: 'error', location: `scenes[${scene.order}] ${scene.title}`, message: `speech audioRef "${action.audioRef}" absent from mediaIndex — import would drop the audio binding` });
      }
    }
  }
  // agent roster shape
  (manifest['agents'] ?? []).forEach((/** @type {any} */ agent, /** @type {number} */ i) => {
    for (const field of ['name', 'role', 'persona', 'avatar', 'color']) {
      if (typeof agent[field] !== 'string' || !agent[field]) {
        findings.push({ layer: 'L3', severity: 'error', location: `agents[${i}]`, message: `agent missing "${field}"` });
      }
    }
    if (typeof agent.priority !== 'number') {
      findings.push({ layer: 'L3', severity: 'warning', location: `agents[${i}]`, message: 'agent missing numeric priority' });
    }
  });
  // scene type ↔ content binding
  scenes.forEach((scene, i) => {
    if (!scene.type || !scene.content || scene.content.type !== scene.type) {
      findings.push({ layer: 'L3', severity: 'error', location: `scenes[${i}]`, message: `scene type "${scene.type}" disagrees with content.type "${scene.content?.type}"` });
    }
  });
  return findings;
}

/**
 * Canvas hygiene: HTML allowlist + geometry bounds + text-box budget +
 * text-on-text overlap + density lint.
 * @param {any} canvas
 * @param {string} where
 * @param {Finding[]} findings
 */
function lintCanvas(canvas, where, findings) {
  for (const el of canvas.elements ?? []) {
    const elWhere = `${where} ${el.type} ${el.id ?? '?'}`;
    if (el.type === 'text' && typeof el.content === 'string') {
      for (const tag of el.content.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)) {
        if (!HTML_TAG_ALLOWLIST.has(tag[1].toLowerCase())) {
          findings.push({ layer: 'L2', severity: 'warning', location: elWhere, message: `HTML tag <${tag[1]}> outside the render allowlist` });
        }
      }
      for (const attr of el.content.matchAll(/\son\w+\s*=|javascript:/gi)) {
        findings.push({ layer: 'L2', severity: 'error', location: elWhere, message: `unsafe markup in text content: ${attr[0]}` });
      }
      for (const style of el.content.matchAll(/style="([^"]*)"/g)) {
        for (const prop of style[1].matchAll(/([\w-]+)\s*:/g)) {
          if (!STYLE_PROP_ALLOWLIST.has(prop[1].toLowerCase())) {
            findings.push({ layer: 'L2', severity: 'warning', location: elWhere, message: `style property "${prop[1]}" outside the render allowlist` });
          }
        }
      }
      // ---- 文本框预算（平台渲染契约固化；06-skill 课教训） ----
      // BaseTextElement 内容盒四向内缩 10px、vAlign 默认 top、lineHeight 默认 1.5：
      // 高度必须 ≥ 行数×字号×行高 + 20，折行按 width−20 估。
      if (typeof el.height === 'number' && typeof el.width === 'number') {
        const { need, detail } = estimateTextNeed(el);
        if (need > el.height + 10) {
          findings.push({ layer: 'L2', severity: 'error', location: elWhere, message: `文本预算 ≈${need}px 超出盒高 ${el.height}px（${detail}）——平台内容盒四向内缩 10px/行高默认 1.5，按 行数×字号×行高+20 重算并放大高度或缩减文案` });
        } else if (need > el.height + 2) {
          findings.push({ layer: 'L2', severity: 'warning', location: elWhere, message: `文本预算 ≈${need}px 贴近盒高 ${el.height}px（${detail}）——零余量，字重/字体回退即越界` });
        }
      }
    }
    if (typeof el.left === 'number' && typeof el.top === 'number') {
      const w = typeof el.width === 'number' ? el.width : 0;
      const h = typeof el.height === 'number' ? el.height : 0;
      if (el.left < 0 || el.top < 0 || el.left + w > VIEWPORT_W + 5 || el.top + h > VIEWPORT_H + 5) {
        findings.push({ layer: 'L2', severity: 'warning', location: elWhere, message: `element box (${el.left},${el.top},${w}×${h}) outside the ${VIEWPORT_W}×${VIEWPORT_H} canvas` });
      }
    }
  }
  // text-on-text 字形域相交：盒相交不等于字叠（宽盒留白是人类排版的常态，
  // 00.Agent 样例即有盒叠字不叠）；按渲染契约估字形实际覆盖域判真叠。
  const textBoxes = (canvas.elements ?? []).filter(
    (/** @type {any} */ el) => el.type === 'text' &&
      typeof el.left === 'number' && typeof el.top === 'number' &&
      typeof el.width === 'number' && typeof el.height === 'number',
  );
  const glyphRects = textBoxes.map((/** @type {any} */ el) => ({ el, g: glyphRectOf(el) }));
  for (let i = 0; i < glyphRects.length; i++) {
    for (let j = i + 1; j < glyphRects.length; j++) {
      const { el: a, g: ga } = glyphRects[i];
      const { el: b, g: gb } = glyphRects[j];
      const ix = Math.min(ga.x2, gb.x2) - Math.max(ga.x1, gb.x1);
      const iy = Math.min(ga.y2, gb.y2) - Math.max(ga.y1, gb.y1);
      if (ix > 2 && iy > 2) {
        findings.push({ layer: 'L2', severity: 'error', location: `${where} text ${a.id} × text ${b.id}`, message: `两 text 元素字形域相交（${Math.round(ix)}×${Math.round(iy)}px）——渲染后文字相叠；错开坐标或压缩文案宽度` });
      }
    }
  }
  // 密度预算：信息过载是版式事故的放大器（06-skill §9/§10 教训）
  const nText = textBoxes.length;
  const nAll = (canvas.elements ?? []).length;
  if (nText > 20 || nAll > 36) {
    findings.push({ layer: 'L2', severity: 'warning', location: `${where} canvas`, message: `单页密度超预算（text ${nText}/总 ${nAll}，上限 20/36）——回大纲减要点或拆主张，勿靠缩盒距硬塞` });
  }
}

/**
 * 页型 lint（design-system.md §5）：场景 frontmatter `layout` 身份校验 +
 * 按页型容量预算分档 + 连续同型节奏检查。project.scenes 与 manifest scenes
 * 同序（compile.mjs 按 scenes 顺序生成 manifest）。
 * @param {import('./lib/course.mjs').CourseProject} project
 * @param {any[]} scenes
 * @param {Finding[]} findings
 */
function lintLayouts(project, scenes, findings) {
  const layouts = project.scenes.map((s) => {
    const v = s.frontmatter?.['layout'];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  });
  layouts.forEach((layout, index) => {
    const scene = scenes[index];
    if (!scene || scene.type !== 'slide') return;
    const where = `scenes[${index}] ${scene.title ?? ''}`;
    if (!layout) {
      findings.push({ layer: 'L2', severity: 'info', location: where, message: 'slide 场景未标 frontmatter layout（T1-T6）——全课打标后此项升为 error' });
      return;
    }
    if (!LAYOUT_REGISTRY.has(layout)) {
      findings.push({ layer: 'L2', severity: 'error', location: where, message: `页型 "${layout}" 未登记（注册表 T1-T6；新页型按 design-system.md §9.3 入库条件先注册再使用）` });
      return;
    }
    lintLayoutBudget(layout, scene.content?.canvas, where, findings);
  });
  // 连续 ≥3 页同页型（§5 节奏交替：同构图三连页观感疲劳）；未标页/非 slide 打断
  let runLayout = null, runStart = 0, runEnd = -1;
  const pushRun = () => {
    if (runLayout === null || runEnd - runStart + 1 < 3) return;
    findings.push({ layer: 'L2', severity: 'warning', location: `scenes[${runStart}-${runEnd}]`, message: `连续 ${runEnd - runStart + 1} 页同页型 ${runLayout}——插入过渡/结论页交替节奏（§5）` });
  };
  layouts.forEach((layout, index) => {
    const scene = scenes[index];
    const cur = scene?.type === 'slide' && layout ? layout : null;
    if (cur !== null && cur === runLayout) {
      runEnd = index;
    } else {
      pushRun();
      runLayout = cur;
      runStart = runEnd = index;
    }
  });
  pushRun();
}

/**
 * 单页型容量预算（§5 表）：全页字数 / 两行行元素数 / 行首·副行字数 / 大字结论。
 * @param {string} layout
 * @param {any} canvas
 * @param {string} where
 * @param {Finding[]} findings
 */
function lintLayoutBudget(layout, canvas, where, findings) {
  if (!canvas) return;
  const budget = LAYOUT_BUDGETS[layout];
  if (!budget) return;
  const texts = (canvas.elements ?? []).filter(
    (/** @type {any} */ el) => el.type === 'text' && typeof el.content === 'string',
  );
  const chars = texts.reduce((sum, el) => sum + visibleChars(el.content), 0);
  const [minChars, maxChars] = budget.pageChars;
  if (chars > maxChars) {
    findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}]`, message: `全页字数 ≈${Math.round(chars)} 超页型预算 ${maxChars}（§5 容量预算）——回大纲减要点或拆页，勿缩字号硬塞` });
  }
  if (chars < minChars) {
    findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}]`, message: `全页字数 ≈${Math.round(chars)} 低于页型下限 ${minChars}——空转页（大字口号占版面没装内容）；副行写命令/判据/参数，向平台中位 145 字靠拢` });
  }
  // 内容页字号天花板（C 豁免；平台实测 28-36，40+ 是发布会美学）
  if (layout !== 'C') {
    for (const el of texts) {
      const fss = [...String(el.content).matchAll(/font-size:\s*([\d.]+)px/gi)].map((m) => Number(m[1]));
      if (fss.length && Math.max(...fss) > 32) {
        findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}] text ${el.id}`, message: `字号 ${Math.max(...fss)}px 超内容页天花板 32——视觉锚靠结构（面积/位置/色），不靠字号；40+ 只属于封面` });
      }
    }
  }
  if (budget.rows) {
    const rows = texts.filter((el) => isRowElement(el.content));
    if (layout === 'T1') {
      // 双面板分侧计数（§5"行 2-4"指每侧）
      for (const [side, pick] of [['L', (el) => el.left < 500], ['R', (el) => el.left >= 500]]) {
        const n = rows.filter(pick).length;
        if (n && (n < budget.rows[0] || n > budget.rows[1])) {
          findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}] ${side} 侧`, message: `行元素 ${n} 个，页型预算 ${budget.rows[0]}-${budget.rows[1]} 行/侧（§5）` });
        }
      }
    } else if (rows.length < budget.rows[0] || rows.length > budget.rows[1]) {
      findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}]`, message: `行元素 ${rows.length} 个，页型预算 ${budget.rows[0]}-${budget.rows[1]} 行（§5）` });
    }
    for (const el of rows) {
      const { head, sub } = rowCharSplit(el.content);
      if (head > (budget.rowTitle ?? Infinity)) {
        findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}] text ${el.id}`, message: `行首行 ≈${Math.round(head)} 字超预算 ${budget.rowTitle}——行题收短语，细节进副行/讲稿` });
      }
      if (sub > (budget.rowSub ?? Infinity)) {
        findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}] text ${el.id}`, message: `行副行 ≈${Math.round(sub)} 字超预算 ${budget.rowSub}——副行是注脚不是句子` });
      }
    }
  }
  if (budget.bigLine !== undefined) {
    for (const el of texts) {
      const fss = [...String(el.content).matchAll(/font-size:\s*([\d.]+)px/gi)].map((m) => Number(m[1]));
      if (fss.length && Math.max(...fss) >= 30 && visibleChars(el.content) > budget.bigLine) {
        findings.push({ layer: 'L2', severity: 'warning', location: `${where} [${layout}] text ${el.id}`, message: `大字结论 ≈${Math.round(visibleChars(el.content))} 字超预算 ${budget.bigLine}——结论是短语不是句子` });
      }
    }
  }
}

/** 两行行元素：含 <br> 且混排字号（≥16 题 + ≤14 副的行语法）。 */
function isRowElement(content) {
  if (!/<br\s*\/?>/i.test(String(content))) return false;
  const fss = [...String(content).matchAll(/font-size:\s*([\d.]+)px/gi)].map((m) => Number(m[1]));
  if (fss.length < 2) return false;
  return Math.max(...fss) >= 16 && Math.min(...fss) <= 14;
}

/** 行元素首行/副行字数（首段为题、其余段之和为副）。 */
function rowCharSplit(content) {
  const segs = String(content).split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]*>/g, ''));
  let head = 0, sub = 0;
  segs.forEach((seg, i) => {
    const n = visibleChars(seg);
    if (i === 0) head += n;
    else sub += n;
  });
  return { head, sub };
}

/** 可见字数：CJK=1 / ASCII≈0.55（与 estimateTextNeed 同口径）。 */
function visibleChars(html) {
  const text = String(html).replace(/<[^>]*>/g, '');
  let n = 0;
  for (const ch of text) n += isCjk(ch) ? 1 : 0.55;
  return n;
}

/**
 * Estimate the vertical space a text element needs under the platform render
 * contract: 10px padding on all four sides, top vAlign, line-height defaulting
 * to 1.5; wrapping width is width−20 (CJK glyph ≈ fontSize, ASCII ≈ 0.55×).
 * @param {any} el
 * @returns {{ need: number, detail: string }}
 */
function estimateTextNeed(el) {
  const DEFAULT_FS = 16;
  const width = Math.max(1, el.width - 20);
  const content = String(el.content ?? '');
  /** @type {{ fs: number, lh: number, text: string }[]} */
  const lines = [];
  // <p style="…">…</p> blocks; bare text outside <p> also counts (pre-line)
  const blocks = [];
  const pRe = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  let m, last = 0;
  while ((m = pRe.exec(content)) !== null) {
    if (m.index > last && content.slice(last, m.index).replace(/<[^>]*>/g, '').trim()) {
      blocks.push({ attrs: '', html: content.slice(last, m.index) });
    }
    blocks.push({ attrs: m[1] ?? '', html: m[2] ?? '' });
    last = pRe.lastIndex;
  }
  if (last < content.length && content.slice(last).replace(/<[^>]*>/g, '').trim()) {
    blocks.push({ attrs: '', html: content.slice(last) });
  }
  if (blocks.length === 0) blocks.push({ attrs: '', html: content });
  for (const block of blocks) {
    const blockStyle = (block.attrs.match(/style="([^"]*)"/) || [])[1] ?? '';
    const segments = block.html.split(/<br\s*\/?>|\n/i);
    for (const seg of segments) {
      if (!seg.replace(/<[^>]*>/g, '').trim()) continue;
      // font-size: a line fully wrapped in sized spans renders at the span
      // size, not the block size（18px 标题 + 13px 副行的 <br> 两行模式）——
      // 宽与高都必须按该行自己的字号估；无声明再回落块样式/默认。
      const segFs = [...seg.matchAll(/font-size:\s*([\d.]+)px/gi)].map((x) => Number(x[1]));
      const blockFs = (blockStyle.match(/font-size:\s*([\d.]+)px/i) || [])[1];
      const fs = segFs.length ? Math.max(...segFs) : blockFs !== undefined ? Number(blockFs) : DEFAULT_FS;
      // line-height: segment wins over block; px form wins; else el/1.5 × fs
      const scope = seg + ';' + blockStyle;
      const lhPx = ([...scope.matchAll(/line-height:\s*([\d.]+)px/gi)].map((x) => Number(x[1])))[0];
      const lhMul = ([...scope.matchAll(/line-height:\s*([\d.]+)\s*(?:;|"|$)/gi)].map((x) => Number(x[1])))[0];
      const lh = lhPx ?? (lhMul !== undefined ? lhMul * fs : typeof el.lineHeight === 'number' ? el.lineHeight * fs : 1.5 * fs);
      lines.push({ fs, lh, text: seg.replace(/<[^>]*>/g, '') });
    }
  }
  let need = 20; // 10px top + 10px bottom padding
  let wrappedLines = 0;
  let maxLineW = 0;
  for (const line of lines) {
    let w = 0;
    for (const ch of line.text) {
      w += isCjk(ch) ? line.fs : line.fs * 0.55;
    }
    const wraps = Math.max(1, Math.ceil(w / width));
    wrappedLines += wraps - 1;
    need += wraps * line.lh;
    maxLineW = Math.max(maxLineW, Math.min(w, width));
  }
  return {
    need: Math.ceil(need),
    maxLineW: Math.ceil(maxLineW),
    detail: `${lines.length} 行${wrappedLines ? ` +${wrappedLines} 折行` : ''} × 字号×行高 + 20 padding`,
  };
}

/**
 * Rendered glyph coverage of a text element under the platform contract:
 * starts at (left+10, top+10) for top vAlign (middle centers within the box),
 * width = widest rendered line, height = estimated content height — glyphs
 * are NOT clipped, so overflow extends past the nominal box.
 * @param {any} el
 */
function glyphRectOf(el) {
  const est = estimateTextNeed(el);
  const contentH = est.need - 20;
  const yOff = el.vAlign === 'middle' || el.vAlign === 'bottom'
    ? Math.max(10, (el.height - contentH) / 2)
    : 10;
  return {
    x1: el.left + 10,
    y1: el.top + yOff,
    x2: el.left + 10 + Math.max(1, est.maxLineW),
    y2: el.top + yOff + contentH,
  };
}

/** CJK / fullwidth glyph heuristic (width ≈ fontSize). */
function isCjk(ch) {
  return /[⺀-鿿豈-﫿︰-﹏＀-￯　-〿]/.test(ch);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('usage: node scripts/check.mjs <courseDir>');
    process.exit(0);
  }
  const courseDir = path.resolve(args[0]);
  const project = readCourse(courseDir);
  const { manifest, notes } = compileCourse(project, loadConfig());
  const findings = await checkCourse(project, manifest, notes);

  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const infos = findings.filter((f) => f.severity === 'info');

  const byLayer = { L1: 0, L2: 0, L3: 0 };
  for (const f of findings) byLayer[f.layer]++;

  const lines = [
    `# check report — ${path.basename(courseDir)}`,
    '',
    `L1 DSL contract: ${byLayer.L1} findings | L2 document lint: ${byLayer.L2} | L3 import rehearsal: ${byLayer.L3}`,
    '',
  ];
  for (const f of findings) {
    lines.push(`- [${f.severity}] ${f.layer} ${f.location} — ${f.message}`);
  }
  const buildDir = path.join(courseDir, 'build');
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(path.join(buildDir, 'check-report.md'), lines.join('\n') + '\n');

  for (const f of errors) console.error(`  ✗ [${f.layer}] ${f.location} — ${f.message}`);
  for (const f of warnings) console.log(`  ⚠ [${f.layer}] ${f.location} — ${f.message}`);
  if (infos.length && !args.includes('--quiet')) {
    for (const f of infos) console.log(`  · [${f.layer}] ${f.location} — ${f.message}`);
  }
  console.log(
    errors.length
      ? `✗ ${errors.length} error(s), ${warnings.length} warning(s) → build/check-report.md`
      : `✓ ${warnings.length} warning(s), ${infos.length} info(s) → build/check-report.md`,
  );
  process.exit(errors.length ? 1 : 0);
}
