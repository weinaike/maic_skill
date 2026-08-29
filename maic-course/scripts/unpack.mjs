#!/usr/bin/env node
/**
 * unpack.mjs — .maic.zip → course source project.
 *
 * The inverse of compile: opens a platform export, rebuilds the editable
 * source tree (course.yaml, scenes/*.md, voice.lock.yaml, media.lock.yaml) and
 * copies the media bytes. Scene actions fold into the 讲稿 section:
 * consecutive spotlights directly before a speech collapse into `@[elementId]`
 * annotations; everything else splices through as raw-action comments, so no
 * original action is lost.
 *
 * Usage:
 *   node scripts/unpack.mjs <course.maic.zip> <outDir> [--force]
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { stringifyYaml } from './lib/yaml.mjs';
import { serializeSceneMd } from './lib/scene.mjs';
import { audioKey } from './lib/hash.mjs';

const args = process.argv.slice(2);
if (args.length < 2 || args[0] === '--help') {
  console.log('usage: node scripts/unpack.mjs <course.maic.zip> <outDir> [--force]');
  process.exit(0);
}
const [zipPath, outArg] = args;
const force = args.includes('--force');
const outDir = path.resolve(outArg);

if (existsSync(outDir) && readdirSync(outDir).length > 0 && !force) {
  console.error(`✗ ${outDir} is not empty (use --force to overwrite)`);
  process.exit(1);
}

// 1. Extract.
const tmp = mkdtempSync(path.join(tmpdir(), 'maic-unpack-'));
const unzip = spawnSync('unzip', ['-q', '-o', path.resolve(zipPath), '-d', tmp], { stdio: 'pipe' });
if (unzip.status !== 0) {
  console.error(`✗ unzip failed: ${unzip.stderr.toString().trim()}`);
  process.exit(1);
}
const manifestPath = path.join(tmp, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('✗ manifest.json not found in ZIP — not a .maic.zip course');
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

/** @type {any} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!manifest.stage || !Array.isArray(manifest.scenes)) {
  console.error('✗ manifest missing stage/scenes — not a valid course export');
  process.exit(1);
}

/** @type {string[]} */
const warnings = [];

// 2. course.yaml — voice defaults derived from the audio majority so that
// compile-time audioKey(text, voice, speed) matches the lock written below.
const audioEntries = Object.entries(manifest.mediaIndex ?? {}).filter(
  ([ref, entry]) => entry.type === 'audio',
);
const voiceCounts = new Map();
for (const [, entry] of audioEntries) {
  const v = entry.voice ?? '';
  voiceCounts.set(v, (voiceCounts.get(v) ?? 0) + 1);
}
let majorityVoice = '';
let best = -1;
for (const [v, n] of voiceCounts) if (n > best) { best = n; majorityVoice = v; }
if (!majorityVoice) majorityVoice = '';
const courseSpeed = 1.0;

/** @type {Record<string, unknown>} */
const courseYaml = {
  name: manifest.stage.name ?? 'Untitled Course',
  createdAt: manifest.stage.createdAt ?? Date.now(),
  updatedAt: manifest.stage.updatedAt ?? Date.now(),
};
if ('description' in manifest.stage) courseYaml['description'] = manifest.stage.description ?? '';
if (manifest.stage.language !== undefined) courseYaml['language'] = manifest.stage.language;
if (manifest.stage.style !== undefined) courseYaml['style'] = manifest.stage.style;
if (manifest.stage.videoManifest !== undefined) courseYaml['videoManifest'] = manifest.stage.videoManifest;
if (manifest.appVersion !== undefined) courseYaml['appVersion'] = manifest.appVersion;
courseYaml['voice'] = { voice: majorityVoice || undefined, speed: courseSpeed };

mkdirSync(path.join(outDir, 'scenes'), { recursive: true });
writeFileSync(path.join(outDir, 'course.yaml'), stringifyYaml(cleanYaml(courseYaml), 'course metadata — edited by humans/agents; secrets never live here'));

// 3. agents.json passthrough.
if (Array.isArray(manifest.agents) && manifest.agents.length > 0) {
  writeFileSync(path.join(outDir, 'agents.json'), JSON.stringify(manifest.agents, null, 2) + '\n');
}

// 4. Scenes → markdown, folding speech/spotlight runs into 讲稿 blocks.
/** @type {Record<string, Record<string, unknown>>} */
const voiceLock = {};
const refToText = new Map(); // audioRef → first speech text (for lock keys)
const refToSpeed = new Map(); // audioRef → action speed (default 1)

