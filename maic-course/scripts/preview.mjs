#!/usr/bin/env node
/**
 * preview.mjs — offline review station (离线审片台), deck mode.
 *
 * Renders a course project into a single self-contained build/preview.html:
 * ONE scene at a time (翻页) — canvas on the left, the speech timeline on the
 * right — with a sequential-play engine that plays each scene's narration in
 * order, highlights the current line, lights up spotlight targets on the
 * canvas, and auto-advances to the next scene. No platform, no server: open
 * the file in a browser. This is the 门2 artifact.
 *
 * Controls: ← / → scenes · Space play/pause · dots jump · 隐藏讲稿 immersive.
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
  const mediaIndex = /** @type {Record<string, any>} */ (manifest['mediaIndex'] ?? {});
  const totalSeconds = Object.values(mediaIndex)
    .filter((/** @type {any} */ e) => e.type === 'audio')
    .reduce((acc, /** @type {any} */ e) => acc + (e.duration ?? 0), 0);

  // Per-scene deck data for the play engine (audioRef + duration + spotlight).
  const deck = scenes.map((scene) => ({
    title: String(scene.title ?? ''),
    type: String(scene.type ?? 'slide'),
    actions: (scene.actions ?? []).map((/** @type {any} */ a) => ({
      type: a.type,
      text: typeof a.text === 'string' ? a.text : undefined,
      elementId: typeof a.elementId === 'string' ? a.elementId : undefined,
      audioRef: typeof a.audioRef === 'string' ? a.audioRef : undefined,
      duration: a.audioRef ? mediaIndex[a.audioRef]?.duration : undefined,
    })),
  }));

  const sections = scenes
    .map((scene, i) => renderScene(scene, i + 1))
    .join('\n');

  const deckJson = JSON.stringify(deck).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(String(manifest['stage']?.['name'] ?? 'course'))} · 审片</title>
