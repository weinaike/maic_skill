#!/usr/bin/env node
/**
 * generate.mjs — mechanical support for the generate module (the generation
 * itself is model work driven by references/workflow-generate.md; this tool
 * keeps its output consistent).
 *
 *   scaffold  — stub scene files from a frozen outline.md (type/title/section
 *               skeleton per outline section). Stubs are meant to be filled by
 *               the generator before check runs.
 *   normalize — run the DSL's normalizeSlide over one scene file's canvas
 *               (fills element content defaults, derives geometry). Explicit
 *               and per-file on purpose: unpacked platform canvases pass
 *               through compile losslessly and must NOT be rewritten.
 *   theme     — resolve $token references in scene canvases to concrete theme
 *               values (design-system.md §2: tokens are resolved at
 *               generation time — the platform DSL knows no runtime vars).
 *   skeleton  — expand a page-type skeleton (skeletons/T*.json, L2) into a
 *               ready canvas with theme colors baked in. T1 is anchored on
 *               the 06-skill §5 gold sample; unanchored types refuse loudly.
 *
 * Usage:
 *   node scripts/generate.mjs scaffold <courseDir> [--scenes 3-5,8] [--force]
 *   node scripts/generate.mjs normalize <courseDir>/scenes/NN-x.md […]
 *   node scripts/generate.mjs theme <courseDir>/scenes/NN-x.md […]
 *   node scripts/generate.mjs skeleton <courseDir> T1 --spec spec.json [--out NN-x.md]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOutline } from './outline.mjs';
import { parseSceneMd, serializeSceneMd } from './lib/scene.mjs';
import { loadDsl } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';
import { loadThemeFor, resolveCanvasTokens, resolveToken } from './lib/theme.mjs';

const isMain = isMainModule(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Create scene-file stubs for the outline sections in range.
 * @param {string} courseDir
 * @param {{ range?: string, force?: boolean }} options
 */
export function scaffoldScenes(courseDir, options = {}) {
  const outlinePath = path.join(courseDir, 'outline.md');
  if (!existsSync(outlinePath)) throw new Error('outline.md missing — run the outline workflow first');
  const { sections } = parseOutline(readFileSync(outlinePath, 'utf8'));
  if (sections.length === 0) throw new Error('outline.md has no sections');

  const want = parseRange(options.range);
  const selected = want ? sections.filter((s) => want.has(s.n)) : sections;

  const created = [];
  const skipped = [];
  for (const s of selected) {
    const fileName = `${String(s.n).padStart(2, '0')}-${safeTitle(s.title)}.md`;
    const filePath = path.join(courseDir, 'scenes', fileName);
    if (existsSync(filePath) && !options.force) {
      skipped.push(fileName);
      continue;
    }
    const speech = [];
    if (s.speechIntent) {
      // The outline's 讲稿意图 rides along as the first TODO so the generator
      // sees its own brief inside the file it is filling.
      speech.push({ kind: 'raw', action: { type: 'TODO', note: `讲稿意图：${s.speechIntent}；时长预算 ${s.minutes}min（≈${Math.round(s.minutes * 240)} 字）` } });
    }
    const md = serializeSceneMd({
      type: s.type,
      title: s.title,
      speech: speech.length > 0 ? speech : [{ kind: 'raw', action: { type: 'TODO', note: '待生成讲稿' } }],
      canvas: s.type === 'slide' ? { TODO: '按画布意图选配方生成：' + (s.canvasIntent ?? '') + '；页型选 T1-T6（design-system §5，T1 可 generate.mjs skeleton 展开），颜色用 $token 再 generate.mjs theme 解析' } : undefined,
      quiz: s.type === 'quiz' ? { questions: [] } : undefined,
      rawContent:
        s.type === 'interactive'
          ? { TODO: 'interactive 内容待生成：完整自包含 HTML + message 监听器，契约见 references/interactive-spec.md' }
          : s.type === 'pbl'
            ? { TODO: 'pbl 内容待生成（PBLProject 形状）' }
            : undefined,
    });
    // serialize writes a canvas fence for any truthy value; the TODO stub is
    // fine — check.mjs flags it until replaced.
    writeFileSync(filePath, md);
    created.push(fileName);
  }
  return { created, skipped };
}

/**
 * Normalize one scene file's canvas through the DSL (generated canvases only).
 * @param {string} sceneFilePath
 * @returns {{ filled: number, changed: boolean }}
 */