const orderedScenes = [...manifest.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
orderedScenes.forEach((/** @type {any} */ scene, /** @type {number} */ index) => {
  const title = String(scene.title ?? `场景${index + 1}`);
  const type = String(scene.type ?? 'slide');
  /** @type {import('./lib/scene.mjs').SpeechBlock | import('./lib/scene.mjs').RawBlock[]} */
  const speech = [];
  /** @type {{kind:'speech',text:string,spotlights:string[]}|{kind:'raw',action:Record<string,unknown>}[]} */
  const blocks = [];
  /** @type {string[]} */
  let spotlightBuffer = [];
  for (const action of scene.actions ?? []) {
    if (action.type === 'spotlight' && typeof action.elementId === 'string') {
      spotlightBuffer.push(action.elementId);
      continue;
    }
    if (action.type === 'speech' && typeof action.text === 'string') {
      blocks.push({ kind: 'speech', text: action.text, spotlights: spotlightBuffer });
      spotlightBuffer = [];
      if (typeof action.audioRef === 'string') {
        if (!refToText.has(action.audioRef)) refToText.set(action.audioRef, action.text);
        refToSpeed.set(action.audioRef, typeof action.speed === 'number' ? action.speed : 1);
      }
      continue;
    }
    // Any other action (laser / wb_* / discussion / widget_* / play_video / …)
    // splices through verbatim.
    blocks.push({ kind: 'raw', action });
  }
  for (const leftover of spotlightBuffer) {
    blocks.push({ kind: 'raw', action: { type: 'spotlight', elementId: leftover } });
  }
  speech.push(...blocks);

  const md = serializeSceneMd({
    type, title, speech,
    canvas: scene.content?.type === 'slide' ? scene.content.canvas : undefined,
    quiz: scene.content?.type === 'quiz' ? { questions: scene.content.questions ?? [] } : undefined,
    rawContent: type === 'pbl' || type === 'interactive' ? scene.content : undefined,
    whiteboards: scene.whiteboards,
    multiAgent: scene.multiAgent
      ? {
          enabled: scene.multiAgent.enabled ?? false,
          agentIndices: scene.multiAgent.agentIndices ?? [],
          ...(scene.multiAgent.directorPrompt !== undefined
            ? { directorPrompt: scene.multiAgent.directorPrompt }
            : {}),
        }
      : undefined,
  });
  const fileName = `${String(index + 1).padStart(2, '0')}-${safeTitle(title)}.md`;
  writeFileSync(path.join(outDir, 'scenes', fileName), md);
});

// 5. voice.lock.yaml — key = audioKey(text, majorityVoice, speed) so compile
// lookups hit; the entry itself records the real synthesized voice.
for (const [ref, entry] of audioEntries) {
  if (entry.missing) continue;
  const text = refToText.get(ref);
  const lockEntry = {
    file: ref,
    format: entry.format ?? 'mp3',
    ...(entry.duration !== undefined ? { duration: entry.duration } : {}),
    ...(entry.voice ? { voice: entry.voice } : {}),
  };
  if (text === undefined) {
    voiceLock[`orphan:${ref}`] = lockEntry; // audio present but unreferenced
    warnings.push(`orphan audio (no speech references it): ${ref}`);
    continue;
  }
  const key = audioKey(text, majorityVoice, refToSpeed.get(ref) ?? courseSpeed);
  if (voiceLock[key]) warnings.push(`duplicate speech text collapses audio cache: ${ref}`);
  else voiceLock[key] = lockEntry;
}
writeFileSync(
  path.join(outDir, 'voice.lock.yaml'),
  stringifyYaml(voiceLock, 'voice.lock — TTS cache: audioKey(text|voice|speed) → synthesized file. Managed by the voice module.'),
);

// 6. media.lock.yaml from mediaIndex non-audio entries.
/** @type {Record<string, Record<string, unknown>>} */
const mediaLock = {};
for (const [ref, entry] of Object.entries(manifest.mediaIndex ?? {})) {
  if (entry.type === 'audio') continue;
  const basename = ref.split('/').pop();
  if (!basename) continue;
  mediaLock[basename] = {
    type: entry.type ?? 'image',
    ...(entry.mimeType ? { mimeType: entry.mimeType } : {}),
    ...(entry.size !== undefined ? { size: entry.size } : {}),
    ...(entry.prompt ? { prompt: entry.prompt } : {}),
  };
}
if (Object.keys(mediaLock).length > 0) {
  writeFileSync(
    path.join(outDir, 'media.lock.yaml'),
    stringifyYaml(mediaLock, 'media.lock — media file metadata for the ZIP mediaIndex. Managed by unpack/media tools.'),
  );
}

// 7. Copy media bytes.
for (const dirName of ['audio', 'media']) {
  const src = path.join(tmp, dirName);
  if (existsSync(src)) {
    mkdirSync(path.join(outDir, dirName), { recursive: true });
    cpSync(src, path.join(outDir, dirName), { recursive: true });
  }
}
rmSync(tmp, { recursive: true, force: true });

console.log(`✓ unpacked → ${outDir}`);
console.log(`  scenes: ${orderedScenes.length} | audio: ${audioEntries.length} | media: ${Object.keys(mediaLock).length}`);
console.log(`  voice: ${majorityVoice || '(none)'} | agents: ${(manifest.agents ?? []).length}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);

/**
 * @param {Record<string, unknown>} obj — drop undefined values (yaml writer)
 */
function cleanYaml(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

/** @param {string} title */
function safeTitle(title) {
  const cleaned = title.replace(/[\\/:*?"<>|#\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return cleaned || 'untitled';
}
