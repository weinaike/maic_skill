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
 *
 * Usage:
 *   node scripts/generate.mjs scaffold <courseDir> [--scenes 3-5,8] [--force]
 *   node scripts/generate.mjs normalize <courseDir>/scenes/NN-x.md […]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOutline } from './outline.mjs';
import { parseSceneMd, serializeSceneMd } from './lib/scene.mjs';
import { loadDsl } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';

const isMain = isMainModule(import.meta.url);

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
      canvas: s.type === 'slide' ? { TODO: '按画布意图选配方生成：' + (s.canvasIntent ?? '') } : undefined,
      quiz: s.type === 'quiz' ? { questions: [] } : undefined,
      rawContent: s.type === 'pbl' || s.type === 'interactive' ? { TODO: 'pbl/interactive 内容待生成' } : undefined,
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
    } else {
      console.log('usage: node scripts/generate.mjs scaffold|normalize …');
      process.exit(args[0] === '--help' ? 0 : 2);
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