export async function normalizeSceneCanvas(sceneFilePath) {
  const dsl = await loadDsl();
  const text = readFileSync(sceneFilePath, 'utf8');
  const scene = parseSceneMd(text, path.basename(sceneFilePath));
  if (!scene.canvas) throw new Error(`${sceneFilePath}: no 画布 canvas fence`);
  if (scene.canvas['TODO']) throw new Error(`${sceneFilePath}: canvas is still a TODO stub`);

  const before = JSON.stringify(scene.canvas);
  const normalized = dsl.normalizeSlide(scene.canvas);
  const after = JSON.stringify(normalized);

  if (before !== after) {
    const rebuilt = serializeSceneMd({
      type: String(scene.frontmatter['type'] ?? 'slide'),
      title: String(scene.frontmatter['title'] ?? ''),
      layout: scene.frontmatter['layout'],
      speech: scene.speech,
      canvas: normalized,
      quiz: scene.quiz,
      rawContent: scene.rawContent,
      whiteboards: scene.whiteboards,
      multiAgent: scene.multiAgent,
    });
    writeFileSync(sceneFilePath, rebuilt);
  }
  return { changed: before !== after, filled: countFilled(normalized) };
}

/** Count elements the normalizer touched is not observable; count total as proxy. */
function countFilled(canvas) {
  return Array.isArray(canvas?.['elements']) ? canvas['elements'].length : 0;
}

/**
 * Resolve $token references in one scene file's canvas against the course's
 * theme. Only the canvas fence is touched — 讲稿/quiz/whiteboards stay as-is.
 * @param {string} sceneFilePath
 * @returns {{ resolved: number, unresolved: string[], changed: boolean, filled: number }}
 */
export function resolveSceneTheme(sceneFilePath) {
  const text = readFileSync(sceneFilePath, 'utf8');
  const scene = parseSceneMd(text, path.basename(sceneFilePath));
  if (!scene.canvas) throw new Error(`${sceneFilePath}: no 画布 canvas fence`);
  if (scene.canvas['TODO']) throw new Error(`${sceneFilePath}: canvas is still a TODO stub`);

  const courseDir = path.dirname(path.dirname(path.resolve(sceneFilePath)));
  const theme = loadThemeFor(courseDir);
  const { canvas, resolved, unresolved } = resolveCanvasTokens(scene.canvas, theme);
  const changed = resolved > 0;
  if (changed) {
    writeFileSync(sceneFilePath, serializeSceneMd({
      type: String(scene.frontmatter['type'] ?? 'slide'),
      title: String(scene.frontmatter['title'] ?? ''),
      layout: scene.frontmatter['layout'],
      speech: scene.speech,
      canvas,
      quiz: scene.quiz,
      rawContent: scene.rawContent,
      whiteboards: scene.whiteboards,
      multiAgent: scene.multiAgent,
    }));
  }
  return { resolved, unresolved, changed, filled: countFilled(canvas) };
}

/**
 * Expand a page-type skeleton into a canvas with theme colors baked in.
 * @param {string} courseDir
 * @param {string} layoutType e.g. 'T1'
 * @param {{
 *   title?: string, subtitle?: string,
 *   headers?: { left?: string, right?: string },
 *   rows?: { left?: {title: string, sub?: string, mono?: boolean}[], right?: {title: string, sub?: string, mono?: boolean}[] },
 *   footnote?: string, numbers?: 'L'|'R'|'none',
 * }} spec
 * @returns {{ canvas: Record<string, unknown>, layout: string }}
 */
export function expandSkeleton(courseDir, layoutType, spec = {}) {
  const skeletonPath = path.join(SKILL_DIR, 'skeletons', `${layoutType}.json`);
  if (!existsSync(skeletonPath)) {
    throw new Error(`页型骨架缺失：${skeletonPath}（注册表与入库条件见 design-system.md §5/§9.3）`);
  }
  const sk = JSON.parse(readFileSync(skeletonPath, 'utf8'));
  if (sk['status'] !== 'anchored') {
    throw new Error(`页型 ${layoutType} 尚无锚点（status: ${sk['status']}）——先用黄金样例定锚再开放展开`);
  }
  const theme = loadThemeFor(courseDir);
  const T = (ref) => resolveToken(theme, String(ref));
  const g = sk['geometry'];
  const numbers = spec.numbers ?? sk['params']['numbers']['default'];

  if (layoutType === 'T1') return { canvas: buildT1(T, theme, g, spec, numbers), layout: layoutType };
  throw new Error(`页型 ${layoutType} 有锚点但 generate.mjs 尚无展开器——补 build${layoutType}`);
}

