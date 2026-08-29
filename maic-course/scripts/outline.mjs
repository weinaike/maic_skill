#!/usr/bin/env node
/**
 * outline.mjs — the outline (大纲) artifact's mechanical half.
 *
 * outline.md is the structural source of truth a human confirms (门1) before
 * the generate module expands it into scene files. This tool lints its
 * structure and can sync a skeleton back from existing scenes (for unpacked
 * platform courses).
 *
 *   node scripts/outline.mjs lint <courseDir>
 *   node scripts/outline.mjs sync <courseDir> [--force]
 *
 * lint errors: exit 1 (blocks 门1).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from './lib/course.mjs';
import { audioKey } from './lib/hash.mjs';
import { isMainModule } from './lib/main.mjs';

const isMain = isMainModule(import.meta.url);

/** Section header: `## 3. 标题 · slide · 2min` */
const SECTION_RE = /^##\s+(\d+)\.\s+(.+?)\s*·\s*(slide|quiz|pbl|interactive)\s*·\s*([\d.]+)\s*min\s*$/;

/** @typedef {{ n: number, title: string, type: string, minutes: number, bullets: string[], canvasIntent?: string, speechIntent?: string, quizIntent?: string, line: number }} OutlineSection */

/**
 * Parse outline.md → { frontmatter, sections, parseErrors }
 * @param {string} text
 */
export function parseOutline(text) {
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  /** @type {Record<string, unknown>} */
  const frontmatter = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const idx = line.indexOf(': ');
      const colon = idx >= 0 ? idx : line.endsWith(':') ? line.length - 1 : -1;
      if (colon < 0) continue;
      frontmatter[line.slice(0, colon).trim()] = scalar(line.slice(colon + 1).trim());
    }
  }
  /** @type {OutlineSection[]} */
  const sections = [];
  /** @type {string[]} */
  const parseErrors = [];
  let current = null;
  let lastKey = '';
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(SECTION_RE);
    if (m) {
      current = {
        n: Number.parseInt(m[1], 10),
        title: m[2],
        type: m[3],
        minutes: Number.parseFloat(m[4]),
        bullets: [],
        line: i + 1,
      };
      sections.push(current);
      lastKey = '';
      return;
    }
    if (!current) return;
    if (/^要点：\s*$/.test(line.trim())) { lastKey = 'bullets'; return; }
    const intent = line.match(/^(画布意图|讲稿意图|quiz 意图)：\s*(.*)$/);
    if (intent) {
      lastKey = intent[1];
      const value = intent[2].trim();
      if (lastKey === '画布意图') current.canvasIntent = value;
      if (lastKey === '讲稿意图') current.speechIntent = value;
      if (lastKey === 'quiz 意图') current.quizIntent = value;
      return;
    }
    const bullet = line.match(/^- (.+)$/);
    if (bullet && lastKey === 'bullets') {
      current.bullets.push(bullet[1].trim());
    }
  });
  return { frontmatter, sections, parseErrors };
}

/**
 * Lint outline.md against the course project.
 * @param {string} courseDir
 * @returns {{ errors: {location: string, message: string}[], warnings: {location: string, message: string}[] }}
 */
