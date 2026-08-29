#!/usr/bin/env node
/**
 * compile.mjs — course source project → ZIP manifest (build/manifest.json).
 *
 * Compile is *lossless and deterministic*: the canvas JSON, raw content and
 * raw actions pass through verbatim (no normalize — that is a check-time
 * report and a generate-time tool), ids are minted by content hash so an
 * unchanged source always compiles to an identical manifest.
 *
 * Usage:
 *   node scripts/compile.mjs <courseDir> [--out build] [--stdout]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse, stageFromCourse, appVersionOf } from './lib/course.mjs';
import { audioKey, actionId } from './lib/hash.mjs';
import { loadConfig } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';

const SCENE_TYPES = new Set(['slide', 'quiz', 'pbl', 'interactive']);

/**
 * Compile a course project into a manifest object + compile notes.
 * @param {import('./lib/course.mjs').CourseProject} project
 * @param {{ manifestFormatVersion?: number, manifestAppVersion?: string }} [config]
 */
export function compileCourse(project, config = {}) {
  /** @type {{ audioMisses: {scene: string, text: string}[], unknownScenes: string[], emptyCanvas: string[] }} */
  const notes = { audioMisses: [], unknownScenes: [], emptyCanvas: [] };
  const formatVersion = config.manifestFormatVersion ?? 1;
  const appVersionDefault = config.manifestAppVersion ?? '0.0.0';

  /** @type {Record<string, unknown>[]} */
  const manifestScenes = [];
  /** @type {string[]} */
  const usedAudioRefs = [];

  for (const scene of project.scenes) {
    const type = String(scene.frontmatter['type'] ?? 'slide');
    if (!SCENE_TYPES.has(type)) notes.unknownScenes.push(scene.file);
    const title = String(scene.frontmatter['title'] ?? scene.file.replace(/^\d+-/, '').replace(/\.md$/, ''));

    // --- content ---
    /** @type {Record<string, unknown> | undefined} */
    let content;
    if (type === 'slide') {
      if (!scene.canvas) notes.emptyCanvas.push(scene.file);
      content = { type: 'slide', schemaVersion: 1, ...(scene.canvas ? { canvas: scene.canvas } : {}) };
    } else if (type === 'quiz') {
      content = { type: 'quiz', ...(scene.quiz && Array.isArray(scene.quiz['questions'])
        ? { questions: scene.quiz['questions'] }
        : { questions: [] }) };
    } else {
      // pbl / interactive: raw passthrough, validated by check (validatePBLContent).
      content = scene.rawContent;
      if (!content) content = { type };
    }

    // --- actions (speech paragraphs + @[spotlight] annotations + raw splices) ---
    /** @type {Record<string, unknown>[] | undefined} */
    let actions;
    if (scene.speech.length > 0) {
      const actionList = [];
      scene.speech.forEach((block, i) => {
        if (block.kind === 'raw') {
          const action = { ...block.action };
          if (!action['id']) action['id'] = actionId(scene.file, i, 'raw');
          actionList.push(action);
          return;
        }
        for (const elementId of block.spotlights) {
          actionList.push({
            id: actionId(scene.file, i, 'spotlight', elementId),
            type: 'spotlight',
            elementId,
          });
        }
        const key = audioKey(block.text, project.voice.voice, project.voice.speed);
        const lockEntry = project.voiceLock[key];
        const audioRef = typeof lockEntry?.['file'] === 'string' ? lockEntry['file'] : undefined;
        if (!audioRef) notes.audioMisses.push({ scene: scene.file, text: block.text.slice(0, 40) });
        else if (!usedAudioRefs.includes(audioRef)) usedAudioRefs.push(audioRef);
        actionList.push({
          id: actionId(scene.file, i, 'speech'),
          type: 'speech',
          text: block.text,
          ...(audioRef ? { audioRef } : {}),
        });
      });
      actions = actionList;
    }

    /** @type {Record<string, unknown>} */
    const manifestScene = { type, title, order: manifestScenes.length + 1, content };
    if (actions) manifestScene['actions'] = actions;
    if (scene.whiteboards) manifestScene['whiteboards'] = scene.whiteboards;
    if (scene.multiAgent) manifestScene['multiAgent'] = scene.multiAgent;
    manifestScenes.push(manifestScene);
  }

  // --- mediaIndex: referenced audio in first-use order, orphan lock entries,
  // then media files ---
  /** @type {Record<string, Record<string, unknown>>} */
  const mediaIndex = {};
  for (const ref of usedAudioRefs) {
    const entry = findByFile(project.voiceLock, ref);
    if (entry) mediaIndex[ref] = lockEntryToMediaIndex(entry);
  }
  for (const [key, entry] of Object.entries(project.voiceLock)) {
    if (key.startsWith('orphan:') && typeof entry['file'] === 'string') {
      mediaIndex[entry['file']] = lockEntryToMediaIndex(entry);
    }
  }
  for (const basename of [...project.mediaFiles].sort()) {
    const lock = project.mediaLock[basename] ?? {};
    const ext = basename.split('.').pop() ?? '';
    mediaIndex[`media/${basename}`] = {
      type: lock['type'] ?? (isVideoExt(ext) ? 'generated' : 'image'),
      ...(lock['mimeType'] ? { mimeType: String(lock['mimeType']) } : { mimeType: guessMime(ext) }),
      ...(lock['size'] !== undefined ? { size: Number(lock['size']) } : {}),
      ...(lock['prompt'] ? { prompt: String(lock['prompt']) } : {}),
    };
  }

  const stage = stageFromCourse(project, { appVersion: appVersionDefault });
  const manifest = {
    formatVersion,
    exportedAt: new Date().toISOString(),
    appVersion: appVersionOf(project, appVersionDefault),
    stage,
    agents: project.agents,
    scenes: manifestScenes,
    mediaIndex,
  };
  return { manifest, notes };
}