/** T1 双面板展开（解剖 = 黄金样例 §5：页头三件套 + 等宽面板×2 + 行组 + 脚注）。 */
function buildT1(T, theme, g, spec, numbers) {
  const els = [];
  const p = g['pageTitle'], u = g['underline'], st = g['subtitle'];
  const title = spec.title ?? '（页标题）';
  els.push(textEl('text_page_title', p['left'], p['top'], p['width'], p['height'],
    `<p style="font-size: ${p['fontSize']}px; font-weight: bold; color: ${T('$text.panelTitle')};">${esc(title)}</p>`, T('$text.panelTitle')));
  els.push(rectEl('shape_title_underline', u['left'], u['top'], u['width'], u['height'], T('$titleRule.color')));
  els.push(textEl('text_page_subtitle', st['left'], st['top'], st['width'], st['height'],
    `<p style="font-size: ${st['fontSize']}px; color: ${T('$text.sub')};">${esc(spec.subtitle ?? '')}</p>`, T('$text.sub')));

  const sides = [
    { tag: 'l', x: g['panel']['leftX'], header: spec.headers?.['left'] ?? '（左面板标题）', rows: spec.rows?.['left'] ?? [], numbered: numbers === 'L' },
    { tag: 'r', x: g['panel']['rightX'], header: spec.headers?.['right'] ?? '（右面板标题）', rows: spec.rows?.['right'] ?? [], numbered: numbers === 'R' },
  ];
  const W = g['panel']['width'];
  // 面板高度随行数伸缩（锚点实测 @3 行 = 324：首行偏移 64 + (n-1)*86 + 行高 66 + 底距 22）
  const firstOff = g['row']['firstY'] - g['panel']['top'];
  for (const s of sides) {
    const rows = s.rows.length ? s.rows : Array.from({ length: 3 }, () => ({ title: '（行题）', sub: '（副行）' }));
    const n = Math.max(2, Math.min(4, rows.length));
    const pn = g['panel'];
    const panelH = firstOff + (n - 1) * g['row']['step'] + g['row']['h'] + 22;
    const r = g['panel']['radius'];
    els.push(shapeEl(`shape_panel_${s.tag}`, s.x, pn['top'], W, panelH, T('$panel.bg'),
      `M ${r} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} L ${W} ${panelH - r} Q ${W} ${panelH} ${W - r} ${panelH} L ${r} ${panelH} Q 0 ${panelH} 0 ${panelH - r} L 0 ${r} Q 0 0 ${r} 0 Z`));
    els.push(shapeEl(`shape_titlebar_${s.tag}`, s.x, pn['top'], W, pn['titleBarH'], T('$panel.titleBar'),
      `M 8 0 L ${W - 8} 0 Q ${W} 0 ${W} 8 L ${W} ${pn['titleBarH']} L 0 ${pn['titleBarH']} L 0 8 Q 0 0 8 0 Z`));
    els.push(textEl(`text_header_${s.tag}`, s.x + g['header']['insetX'], pn['top'], W - g['header']['insetX'] * 2, pn['titleBarH'],
      `<p style="font-size: ${g['header']['fontSize']}px; font-weight: bold; color: ${T('$text.panelTitle')};">${esc(s.header)}</p>`,
      T('$text.panelTitle'), 'middle'));
    rows.slice(0, n).forEach((row, i) => {
      const y = g['row']['firstY'] + i * g['row']['step'];
      const num = s.numbered ? `<span style="color: ${T('$text.accent')};">${i + 1} ·</span> ` : '';
      const mono = row.mono
        ? `font-family: Consolas, monospace; font-size: ${g['row']['fontSizeMono']}px;`
        : `font-size: ${g['row']['fontSizeSub']}px;`;
      els.push(textEl(`text_row_${s.tag}${i + 1}`, s.x + g['row']['insetX'], y, W - g['row']['insetX'] * 2, g['row']['h'],
        `<p style="font-size: ${g['row']['fontSizeTitle']}px; font-weight: bold; color: ${T('$text.title')}; line-height: 1.5;">${num}${esc(row.title)}<br><span style="${mono} font-weight: normal; color: ${T('$text.sub')}; line-height: 1.4;">${esc(row.sub ?? '')}</span></p>`,
        T('$text.title'), 'middle'));
    });
  }
  if (spec.footnote) {
    const f = g['footnote'];
    els.push(textEl('text_footnote', f['left'], f['top'], f['width'], f['height'],
      `<p style="font-size: ${f['fontSize']}px; color: ${T('$text.footnote')};">${esc(spec.footnote)}</p>`, T('$text.footnote'), 'middle'));
  }
  return {
    id: 'slide_t1', viewportSize: 1000, viewportRatio: 0.5625,
    theme: platformThemeBlock(theme), background: { type: 'solid', color: '#ffffff' }, elements: els,
  };
}