export function lintOutline(courseDir) {
  /** @type {{location: string, message: string}[]} */
  const errors = [];
  /** @type {{location: string, message: string}[]} */
  const warnings = [];
  const outlinePath = path.join(courseDir, 'outline.md');
  if (!existsSync(outlinePath)) {
    return { errors: [{ location: 'outline.md', message: 'missing — run the outline workflow or `outline.mjs sync`' }], warnings };
  }
  const { frontmatter, sections } = parseOutline(readFileSync(outlinePath, 'utf8'));

  for (const field of ['course', 'audience', 'goal']) {
    if (!frontmatter[field]) errors.push({ location: `outline.md frontmatter`, message: `${field} missing` });
  }
  const total = Number(frontmatter['totalMinutes']);
  if (!Number.isFinite(total) || total <= 0) errors.push({ location: 'outline.md frontmatter', message: 'totalMinutes must be a positive number' });
  if (sections.length === 0) errors.push({ location: 'outline.md', message: 'no `## N. 标题 · type · Xmin` sections' });

  // numbering continuity
  sections.forEach((s, i) => {
    if (s.n !== i + 1) errors.push({ location: `outline.md L${s.line}`, message: `scene numbering broken: expected ${i + 1}, got ${s.n}` });
    if (!(s.minutes > 0) || s.minutes > 10) warnings.push({ location: `outline.md §${s.n}`, message: `时长预算 ${s.minutes}min 异常（合理区间 0.5–6）` });
    if (s.bullets.length === 0) errors.push({ location: `outline.md §${s.n} ${s.title}`, message: '要点 list empty' });
    if (s.type === 'slide' && !s.canvasIntent) warnings.push({ location: `outline.md §${s.n} ${s.title}`, message: 'slide 缺 画布意图' });
    if (s.type === 'quiz' && !s.quizIntent) warnings.push({ location: `outline.md §${s.n} ${s.title}`, message: 'quiz 缺 quiz 意图（题目方向）' });
  });

  // pacing budget
  if (Number.isFinite(total) && sections.length > 0) {
    const sum = sections.reduce((acc, s) => acc + s.minutes, 0);
    if (Math.abs(sum - total) / total > 0.2) {
      warnings.push({ location: 'outline.md', message: `各页时长合计 ${sum.toFixed(1)}min 与 totalMinutes ${total} 偏差 >20%` });
    }
  }
  // quiz density (advisory)
  const teachScenes = sections.filter((s) => s.type !== 'quiz');
  if (teachScenes.length >= 6 && !sections.some((s) => s.type === 'quiz')) {
    warnings.push({ location: 'outline.md', message: `${teachScenes.length} 个教学页无 quiz 布点` });
  }

  // cross-check against existing scene files
  const project = readCourse(courseDir);
  const byPrefix = new Map(project.scenes.map((s) => [s.orderPrefix, s]));
  for (const s of sections) {
    const sceneFile = byPrefix.get(s.n);
    if (!sceneFile) continue;
    const fileType = String(sceneFile.frontmatter['type'] ?? 'slide');
    if (fileType !== s.type) errors.push({ location: `outline.md §${s.n} ↔ ${sceneFile.file}`, message: `type 不一致：outline=${s.type}, scene=${fileType}` });
    const fileTitle = String(sceneFile.frontmatter['title'] ?? '');
    if (fileTitle && fileTitle !== s.title) warnings.push({ location: `outline.md §${s.n} ↔ ${sceneFile.file}`, message: `标题漂移：outline="${s.title}", scene="${fileTitle}"` });
  }
  for (const sceneFile of project.scenes) {
    if (!sections.some((s) => s.n === sceneFile.orderPrefix)) {
      warnings.push({ location: sceneFile.file, message: '场景文件未纳入大纲（outline 缺该节）' });
    }
  }
  return { errors, warnings };
}

/**
 * Sync a skeleton outline.md from existing scenes (durations from real audio
 * when the voice lock has them, else ~240 chars/min 讲稿估算).
 * @param {string} courseDir
 */
export function syncOutline(courseDir) {
  const project = readCourse(courseDir);
  const lines = [
    '---',
    `course: ${yamlScalar(String(project.course['name'] ?? 'Untitled'))}`,
    'audience: （待补：目标受众）',
    'goal: （待补：一句话课程目标）',
    `totalMinutes: 0`,
    `style: ${yamlScalar(String(project.course['style'] ?? 'professional'))}`,
    `voice: ${yamlScalar(String(project.voice.voice ?? ''))}`,
    '---',
    '',
  ];
  let totalMinutes = 0;
  const sections = project.scenes.map((scene) => {
    const type = String(scene.frontmatter['type'] ?? 'slide');
    const title = String(scene.frontmatter['title'] ?? scene.file);
    let seconds = 0;
    let knownAudio = 0;
    let speechChars = 0;
    for (const block of scene.speech) {
      if (block.kind !== 'speech') continue;
      speechChars += block.text.length;
      const entry = project.voiceLock[audioKey(block.text, project.voice.voice, project.voice.speed)];
      if (entry && typeof entry['duration'] === 'number') {
        seconds += Number(entry['duration']);
        knownAudio++;
      }
    }
    const estimated = seconds > 0 ? seconds / 60 : Math.max(0.4, speechChars / 240);
    const minutes = Math.max(0.5, Math.round(estimated * 2) / 2);
    totalMinutes += minutes;
    return { scene, type, title, minutes, speechChars, knownAudio, seconds };
  });

  for (const s of sections) {
    const { scene } = s;
    lines.push(`## ${scene.orderPrefix}. ${s.title} · ${s.type} · ${s.minutes}min`, '', '要点：');
    const bullets = deriveBullets(scene, s);
    for (const b of bullets) lines.push(`- ${b}`);
    if (s.type === 'slide') {
      const census = elementCensus(scene.canvas);
      lines.push('', `画布意图：${census}`);
    }
    const durHint = s.knownAudio > 0 ? `（实际音频 ${s.seconds.toFixed(0)}s）` : '（按讲稿字数估算）';
    lines.push(`讲稿意图：${s.speechChars} 字 · 约 ${s.minutes}min${durHint}`);
    if (s.type === 'quiz') {
      const n = Array.isArray(scene.quiz?.['questions']) ? scene.quiz['questions'].length : 0;
      lines.push(`quiz 意图：${n} 题（sync 仅计数——补题目方向与考点）`);
    }
    lines.push('');
  }
  lines[4] = `totalMinutes: ${Math.round(totalMinutes)}`;
  writeFileSync(path.join(courseDir, 'outline.md'), lines.join('\n') + '\n');
  return { scenes: sections.length, totalMinutes: Math.round(totalMinutes) };
}