<style>
  :root {
    --ink:#1f2937; --muted:#64748b; --line:#e2e8f0; --accent:#2563eb;
    --bg:#eef1f6; --card:#ffffff; --panel:#f8fafc; --playing:#2563eb;
  }
  * { box-sizing:border-box; }
  html,body { height:100%; }
  body { margin:0; font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif; color:var(--ink); background:var(--bg); display:flex; flex-direction:column; }

  /* ── header ─────────────────────────────────────────── */
  header { display:flex; align-items:center; gap:14px; padding:10px 18px; background:#fff; border-bottom:1px solid var(--line); flex:0 0 auto; }
  header h1 { font-size:15px; margin:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:32vw; }
  header .meta { color:var(--muted); font-size:12px; white-space:nowrap; }
  header .grow { flex:1; }
  .btn { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:8px; padding:6px 12px; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
  .btn:hover { border-color:#cbd5e1; background:#f8fafc; }
  .btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  .btn.primary:hover { background:#1d4ed8; }
  .btn[disabled] { opacity:.45; cursor:default; }
  .counter { font-variant-numeric:tabular-nums; font-size:13px; color:var(--muted); min-width:88px; text-align:center; }

  /* ── stage layout ───────────────────────────────────── */
  main { flex:1 1 auto; display:flex; min-height:0; padding:16px; gap:16px; justify-content:center; overflow-y:auto; }
  .stage { display:flex; gap:16px; width:100%; max-width:1240px; min-height:0; }
  .scene-wrap { flex:1 1 auto; display:none; min-width:0; flex-direction:column; }
  .scene-wrap.active { display:flex; }
  .canvas-card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; box-shadow:0 1px 8px rgba(15,23,42,.06); }
  /* 画布按原生 1000×562.5 渲染（元素坐标与内联字号都原生），整体 transform 等比缩放 */
  .stage-wrap2 { width:850px; height:478.5px; margin:0 auto; overflow:hidden; background:repeating-conic-gradient(#f8fafc 0% 25%, #fff 0% 50%) 0/16px 16px; border-radius:8px; }
  .canvas { position:relative; width:1000px; height:562.5px; transform:scale(0.85); transform-origin:0 0; background:#fff; overflow:hidden; }
  /* 平台渲染器 reset 了段落默认边距——不重置的话每个文本框都被 p 的 1em margin 撑高，布局漂移 */
  .canvas p, .canvas ul, .canvas li { margin:0; padding:0; }
  .canvas > * { position:absolute; }
  .canvas img { object-fit:contain; }
  .canvas .ph { border:1px dashed #cbd5e1; background:#f8fafc; color:#94a3b8; display:flex; align-items:center; justify-content:center; font-size:11px; }
  .spot-active { outline:3px solid #f59e0b !important; outline-offset:2px; border-radius:4px; box-shadow:0 0 0 7px rgba(245,158,11,.22); }

  /* ── speech panel ───────────────────────────────────── */
  .panel { flex:0 0 340px; display:flex; flex-direction:column; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; min-height:0; }
  .panel-head { padding:10px 14px; border-bottom:1px solid var(--line); background:#fff; display:flex; align-items:baseline; gap:8px; }
  .panel-head .no { font-weight:700; color:var(--accent); }
  .panel-head .type { font-size:11px; padding:1px 8px; border-radius:9px; background:#eef2ff; color:#4338ca; }
  .panel-head .t { font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .timeline { flex:1; overflow-y:auto; padding:8px 10px 14px; }
  .step { display:flex; gap:9px; padding:8px 10px; border-radius:8px; font-size:13px; line-height:1.6; align-items:flex-start; }
  .step .idx { color:#94a3b8; min-width:20px; text-align:right; font-variant-numeric:tabular-nums; }
  .step.speech .txt { flex:1; }
  .step .dur { color:#94a3b8; font-size:11px; white-space:nowrap; }
  .step.spot { color:#7c3aed; background:#f5f3ff; }
  .step.raw { color:var(--muted); font-family:ui-monospace,Menlo,monospace; font-size:11px; word-break:break-all; }
  .step.missing .txt::after { content:"（缺音频）"; color:#b45309; font-size:11px; }
  .step.now { background:#dbeafe; box-shadow:inset 0 0 0 1px #93c5fd; }
  .step.now .idx { color:var(--playing); font-weight:700; }
  .quiz, .pbl { padding:12px 16px; overflow-y:auto; }
  .quiz .q { margin:10px 0; padding:10px 12px; border:1px solid var(--line); border-radius:8px; font-size:13px; background:#fff; }
  .quiz .opt { margin:3px 0 3px 14px; }
  .quiz .ans { color:#047857; }
  .pbl { font-size:13px; line-height:1.7; background:#fff; border-radius:8px; }
  .pbl h4 { margin:8px 0; }

  /* ── footer dots ────────────────────────────────────── */
  footer { flex:0 0 auto; display:flex; gap:7px; justify-content:center; align-items:center; padding:10px; background:#fff; border-top:1px solid var(--line); }
  .dot { width:26px; height:26px; border-radius:50%; border:1px solid var(--line); background:#fff; color:var(--muted); font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .dot:hover { border-color:var(--accent); color:var(--accent); }
  .dot.cur { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:700; }
  .dot.quiz { border-radius:6px; }
  .hint { margin-left:14px; color:#94a3b8; font-size:11px; }
  body.panel-hidden .panel { display:none; }
  body.panel-hidden .stage { max-width:920px; }
  /* 窄视口纵向堆叠：整体 scale 到 0.62（字号坐标同缩），给讲稿面板留出可读高度 */
  @media (max-width:1240px) {
    .stage { flex-direction:column; align-items:center; max-width:700px; }
    .stage-wrap2 { width:620px; height:349px; }
    .canvas { transform:scale(0.62); }
    .panel { flex:0 0 auto; width:652px; max-height:40vh; }
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(String(manifest['stage']?.['name'] ?? 'course'))}</h1>
  <span class="meta">${scenes.length} 场景 · 音频 ${Math.floor(totalSeconds / 60)}′${String(Math.round(totalSeconds % 60)).padStart(2, '0')}″${notes.audioMisses.length ? ` · <b style="color:#b45309">${notes.audioMisses.length} 句缺音频</b>` : ''}</span>
  <span class="grow"></span>
  <button class="btn" id="btnPrev" title="上一页 (←)">◀ 上一页</button>
  <span class="counter" id="counter">1 / ${scenes.length}</span>
  <button class="btn" id="btnNext" title="下一页 (→)">下一页 ▶</button>
  <button class="btn primary" id="btnPlay" title="连播/暂停 (Space)">▶ 连播本课</button>
  <button class="btn" id="btnPanel" title="隐藏/显示讲稿面板">隐藏讲稿</button>
</header>
<main><div class="stage">
${sections}
</div></main>
<footer id="dots">
  ${scenes.map((/** @type {any} */ s, /** @type {number} */ i) => `<button class="dot ${s.type === 'quiz' ? 'quiz' : ''}" data-go="${i}" title="${escapeHtml(String(s.title ?? ''))}">${i + 1}</button>`).join('')}
  <span class="hint">←/→ 翻页 · Space 连播/暂停 · 圆点跳页</span>
</footer>
<audio id="player" preload="auto"></audio>
<script>
const DECK = ${deckJson};
const els = {
  counter: document.getElementById('counter'),
  btnPrev: document.getElementById('btnPrev'),
  btnNext: document.getElementById('btnNext'),
  btnPlay: document.getElementById('btnPlay'),
  btnPanel: document.getElementById('btnPanel'),
  player: document.getElementById('player'),
  wraps: [...document.querySelectorAll('.scene-wrap')],
  dots: [...document.querySelectorAll('.dot')],
};
let cur = -1;
let playToken = 0;      // bump to cancel the running play sequence
let playing = false;

function show(i, opts) {
  const keepPlay = opts && opts.keepPlay;
  if (!keepPlay) stopPlay();
  cur = Math.max(0, Math.min(i, DECK.length - 1));
  els.wraps.forEach((w, k) => w.classList.toggle('active', k === cur));
  els.dots.forEach((d, k) => d.classList.toggle('cur', k === cur));
  els.counter.textContent = (cur + 1) + ' / ' + DECK.length;
  els.btnPrev.disabled = cur === 0;
  els.btnNext.disabled = cur === DECK.length - 1;
}
// 手动翻页：连播中从新页继续按节奏播，未播则普通跳页
function go(i) { playing ? playFrom(i) : show(i); }

// ── sequential play engine ────────────────────────────────────────────────
// Walks a scene's actions in order: spotlight pairs light up their canvas
// element while the following speech plays; speech with audio plays through,
// missing audio pauses briefly; auto-advances to the next scene at the end.
function rowEl(si, ai) {
  return els.wraps[si]?.querySelector('[data-ai="' + ai + '"]');
}
function clearLights(wrap) {
  wrap?.querySelectorAll('.spot-active').forEach((n) => n.classList.remove('spot-active'));
  wrap?.querySelectorAll('.step.now').forEach((n) => n.classList.remove('now'));
}
function lightTarget(si, elementId) {
  const wrap = els.wraps[si];
  const node = wrap?.querySelector('[data-el="' + (elementId || '') + '"]');
  if (node) node.classList.add('spot-active');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function playFrom(si) {
  stopPlay();                 // cancel any running sequence cleanly…
  const token = ++playToken;  // …then this run owns the token
  playing = true;
  els.btnPlay.textContent = '⏸ 暂停连播';
  for (let i = si; i < DECK.length; i++) {
    if (token !== playToken) return;
    if (cur !== i) show(i, { keepPlay: true });
    const wrap = els.wraps[i];
    const actions = DECK[i].actions;
    // spotlights buffered directly before the next speech light up with it
    let pending = [];
    for (let a = 0; a < actions.length; a++) {
      if (token !== playToken) return;
      const act = actions[a];
      clearLights(wrap);
      rowEl(i, a)?.classList.add('now');
      rowEl(i, a)?.scrollIntoView({ block: 'nearest' });
      if (act.type === 'spotlight') { pending.push(act.elementId); await sleep(500); continue; }
      if (act.type !== 'speech') { await sleep(300); continue; }
      pending.forEach((id) => lightTarget(i, id));
      pending = [];
      if (act.audioRef) {
        els.player.src = act.audioRef.replace(/^audio\\//, '../audio/');
        let played = false;
        try { await els.player.play(); played = true; } catch (e) { /* autoplay denied */ }
        if (played) {
          await new Promise((resolve) => {
            const done = () => { cleanup(); resolve(); };
            const cleanup = () => {
              els.player.removeEventListener('ended', done);
              els.player.removeEventListener('error', done);
              els.player.removeEventListener('pause', done);
            };
            els.player.addEventListener('ended', done);
            els.player.addEventListener('error', done);
            els.player.addEventListener('pause', done); // stopPlay() pauses → unblock
          });
        } else {
          // autoplay denied (programmatic entry): pace by the known duration
          await sleep(act.duration ? act.duration * 1000 : 1500);
        }
      } else {
        await sleep(1200); // missing audio: give the line a beat
      }
      if (token !== playToken) return;
    }
    clearLights(wrap);
    await sleep(600);
  }
  stopPlay();
  show(0);
}
function stopPlay() {
  playToken++;
  playing = false;
  els.player.pause();
  els.btnPlay.textContent = '▶ 连播本课';
  els.wraps.forEach(clearLights);
}

els.btnPrev.onclick = () => go(cur - 1);
els.btnNext.onclick = () => go(cur + 1);
els.btnPlay.onclick = () => { playing ? stopPlay() : playFrom(cur); };
els.btnPanel.onclick = () => {
  document.body.classList.toggle('panel-hidden');
  els.btnPanel.textContent = document.body.classList.contains('panel-hidden') ? '显示讲稿' : '隐藏讲稿';
};
els.dots.forEach((d) => (d.onclick = () => go(Number(d.dataset.go))));
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { go(cur - 1); }
  else if (e.key === 'ArrowRight') { go(cur + 1); }
  else if (e.key === ' ') { e.preventDefault(); playing ? stopPlay() : playFrom(cur); }
});
show(0);
</script>
</body>
</html>
`;
}

/** @param {any} scene @param {number} index */
function renderScene(scene, index) {
  const parts = [];
  parts.push(
    `<div class="scene-wrap" id="scene-${index}">`,
    `<div class="canvas-card"><div class="stage-wrap2"><div class="canvas">${scene.type === 'slide' && scene.content?.canvas ? renderCanvas(scene.content.canvas) : renderNonSlide(scene)}`,
    `</div></div></div>`,
  );
  // speech panel (always rendered — quiz/pbl pages get their content in it too)
  const actions = scene.actions ?? [];
  const rows = actions
    .map((/** @type {any} */ a, /** @type {number} */ ai) => {
      if (a.type === 'speech') {
        const cls = a.audioRef ? 'speech' : 'speech missing';
        const dur = a.audioRef && a.duration ? `<span class="dur">${a.duration.toFixed(1)}s</span>` : '';
        return `<div class="step ${cls}" data-ai="${ai}"><span class="idx">${ai + 1}</span><div class="txt">${escapeHtml(String(a.text ?? ''))}</div>${dur}</div>`;
      }
      if (a.type === 'spotlight') {
        return `<div class="step spot" data-ai="${ai}"><span class="idx">${ai + 1}</span><div>🎯 → <code>${escapeHtml(String(a.elementId ?? ''))}</code></div></div>`;
      }
      return `<div class="step raw" data-ai="${ai}"><span class="idx">${ai + 1}</span><div>${escapeHtml(JSON.stringify(a))}</div></div>`;
    })
    .join('');
  parts.push(
    `<div class="panel"><div class="panel-head"><span class="no">${index}</span><span class="type">${scene.type}</span><span class="t">${escapeHtml(String(scene.title ?? ''))}</span></div>`,
    (scene.type === 'quiz' || scene.type === 'pbl') ? `<div class="extra">${scene.type === 'quiz' ? renderQuiz(scene.content) : renderPbl(scene.content)}</div>` : '',
    actions.length ? `<div class="timeline">${rows}</div>` : `<div class="timeline" style="color:#94a3b8;font-size:12px;padding:12px;">（本页无讲稿动作）</div>`,
    `</div></div>`,
  );
  return parts.join('\n');
}

/** quiz/pbl 内容渲染进画布区（面板里是讲稿/题目区） */
function renderNonSlide(scene) {
  if (scene.type === 'quiz') {
    return `<div style="position:absolute;inset:0;overflow:auto;padding:24px;">${renderQuiz(scene.content)}</div>`;
  }
  if (scene.type === 'pbl') {
    return `<div style="position:absolute;inset:0;overflow:auto;padding:24px;">${renderPbl(scene.content)}</div>`;
  }
  return '';
}

/**
 * Approximate PPTist canvas render at NATIVE 1000×562.5 coordinates (the
 * parent .canvas scales everything uniformly via transform, so inline
 * font-sizes shrink with the boxes — no wrap/overflow drift). Text passes
 * through as real HTML, shapes as filled boxes, images as <img>, tables as
 * HTML tables, code as a dark <pre>, lines as SVG. Each element carries
 * data-el for spotlight lighting.
 * @param {any} canvas
 */
function renderCanvas(canvas) {
  /** @type {string[]} */
  const out = [];
  /** @type {{x1:number,y1:number,x2:number,y2:number,color:string,width:number}[]} */
  const lines = [];
  for (const el of canvas.elements ?? []) {
    const box = `left:${el.left}px;top:${el.top}px;width:${el.width}px;height:${el.height ?? 40}px;`;
    const tag = `data-el="${escapeAttr(String(el.id ?? ''))}"`;
    if (el.type === 'text') {
      out.push(`<div ${tag} style="${box}">${el.content ?? ''}</div>`);
    } else if (el.type === 'shape') {
      out.push(`<div ${tag} style="${box}background:${fillOf(el)};${borderOf(el)}${radiusOf(el)}"></div>`);
    } else if (el.type === 'image') {
      const src = String(el.src ?? '');
      if (src.startsWith('data:')) out.push(`<img ${tag} style="${box}" src="${src}">`);
      else out.push(`<div class="ph" ${tag} style="${box}">image（外部引用）</div>`);
    } else if (el.type === 'line') {
      lines.push({
        x1: Number(el.start?.[0] ?? 0), y1: Number(el.start?.[1] ?? 0),
        x2: Number(el.end?.[0] ?? 0), y2: Number(el.end?.[1] ?? 0),
        color: lineColor(el), width: Number(el.style?.width ?? 2),
      });
    } else if (el.type === 'table') {
      out.push(renderTable(el, box, tag));
    } else if (el.type === 'code') {
      const fs = el.fontSize ?? 14;
      const codeLines = (el.lines ?? []).map((/** @type {{content: string}} */ l) => escapeHtml(l.content ?? ''));
      out.push(
        `<pre ${tag} style="${box}margin:0;padding:8px 10px;background:#0f172a;color:#e2e8f0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:${fs}px;line-height:1.55;overflow:hidden;border-radius:4px;white-space:pre;">${codeLines.join('\n')}</pre>`,
      );
    } else {
      out.push(`<div class="ph" ${tag} style="${box}">${el.type}</div>`);
    }
  }
  if (lines.length > 0) {
    const svg = lines
      .map((l) => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${l.color}" stroke-width="${l.width}"/>`)
      .join('');
    out.push(`<svg style="left:0;top:0;width:1000px;height:562.5px;pointer-events:none;" viewBox="0 0 1000 562.5">${svg}</svg>`);
  }
  return out.join('');
}

/** @param {any} el @param {string} box @param {string} tag */
function renderTable(el, box, tag) {
  const rows = (el.data ?? [])
    .map((/** @type {any[]} */ row) => `<tr>${row.map((c) => `<td>${c?.text ?? ''}</td>`).join('')}</tr>`)
    .join('');
  return `<table ${tag} style="${box}border-collapse:collapse;font-size:12px;" border="1">${rows}</table>`;
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
        : '<span style="color:#b45309;font-size:12px;">（简答/无标准答案）</span>';
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
    ${(p.milestones ?? []).map((/** @type {any} */ m) => `<p><b>${escapeHtml(m.title ?? '')}</b> — ${escapeHtml(m.completionCriteria ?? '')}</p>`).join('')}
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
function lineColor(el) {
  const c = el.style?.color ?? el.color;
  return typeof c === 'string' ? c : '#94a3b8';
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** @param {string} s */
function encodeAttr(s) {
  return escapeHtml(s);
}
function escapeAttr(s) { return escapeHtml(s); }

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
  console.log(`✓ ${path.relative(process.cwd(), file)}（${manifest['scenes'].length} 场景 · ${audioCount} 音频 · 翻页/连播模式 · ${(html.length / 1024).toFixed(0)}KB）`);
  console.log(`  打开审片: open ${file}  （←/→ 翻页 · Space 连播）`);
}
