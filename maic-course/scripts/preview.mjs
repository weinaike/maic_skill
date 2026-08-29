#!/usr/bin/env node
/**
 * preview.mjs — offline review station (离线审片台).
 *
 * Renders a course project into a single self-contained build/preview.html:
 * every scene as a 1000×562.5 canvas (absolutely-positioned approximation of
 * the PPTist elements — text renders as its real inline-styled HTML), plus the
 * speech timeline with inline audio players. No platform, no server: open the
 * file in a browser and walk the course end to end. This is the 门2 artifact.
 *
 * Usage:
 *   node scripts/preview.mjs <courseDir> [--out build]
 *   open <courseDir>/build/preview.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from './lib/course.mjs';
import { compileCourse } from './compile.mjs';
import { loadConfig } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';

const isMain = isMainModule(import.meta.url);

/**
 * @param {import('./lib/course.mjs').CourseProject} project
 * @param {Record<string, unknown>} manifest
 * @param {{ audioMisses: unknown[] }} notes
 * @returns {string}
 */
export function renderPreviewHtml(project, manifest, notes) {
  const scenes = /** @type {any[]} */ (manifest['scenes']);
  const nav = scenes
    .map((s, i) => `<a href="#scene-${i + 1}">${i + 1}·${escapeHtml(String(s.title ?? ''))}</a>`)
    .join('');

  const totalSeconds = Object.values(manifest['mediaIndex'] ?? {})
    .filter((/** @type {any} */ e) => e.type === 'audio')
    .reduce((acc, /** @type {any} */ e) => acc + (e.duration ?? 0), 0);

  const body = scenes
    .map((scene, i) => renderScene(scene, i + 1))
    .join('\n');

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(String(manifest['stage']?.['name'] ?? 'course'))} · 预览</title>
<style>
  :root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent:#2563eb; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Microsoft YaHei","PingFang SC",system-ui,sans-serif; color:var(--ink); background:#f3f4f6; }
  header { position:sticky; top:0; z-index:9; background:#fff; border-bottom:1px solid var(--line); padding:10px 20px; display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; }
  header .meta { color:var(--muted); font-size:12px; }
  nav { display:flex; gap:6px; flex-wrap:wrap; }
  nav a { font-size:12px; color:var(--accent); text-decoration:none; padding:2px 8px; border:1px solid var(--line); border-radius:10px; }
  section.scene { background:#fff; margin:18px auto; max-width:896px; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  .scene-head { display:flex; gap:10px; align-items:baseline; padding:10px 16px; border-bottom:1px solid var(--line); background:#fafafa; }
  .scene-head .no { font-weight:600; color:var(--accent); }
  .scene-head .type { font-size:11px; padding:1px 8px; border-radius:8px; background:#eef2ff; color:#4338ca; }
  .stage-wrap { padding:14px 16px 6px; overflow-x:auto; background:
    repeating-conic-gradient(#f8fafc 0% 25%, #fff 0% 50%) 0/16px 16px; }
  .canvas { position:relative; width:850px; height:478px; transform-origin:0 0; margin:0 auto; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.12); overflow:hidden; }
  .canvas > * { position:absolute; }
  .canvas img { object-fit:contain; }
  .timeline { padding:8px 16px 14px; }
  .timeline h3 { font-size:12px; color:var(--muted); margin:8px 0 6px; font-weight:500; }
  .step { display:flex; gap:10px; padding:7px 0; border-top:1px dashed var(--line); font-size:13px; align-items:flex-start; }
  .step .idx { color:var(--muted); min-width:22px; text-align:right; }
  .step.spot { color:#7c3aed; }
  .step.raw  { color:var(--muted); font-family:ui-monospace,monospace; font-size:11px; }
  .step audio { height:26px; }
  .miss { color:#b45309; font-size:11px; }
  .quiz { padding:4px 16px 16px; }
  .quiz .q { margin:10px 0; padding:10px 12px; border:1px solid var(--line); border-radius:6px; font-size:13px; }
  .quiz .opt { margin:3px 0 3px 14px; }
  .quiz .ans { color:#047857; }
  .pbl { padding:4px 16px 16px; font-size:13px; line-height:1.7; }
  .pbl h4 { margin:8px 0; }
  .ph { border:1px dashed #cbd5e1; background:#f8fafc; color:#94a3b8; display:flex; align-items:center; justify-content:center; font-size:11px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(String(manifest['stage']?.['name'] ?? 'course'))}</h1>
  <span class="meta">${scenes.length} 场景 · 音频 ${Math.round(totalSeconds / 60)}min${notes.audioMisses.length ? ` · <b class="miss">${notes.audioMisses.length} 句缺音频</b>` : ''}</span>
  <nav>${nav}</nav>
</header>
${body}
</body>
</html>
`;
}

/** @param {any} scene @param {number} index */
function renderScene(scene, index) {
  const parts = [];
  parts.push(
    `<section class="scene" id="scene-${index}">`,
    `<div class="scene-head"><span class="no">${index}</span><strong>${escapeHtml(String(scene.title ?? ''))}</strong><span class="type">${scene.type}</span></div>`,
  );
  if (scene.type === 'slide' && scene.content?.canvas) {
    parts.push(`<div class="stage-wrap"><div class="canvas">${renderCanvas(scene.content.canvas)}</div></div>`);
  }
  if (scene.type === 'quiz') parts.push(renderQuiz(scene.content));
  if (scene.type === 'pbl') parts.push(renderPbl(scene.content));

  const actions = scene.actions ?? [];
  if (actions.length > 0) {
    const steps = actions
      .map((/** @type {any} */ a, /** @type {number} */ i) => {
        if (a.type === 'speech') {
          const audio = a.audioRef
            ? `<audio controls preload="none" src="${encodeAttr(relAudio(String(a.audioRef)))}"></audio>`
            : `<span class="miss">（缺音频）</span>`;
          return `<div class="step"><span class="idx">${i + 1}</span><div>${escapeHtml(String(a.text ?? ''))}<br>${audio}</div></div>`;
        }
        if (a.type === 'spotlight') {
          return `<div class="step spot"><span class="idx">${i + 1}</span><div>🎯 spotlight → <code>${escapeHtml(String(a.elementId ?? ''))}</code></div></div>`;
        }
        return `<div class="step raw"><span class="idx">${i + 1}</span><div>${escapeHtml(JSON.stringify(a))}</div></div>`;
      })
      .join('');
    parts.push(`<div class="timeline"><h3>讲稿时间线（含音频，按序播放）</h3>${steps}</div>`);
  }
  parts.push('</section>');
  return parts.join('\n');
}

/**
 * Approximate PPTist canvas render: text passes through as real HTML, shapes
 * as filled boxes, images as <img>, tables as HTML tables, lines as SVG.
 * @param {any} canvas
 */
function renderCanvas(canvas) {
  /** @type {string[]} */
  const out = [];
  /** @type {{x1:number,y1:number,x2:number,y2:number,color:string,width:number}[]} */
  const lines = [];
  for (const el of canvas.elements ?? []) {
    const box = `left:${el.left * 0.85}px;top:${el.top * 0.85}px;width:${el.width * 0.85}px;height:${(el.height ?? 40) * 0.85}px;`;
    if (el.type === 'text') {
      out.push(`<div style="${box}">${el.content ?? ''}</div>`);
    } else if (el.type === 'shape') {
      out.push(`<div style="${box}background:${fillOf(el)};${borderOf(el)}${radiusOf(el)}"></div>`);
    } else if (el.type === 'image') {
      const src = String(el.src ?? '');
      if (src.startsWith('data:')) out.push(`<img style="${box}" src="${src}">`);
      else out.push(`<div class="ph" style="${box}">image（外部引用）</div>`);
    } else if (el.type === 'line') {
      lines.push({
        x1: Number(el.start?.[0] ?? 0), y1: Number(el.start?.[1] ?? 0),
        x2: Number(el.end?.[0] ?? 0), y2: Number(el.end?.[1] ?? 0),
        color: borderlessColor(el), width: Number(el.style?.width ?? 2),
      });
    } else if (el.type === 'table') {
      out.push(renderTable(el, box));
    } else {
      out.push(`<div class="ph" style="${box}">${el.type}</div>`);
    }
  }
  if (lines.length > 0) {
    const svg = lines
      .map((l) => `<line x1="${l.x1 * 0.85}" y1="${l.y1 * 0.85}" x2="${l.x2 * 0.85}" y2="${l.y2 * 0.85}" stroke="${l.color}" stroke-width="${l.width}"/>`)
      .join('');
    out.push(`<svg style="left:0;top:0;width:850px;height:478px;pointer-events:none;" viewBox="0 0 850 478">${svg}</svg>`);
  }
  return out.join('');
}

/** @param {any} el @param {string} box */
function renderTable(el, box) {
  const rows = (el.data ?? [])
    .map((/** @type {any[]} */ row) => `<tr>${row.map((c) => `<td>${c?.text ?? ''}</td>`).join('')}</tr>`)
    .join('');
  return `<table style="${box}border-collapse:collapse;font-size:12px;">${rows}</table>`.replace(
    '<table ',
    '<table border=1 ',
  );
}

/** @param {any} content */
function renderQuiz(content) {
  const questions = (content?.questions ?? [])
    .map((/** @type {any} */ q, /** @type {number} */ i) => {
      const opts = (q.options ?? [])
        .map((/** @type {any} */ o) => `<div class="opt">${escapeHtml(o.value ?? '')}. ${escapeHtml(o.label ?? '')}</div>`)
        .join('');
      const ans = Array.isArray(q.answer) && q.answer.length
        ? `<details><summary>答案/解析</summary><span class="ans">${q.answer.join(',')}</span> — ${escapeHtml(q.analysis ?? '')}</details>`
        : '<span class="miss">（简答/无标准答案）</span>';
      return `<div class="q"><b>Q${i + 1}（${q.type}）</b> ${escapeHtml(q.question ?? '')}${opts}${ans}</div>`;
    })
    .join('');
  return `<div class="quiz">${questions}</div>`;
}

/** @param {any} content */
function renderPbl(content) {
  const p = content?.projectV2 ?? {};
  return `<div class="pbl">
    <h4>${escapeHtml(String(p.title ?? 'PBL 项目'))}</h4>
    <p>${escapeHtml(String(p.description ?? ''))}</p>
    <p><b>目标：</b>${escapeHtml(String(p.learningObjective ?? ''))}</p>
    ${(p.gains ?? []).map((/** @type {string} */ g) => `<p>✓ ${escapeHtml(g)}</p>`).join('')}
  </div>`;
}

/** @param {any} el */
function fillOf(el) {
  const fill = el.fill;
  if (typeof fill === 'string') return fill;
  if (fill && typeof fill === 'object') {
    if (fill.type === 'solid' && typeof fill.color === 'string') return fill.color;
    if (fill.type === 'gradient') {
      const stops = fill.stops ?? [];
      if (stops[0]?.color) return `linear-gradient(${stops.map((/** @type {any} */ s) => s.color).join(',')})`;
    }
  }
  return 'transparent';
}

/** @param {any} el */
function borderOf(el) {
  const line = el.line;
  if (line && typeof line === 'object' && line.color && line.width) {
    return `border:${line.width}px solid ${line.color};`;
  }
  return '';
}

/** @param {any} el */
function radiusOf(el) {
  if (el.shape === 'ellipse' || el.shape === 'circle') return 'border-radius:50%;';
  if (el.shape === 'roundRect') return 'border-radius:8px;';
  return '';
}

/** @param {any} el */
function borderlessColor(el) {
  const c = el.style?.color ?? el.color;
  return typeof c === 'string' ? c : '#94a3b8';
}

/** @param {string} audioRef mediaIndex path "audio/xxx.mp3" → relative from build/ */
function relAudio(audioRef) {
  return `../${audioRef}`;
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** @param {string} s */
function encodeAttr(s) {
  return escapeHtml(s);
}

if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('usage: node scripts/preview.mjs <courseDir> [--out build]');
    process.exit(0);
  }
  const courseDir = path.resolve(args[0]);
  const project = readCourse(courseDir);
  const { manifest, notes } = compileCourse(project, loadConfig());
  const html = renderPreviewHtml(project, manifest, notes);
  const outIdx = args.indexOf('--out');
  const buildDir = path.join(courseDir, outIdx >= 0 ? args[outIdx + 1] : 'build');
  mkdirSync(buildDir, { recursive: true });
  const file = path.join(buildDir, 'preview.html');
  writeFileSync(file, html);
  const audioCount = Object.values(manifest['mediaIndex'] ?? {}).filter((/** @type {any} */ e) => e.type === 'audio').length;
  console.log(`✓ ${path.relative(process.cwd(), file)}（${manifest['scenes'].length} 场景 · ${audioCount} 音频 · ${(html.length / 1024).toFixed(0)}KB）`);
  console.log(`  打开浏览: open ${file}`);
}