/** 平台硬编码 theme 块逐字照抄（§4：三课一致，scene-builder.ts:39）。 */
function platformThemeBlock(theme) {
  const c = theme['canvas'];
  return {
    backgroundColor: c['backgroundColor'], themeColors: [...c['themeColors']],
    fontColor: c['fontColor'], fontName: c['fontName'],
    outline: { ...c['outline'] }, shadow: { ...c['shadow'] },
  };
}

/** @param {string} html */
const esc = (html) => String(html).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function textEl(id, left, top, width, height, content, color, vAlign) {
  return { id, type: 'text', left, top, width, height, ...(vAlign ? { vAlign } : {}), content, defaultFontName: 'Microsoft YaHei', defaultColor: color };
}
function shapeEl(id, left, top, width, height, fill, d) {
  return { id, type: 'shape', left, top, width, height, shape: 'roundRect', fill, fixedRatio: false, viewBox: [width, height], path: d };
}
function rectEl(id, left, top, width, height, fill) {
  return { id, type: 'shape', left, top, width, height, shape: 'rect', fill, viewBox: [width, height], path: `M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`, fixedRatio: false };
}

/** @param {string} [range] "3-5,8" → Set of ints; undefined → all */
function parseRange(range) {
  if (!range) return undefined;
  const set = new Set();
  for (const part of range.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const from = Number.parseInt(m[1], 10);
    const to = m[2] ? Number.parseInt(m[2], 10) : from;
    for (let i = from; i <= to; i++) set.add(i);
  }
  return set.size > 0 ? set : undefined;
}

/** @param {string} title */
function safeTitle(title) {
  const cleaned = title.replace(/[\\/:*?"<>|#\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return cleaned || 'untitled';
}

if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  try {
    if (cmd === 'scaffold') {
      const courseDir = path.resolve(args[1] ?? '.');
      const rangeIdx = args.indexOf('--scenes');
      const result = scaffoldScenes(courseDir, {
        range: rangeIdx >= 0 ? args[rangeIdx + 1] : undefined,
        force: args.includes('--force'),
      });
      for (const f of result.created) console.log(`✓ 创建 scenes/${f}（骨架——待生成器填充）`);
      for (const f of result.skipped) console.log(`· 跳过已存在 scenes/${f}（--force 覆盖）`);
      if (result.created.length === 0 && result.skipped.length === 0) console.log('（无匹配的 outline 节）');
    } else if (cmd === 'normalize') {
      const files = args.slice(1);
      if (files.length === 0) throw new Error('normalize 需要至少一个场景文件路径');
      for (const file of files) {
        const r = await normalizeSceneCanvas(path.resolve(file));
        console.log(`${r.changed ? '✓ 已补默认' : '· 无需修改'} ${file}（${r.filled} 元素）`);
      }
    } else if (cmd === 'theme') {
      const files = args.slice(1);
      if (files.length === 0) throw new Error('theme 需要至少一个场景文件路径');
      for (const file of files) {
        const r = resolveSceneTheme(path.resolve(file));
        const left = r.unresolved.length ? `，${r.unresolved.length} 个 $ 引用未命中（多为 shell 变量，已保留）` : '';
        console.log(`${r.changed ? `✓ 解析 ${r.resolved} 个 token` : '· 无 token 引用'} ${file}${left}`);
      }
    } else if (cmd === 'skeleton') {
      const courseDir = path.resolve(args[1] ?? '.');
      const layoutType = args[2];
      if (!layoutType) throw new Error('skeleton 需要 <courseDir> <T1|…> [--spec spec.json] [--out NN-x.md]');
      const specIdx = args.indexOf('--spec');
      const spec = specIdx >= 0 ? JSON.parse(readFileSync(path.resolve(args[specIdx + 1]), 'utf8')) : {};
      const { canvas, layout } = expandSkeleton(courseDir, layoutType, spec);
      const outIdx = args.indexOf('--out');
      if (outIdx >= 0) {
        const out = path.join(courseDir, 'scenes', args[outIdx + 1]);
        if (existsSync(out)) throw new Error(`已存在：${out}（--out 不覆盖，先删或改名）`);
        writeFileSync(out, serializeSceneMd({
          type: 'slide', title: String(spec.title ?? layout), speech: [{ kind: 'raw', action: { type: 'TODO', note: '待生成讲稿' } }], canvas,
          layout,
        }));
        console.log(`✓ ${out}（${canvas['elements'].length} 元素，${layout} 骨架 + 主题色已焙入；讲稿待生成）`);
      } else {
        console.log(JSON.stringify(canvas, null, 2));
      }
    } else {
      console.log('usage: node scripts/generate.mjs scaffold|normalize|theme|skeleton …');
      process.exit(args[0] === '--help' ? 0 : 2);
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