/**
 * @param {Record<string, Record<string, unknown>>} lock
 * @param {string} file
 */
function findByFile(lock, file) {
  for (const entry of Object.values(lock)) {
    if (entry['file'] === file) return entry;
  }
  return undefined;
}

/**
 * A voice.lock entry → a mediaIndex audio entry: drop the `file` field (the
 * mediaIndex key already is the zip path) and stamp the audio kind.
 * @param {Record<string, unknown>} entry
 * @returns {Record<string, unknown>}
 */
function lockEntryToMediaIndex(entry) {
  const { file, ...rest } = /** @type {{ file?: string }} */ (entry);
  void file;
  return { type: 'audio', ...rest };
}

/** @param {string} ext */
function isVideoExt(ext) {
  return ['mp4', 'webm', 'mov'].includes(ext.toLowerCase());
}

/** @param {string} ext */
function guessMime(ext) {
  const map = {
    jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// CLI (guarded so build/check can import compileCourse as a module)
// ---------------------------------------------------------------------------
const isMain = isMainModule(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('usage: node scripts/compile.mjs <courseDir> [--out build] [--stdout]');
    process.exit(0);
  }
  const courseDir = path.resolve(args[0]);
  const outIdx = args.indexOf('--out');
  const outDir = outIdx >= 0 ? args[outIdx + 1] : 'build';
  const toStdout = args.includes('--stdout');

  const project = readCourse(courseDir);
  const { manifest, notes } = compileCourse(project, loadConfig());

  if (toStdout) {
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  } else {
    const buildDir = path.isAbsolute(outDir) ? outDir : path.join(courseDir, outDir);
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✓ compiled ${manifest.scenes.length} scenes → ${path.join(buildDir, 'manifest.json')}`);
  }

  if (notes.audioMisses.length > 0) {
    console.log(`  ⚠ ${notes.audioMisses.length} speech line(s) without audio (run the voice module):`);
    for (const miss of notes.audioMisses.slice(0, 5)) console.log(`      ${miss.scene}: ${miss.text}…`);
  }
  for (const f of notes.emptyCanvas) console.log(`  ⚠ ${f}: slide scene without 画布`);
}
