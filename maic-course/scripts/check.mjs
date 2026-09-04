#!/usr/bin/env node
/**
 * check.mjs — three-layer validation of a course project, run standalone or
 * as build's gate.
 *
 *   L1  DSL contract     vendored @openmaic/dsl: validateScene (hydrated),
 *                        validateAction per action, validatePBLContent.
 *   L2  Document lint    cross-reference integrity the DSL cannot see:
 *                        audioRef ↔ audio/ files, spotlight.elementId ↔ canvas
 *                        elements, mediaIndex ↔ files, canvas HTML whitelist,
 *                        geometry bounds, lock orphans.
 *   L3  Import rehearsal a faithful replay of what the platform's
 *                        use-import-classroom will accept/reject.
 *
 * Usage:
 *   node scripts/check.mjs <courseDir> [--quiet]
 *
 * Exit code 1 when any error-severity finding exists.
 */
import { existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from './lib/course.mjs';
import { compileCourse } from './compile.mjs';
import { loadDsl, loadConfig } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';

/** @typedef {{ layer: 'L1'|'L2'|'L3', severity: 'error'|'warning'|'info', location: string, message: string }} Finding */

const isMain = isMainModule(import.meta.url);

/** Tags / style properties observed in real platform exports (calibrated on the 00.Agent sample). */
const HTML_TAG_ALLOWLIST = new Set(['p', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'sub', 'sup']);
const STYLE_PROP_ALLOWLIST = new Set([
  'font-size', 'text-align', 'color', 'text-decoration', 'font-weight', 'font-family',
  'line-height', 'letter-spacing', 'text-indent', 'background-color', 'margin', 'margin-top',
  'margin-bottom', 'padding', 'padding-top', 'padding-bottom',
]);

const VIEWPORT_W = 1000;
const VIEWPORT_H = 562.5;

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
 * Canvas hygiene: HTML allowlist + geometry bounds.
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
    }
    if (typeof el.left === 'number' && typeof el.top === 'number') {
      const w = typeof el.width === 'number' ? el.width : 0;
      const h = typeof el.height === 'number' ? el.height : 0;
      if (el.left < 0 || el.top < 0 || el.left + w > VIEWPORT_W + 5 || el.top + h > VIEWPORT_H + 5) {
        findings.push({ layer: 'L2', severity: 'warning', location: elWhere, message: `element box (${el.left},${el.top},${w}×${h}) outside the ${VIEWPORT_W}×${VIEWPORT_H} canvas` });
      }
    }
  }
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
