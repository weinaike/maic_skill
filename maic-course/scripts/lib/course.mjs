/**
 * Course-project IO — one place that knows the on-disk layout of a course
 * source project, so compile / check / build / (later) tts share it.
 *
 *   <course>/
 *     course.yaml        # stage metadata + voice preferences (no secrets)
 *     agents.json?       # ManifestAgent[] (list-of-maps → JSON, not YAML)
 *     scenes/NN-*.md     # one file per scene, numeric prefix = order
 *     audio/*.mp3        # synthesized speech audio
 *     media/*            # images / generated media
 *     voice.lock.yaml    # audioKey(text|voice|speed) → {file, duration, voice, format}
 *     media.lock.yaml    # media basename → {type, mimeType, size, prompt}
 *     build/             # outputs (gitignored)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml.mjs';
import { parseSceneMd } from './scene.mjs';

/** @typedef {import('./scene.mjs').ParsedScene} ParsedScene */

/** @typedef {{
 *   dir: string,
 *   course: Record<string, unknown>,
 *   voice: { voice?: string, speed?: number },
 *   agents: Record<string, unknown>[],
 *   scenes: ParsedScene[],
 *   voiceLock: Record<string, Record<string, unknown>>,
 *   mediaLock: Record<string, Record<string, unknown>>,
 *   audioFiles: Set<string>,
 *   mediaFiles: Set<string>,
 *   warnings: string[],
 * }} CourseProject */

/**
 * Read and parse a course project.
 * @param {string} dir
 * @returns {CourseProject}
 */
export function readCourse(dir) {
  /** @type {string[]} */
  const warnings = [];
  const coursePath = path.join(dir, 'course.yaml');
  if (!existsSync(coursePath)) {
    throw new Error(`not a course project: ${coursePath} is missing`);
  }
  const course = parseYaml(readFileSync(coursePath, 'utf8'));

  const agentsPath = path.join(dir, 'agents.json');
  const agents = existsSync(agentsPath)
    ? JSON.parse(readFileSync(agentsPath, 'utf8'))
    : [];

  const voiceRaw = course['voice'];
  const voice = typeof voiceRaw === 'object' && voiceRaw !== null ? voiceRaw : {};

  // Scene files: numeric prefix defines order.
  const scenesDir = path.join(dir, 'scenes');
  const sceneFiles = existsSync(scenesDir)
    ? readdirSync(scenesDir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort()
    : [];
  if (sceneFiles.length === 0) warnings.push(`${dir}: no scene files under scenes/`);
  const scenes = sceneFiles.map((file) =>
    parseSceneMd(readFileSync(path.join(scenesDir, file), 'utf8'), file),
  );
  const seenPrefix = new Set();
  for (const scene of scenes) {
    if (!Number.isNaN(scene.orderPrefix)) {
      if (seenPrefix.has(scene.orderPrefix)) {
        warnings.push(`scenes/: duplicate order prefix ${scene.orderPrefix}`);
      }
      seenPrefix.add(scene.orderPrefix);
    }
  }

  const voiceLock = readLock(path.join(dir, 'voice.lock.yaml'));
  const mediaLock = readLock(path.join(dir, 'media.lock.yaml'));

  const audioFiles = listFiles(path.join(dir, 'audio'));
  const mediaFiles = listFiles(path.join(dir, 'media'));

  warnings.push(...scenes.flatMap((s) => s.warnings));
  return { dir, course, voice, agents, scenes, voiceLock, mediaLock, audioFiles, mediaFiles, warnings };
}

/**
 * Effective manifest stage object from course.yaml.
 * @param {CourseProject} project
 * @param {{ appVersion: string }} defaults
 */
export function stageFromCourse(project, defaults) {
  const c = project.course;
  /** @type {Record<string, unknown>} */
  const stage = {
    name: String(c['name'] ?? 'Untitled Course'),
    createdAt: Number(c['createdAt'] ?? Date.now()),
    updatedAt: Number(c['updatedAt'] ?? Date.now()),
  };
  if ('description' in c) stage['description'] = c['description'] ?? '';
  if (c['language'] !== undefined) stage['language'] = c['language'];
  if (c['style'] !== undefined) stage['style'] = c['style'];
  if (c['videoManifest'] !== undefined) stage['videoManifest'] = c['videoManifest'];
  return stage;
}

/**
 * course.yaml appVersion if set, else the skill default.
 * @param {CourseProject} project
 * @param {string} fallback
 */
export function appVersionOf(project, fallback) {
  const v = project.course['appVersion'];
  return typeof v === 'string' && v ? v : fallback;
}

/**
 * @param {string} lockPath
 * @returns {Record<string, Record<string, unknown>>}
 */
function readLock(lockPath) {
  if (!existsSync(lockPath)) return {};
  const parsed = parseYaml(readFileSync(lockPath, 'utf8'));
  /** @type {Record<string, Record<string, unknown>>} */
  const out = {};
  for (const [key, value] of Object.entries(parsed)) {
    out[key] = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  }
  return out;
}

/**
 * @param {string} dir
 * @returns {Set<string>}
 */
function listFiles(dir) {
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((f) => !f.startsWith('.')));
}
