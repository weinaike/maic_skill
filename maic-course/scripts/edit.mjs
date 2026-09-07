#!/usr/bin/env node
/**
 * edit.mjs — the edit module's mechanical half: the operations that are
 * fiddly by hand (renumbering, global theme injection, cascade bookkeeping)
 * plus `status`, the dependency-cascade dashboard that answers "what does my
 * edit still owe?" after any change.
 *
 * The natural-language side (理解用户指令 → 定位文件 → 改文本) is model work
 * driven by references/workflow-edit.md; this tool keeps the results consistent.
 *
 * Usage:
 *   node scripts/edit.mjs status  <courseDir>
 *   node scripts/edit.mjs move    <courseDir> <NN> <position>     # 把场景 NN 移到第 position 位
 *   node scripts/edit.mjs delete  <courseDir> <NN>                # 删场景并重排
 *   node scripts/edit.mjs insert  <courseDir> <position> --type slide --title 标题
 *   node scripts/edit.mjs theme   <courseDir> [--colors a,b,c] [--font 名] [--bg #hex] [--fontColor #hex]
 *   node scripts/edit.mjs voice   <courseDir> [--voice id] [--speed 1.1]
 *
 * status exits 1 when something still needs action (missing audio, stale
 * review, outline drift, TODO residue, check errors) — automation-friendly.
 */
import { existsSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from './lib/course.mjs';
import { compileCourse } from './compile.mjs';
import { checkCourse } from './check.mjs';
import { lintOutline } from './outline.mjs';
import { aggregateReviews } from './review.mjs';
import { pruneAudio } from './tts.mjs';
import { parseSceneMd, serializeSceneMd } from './lib/scene.mjs';
import { parseYaml, stringifyYaml } from './lib/yaml.mjs';
import { loadConfig } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';
import { readFileSync } from 'node:fs';

const isMain = isMainModule(import.meta.url);

// ---------------------------------------------------------------------------
// status — the cascade dashboard
// ---------------------------------------------------------------------------

/**
 * @param {string} courseDir
 * @returns {Promise<{ actionable: boolean, lines: string[] }>}
 */
export async function editStatus(courseDir) {
  /** @type {string[]} */
  const lines = [];
  let actionable = false;

  const project = readCourse(courseDir);
  const { manifest, notes } = compileCourse(project, loadConfig());

  // 1. 讲稿改后未重合成的句子（audioKey miss）
  if (notes.audioMisses.length > 0) {
    actionable = true;
    lines.push(`① ${notes.audioMisses.length} 句讲稿缺音频（改稿后未重合成）`);
    for (const m of notes.audioMisses.slice(0, 5)) lines.push(`     ${m.scene}: ${m.text}…`);
    if (notes.audioMisses.length > 5) lines.push(`     …共 ${notes.audioMisses.length} 句`);
    lines.push(`   → node scripts/tts.mjs ${courseDir}   # 增量：只补这些`);
  }

  // 2. 审查过期（审查后源又变更）
  const { stale } = aggregateReviews(courseDir);
  if (stale.length > 0) {
    actionable = true;
    lines.push(`② ${stale.length} 个审查目标已变更（审查失效）`);
    for (const s of stale) lines.push(`     ${s.target} ← ${s.file} 审过之后又改了`);
    lines.push(`   → 按对应 scope 重审（review-checklists.md）`);
  }

  // 3. 大纲漂移
  const outline = lintOutline(courseDir);
  if (outline.errors.length > 0 || outline.warnings.length > 0) {
    actionable = true;
    lines.push(`③ 大纲↔场景漂移：${outline.errors.length} error / ${outline.warnings.length} warning`);
    for (const e of outline.errors.slice(0, 3)) lines.push(`     ✗ ${e.location} — ${e.message}`);
    for (const w of outline.warnings.slice(0, 3)) lines.push(`     ⚠ ${w.location} — ${w.message}`);
    lines.push(`   → 更新 outline.md（或改场景文件名/标题回对齐）后 node scripts/outline.mjs lint ${courseDir}`);
  }

  // 4. 生成残留 TODO
  /** @type {string[]} */
  const todoFiles = [];
  for (const scene of project.scenes) {
    if (readFileSync(path.join(courseDir, 'scenes', scene.file), 'utf8').includes('TODO')) {
      todoFiles.push(scene.file);
    }
  }
  if (todoFiles.length > 0) {
    actionable = true;
    lines.push(`④ ${todoFiles.length} 个场景文件有 TODO 残留（生成未完成）: ${todoFiles.join(', ')}`);
  }

  // 5. 三层校验
  const findings = await checkCourse(project, manifest, notes);
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  if (errors.length > 0) {
    actionable = true;
    lines.push(`⑤ check: ${errors.length} error / ${warnings.length} warning`);
    for (const e of errors.slice(0, 3)) lines.push(`     ✗ [${e.layer}] ${e.location} — ${e.message}`);
    lines.push(`   → node scripts/check.mjs ${courseDir} 看全部`);
  }

  if (!actionable) lines.push(`✓ 无待办级联：音频齐、审查新鲜、大纲对齐、校验 0 error`);
  return { actionable, lines };
}

// ---------------------------------------------------------------------------
// move / delete / insert — renumber via two-phase rename
// ---------------------------------------------------------------------------

/** @typedef {{ prefix: number, titlePart: string, file: string }} SceneEntry */

/**
 * @param {string} scenesDir
 * @returns {{ prefix: number, titlePart: string, file: string }[]}
 */
function listScenes(scenesDir) {
  return readdirSync(scenesDir)
    .filter((f) => f.endsWith('.md') && /^\d+-/.test(f))
    .sort()
    .map((file) => {
      const m = file.match(/^(\d+)-(.+)$/);
      return { prefix: Number.parseInt(m[1], 10), titlePart: m[2], file };
    });
}

/**
 * @param {string} scenesDir
 * @param {{ prefix: number, titlePart: string }[]} order final order (index 0 → 01)
 */
function renumber(scenesDir, order) {
  // Phase 1: everything to unique temp names (avoids prefix collisions).
  order.forEach((s, i) => {
    renameSync(path.join(scenesDir, `${String(s.prefix).padStart(2, '0')}-${s.titlePart}`), path.join(scenesDir, `__tmp${i}-${s.titlePart}`));
  });
  // Phase 2: temp → final.
  order.forEach((s, i) => {
    renameSync(path.join(scenesDir, `__tmp${i}-${s.titlePart}`), path.join(scenesDir, `${String(i + 1).padStart(2, '0')}-${s.titlePart}`));
  });
}

/**
 * @param {string} courseDir
 * @param {number} nn scene number to move (1-based, current position)
 * @param {number} position target slot (1-based)
 */
export function moveScene(courseDir, nn, position) {
  const scenesDir = path.join(courseDir, 'scenes');
  const scenes = listScenes(scenesDir);
  const from = scenes.findIndex((s) => s.prefix === nn);
  if (from < 0) throw new Error(`场景 ${nn} 不存在（现有：${scenes.map((s) => s.prefix).join(',')}）`);
  const clamped = Math.max(1, Math.min(position, scenes.length));
  const picked = scenes.splice(from, 1)[0];
  scenes.splice(clamped - 1, 0, picked);
  renumber(scenesDir, scenes);
  return { from: nn, to: clamped, title: picked.titlePart };
}

/**
 * @param {string} courseDir
 * @param {number} nn
 */
export function deleteScene(courseDir, nn) {
  const scenesDir = path.join(courseDir, 'scenes');
  const scenes = listScenes(scenesDir);
  const target = scenes.find((s) => s.prefix === nn);
  if (!target) throw new Error(`场景 ${nn} 不存在`);
  rmSync(path.join(scenesDir, target.file));
  const rest = scenes.filter((s) => s.prefix !== nn);
  renumber(scenesDir, rest);
  // Its speech audio is now dead — prune it (orphan: entries stay).
  const pruned = pruneAudio(courseDir, {});
  return { deleted: target.file, pruned: pruned.pruned };
}

// insertScene is implemented inline in the CLI branch below (tail-shift + stub
// write); no standalone export needed.

// ---------------------------------------------------------------------------
// theme / voice
// ---------------------------------------------------------------------------

/**
 * Rewrite canvas theme fields across all scene files.
 * @param {string} courseDir
 * @param {{ colors?: string, font?: string, bg?: string, fontColor?: string }} options
 */
export function applyTheme(courseDir, options = {}) {
  const scenesDir = path.join(courseDir, 'scenes');
  let updated = 0;
  for (const file of readdirSync(scenesDir).filter((f) => f.endsWith('.md')).sort()) {
    const filePath = path.join(scenesDir, file);
    const scene = parseSceneMd(readFileSync(filePath, 'utf8'), file);
    if (!scene.canvas) continue;
    const theme = { ...scene.canvas['theme'] };
    if (options.colors) {
      theme['themeColors'] = options.colors.split(',').map((c) => c.trim()).filter(Boolean);
    }
    if (options.font) theme['fontName'] = options.font;
    if (options.bg) theme['backgroundColor'] = options.bg;
    if (options.fontColor) theme['fontColor'] = options.fontColor;
    const canvas = { ...scene.canvas, theme };
    writeFileSync(filePath, serializeSceneMd({
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
    updated++;
  }
  return { updated };
}

/**
 * Update course.yaml voice preferences. Cache keys embed voice+speed ⇒ this
 * invalidates ALL audio (by design — no stale-voice hits).
 * @param {string} courseDir
 * @param {{ voice?: string, speed?: number }} options
 */
export function setVoice(courseDir, options = {}) {
  const file = path.join(courseDir, 'course.yaml');
  const course = parseYaml(readFileSync(file, 'utf8'));
  const current = (typeof course['voice'] === 'object' && course['voice'] !== null ? course['voice'] : {});
  const next = {
    ...current,
    ...(options.voice ? { voice: options.voice } : {}),
    ...(options.speed !== undefined ? { speed: options.speed } : {}),
  };
  course['voice'] = next;
  writeFileSync(file, stringifyYaml(course, 'course metadata — edited by humans/agents; secrets never live here'));
  return { voice: next['voice'], speed: next['speed'] };
}

/** @param {string} title */
function safeTitle(title) {
  const cleaned = title.replace(/[\\/:*?"<>|#\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return cleaned || 'untitled';
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  try {
    if (cmd === 'status') {
      const { actionable, lines } = await editStatus(path.resolve(args[1] ?? '.'));
      for (const l of lines) console.log(l);
      process.exit(actionable ? 1 : 0);
    } else if (cmd === 'move') {
      const r = moveScene(path.resolve(args[1]), Number(args[2]), Number(args[3]));
      console.log(`✓ 场景 ${r.from}（${r.title}）移到第 ${r.to} 位，全部前缀已重排`);
    } else if (cmd === 'delete') {
      const r = deleteScene(path.resolve(args[1]), Number(args[2]));
      console.log(`✓ 删除 ${r.deleted} 并重排；清理 ${r.pruned} 条死音频`);
      console.log(`  记得同步 outline.md（status/lint 会抓漂移）`);
    } else if (cmd === 'insert') {
      const courseDir = path.resolve(args[1]);
      const position = Number(args[2]);
      const typeIdx = args.indexOf('--type');
      const titleIdx = args.indexOf('--title');
      const scenesDir = path.join(courseDir, 'scenes');
      const scenes = listScenes(scenesDir);
      const clamped = Math.max(1, Math.min(position, scenes.length + 1));
      const type = typeIdx >= 0 ? args[typeIdx + 1] : 'slide';
      const title = titleIdx >= 0 ? args[titleIdx + 1] : '新场景';
      // Shift scenes at slot..end up by one (two-phase rename), freeing the slot.
      const tail = scenes.slice(clamped - 1);
      tail.forEach((s, i) => renameSync(
        path.join(scenesDir, `${String(s.prefix).padStart(2, '0')}-${s.titlePart}`),
        path.join(scenesDir, `__tmp${i}-${s.titlePart}`),
      ));
      tail.forEach((s, i) => renameSync(
        path.join(scenesDir, `__tmp${i}-${s.titlePart}`),
        path.join(scenesDir, `${String(clamped + 1 + i).padStart(2, '0')}-${s.titlePart}`),
      ));
      const fileName = `${String(clamped).padStart(2, '0')}-${safeTitle(title)}.md`;
      writeFileSync(path.join(scenesDir, fileName), serializeSceneMd({
        type,
        title,
        speech: [{ kind: 'raw', action: { type: 'TODO', note: '待生成讲稿（workflow-generate）' } }],
        canvas: type === 'slide' ? { TODO: '按大纲画布意图选配方生成' } : undefined,
        quiz: type === 'quiz' ? { questions: [] } : undefined,
        rawContent: type === 'pbl' || type === 'interactive' ? { TODO: '待生成' } : undefined,
      }));
      console.log(`✓ 插入 scenes/${fileName}（第 ${clamped} 位），后续场景已顺延`);
      console.log(`  记得同步 outline.md 并走 workflow-generate 填充该页`);
    } else if (cmd === 'theme') {
      const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
      const r = applyTheme(path.resolve(args[1]), {
        colors: flag('--colors'), font: flag('--font'), bg: flag('--bg'), fontColor: flag('--fontColor'),
      });
      console.log(`✓ ${r.updated} 个画布主题已更新（元素内联颜色不自动改写——如需彻底换肤需逐页调整）`);
    } else if (cmd === 'voice') {
      const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
      const speed = flag('--speed');
      const r = setVoice(path.resolve(args[1]), {
        voice: flag('--voice'),
        speed: speed !== undefined ? Number(speed) : undefined,
      });
      console.log(`✓ course.yaml voice → ${r.voice} / speed ${r.speed}`);
      console.log(`  缓存键含音色与语速 ⇒ 全量重合成: node scripts/tts.mjs <dir> --force && node scripts/tts.mjs prune <dir>`);
    } else {
      console.log('usage: node scripts/edit.mjs status|move|delete|insert|theme|voice …');
      process.exit(args[0] === '--help' ? 0 : 2);
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