/**
 * Derive starter bullets from the scene's own content (canvas text snippets /
 * quiz count / pbl description). Sync bullets are hints to enrich, not finals.
 */
function deriveBullets(scene, s) {
  /** @type {string[]} */
  const bullets = [];
  if (s.type === 'quiz') {
    const questions = Array.isArray(scene.quiz?.['questions']) ? scene.quiz['questions'] : [];
    for (const q of questions.slice(0, 3)) {
      bullets.push(plainText(String(q['question'] ?? '')).slice(0, 50) || '（题目）');
    }
    if (questions.length > 3) bullets.push(`…共 ${questions.length} 题`);
    if (bullets.length === 0) bullets.push('（待补：考点）');
    return bullets;
  }
  const texts = (scene.canvas?.['elements'] ?? [])
    .filter((/** @type {any} */ el) => el['type'] === 'text')
    .flatMap((/** @type {any} */ el) => plainText(String(el['content'] ?? '')).split('•'))
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const t of texts.slice(0, 4)) {
    bullets.push(t.slice(0, 46));
  }
  if (s.type === 'pbl') {
    const desc = scene.rawContent?.['projectV2']?.['description'];
    if (typeof desc === 'string' && desc) bullets.push(desc.slice(0, 60));
  }
  if (bullets.length === 0) bullets.push('（待补：本页要点）');
  return bullets;
}

/** @param {unknown} canvas */
function elementCensus(canvas) {
  const elements = (canvas?.['elements'] ?? []);
  if (!Array.isArray(elements) || elements.length === 0) return '（画布为空——待生成）';
  const counts = {};
  for (const el of elements) counts[el['type']] = (counts[el['type']] ?? 0) + 1;
  const parts = Object.entries(counts).map(([t, n]) => `${n} ${t}`);
  return `${elements.length} 元素（${parts.join(' / ')}）——sync 概览，改写为版式意图`;
}

/** @param {string} html */
function plainText(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** @param {string} s */
function yamlScalar(s) {
  return /[:#]/.test(s) || /^\s|\s$/.test(s) || /^[-?[\]{},&*!|>'"%@`]/.test(s) || s === '' ? JSON.stringify(s) : s;
}

/** @param {string} s */
function scalar(s) {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const courseDir = path.resolve(args[1] ?? '.');
  if (cmd === 'lint') {
    const { errors, warnings } = lintOutline(courseDir);
    for (const e of errors) console.error(`  ✗ ${e.location} — ${e.message}`);
    for (const w of warnings) console.log(`  ⚠ ${w.location} — ${w.message}`);
    console.log(errors.length ? `✗ outline lint: ${errors.length} error(s), ${warnings.length} warning(s)` : `✓ outline lint: ${warnings.length} warning(s)`);
    process.exit(errors.length ? 1 : 0);
  } else if (cmd === 'sync') {
    if (existsSync(path.join(courseDir, 'outline.md')) && !args.includes('--force')) {
      console.error('✗ outline.md 已存在（--force 覆盖）');
      process.exit(1);
    }
    const { scenes, totalMinutes } = syncOutline(courseDir);
    console.log(`✓ outline.md ← ${scenes} 场景，总时长 ≈ ${totalMinutes}min（要点为 sync 提示，待人/agent 充实）`);
  } else {
    console.log('usage: node scripts/outline.mjs lint|sync <courseDir>');
    process.exit(args[0] === '--help' ? 0 : 2);
  }
}
