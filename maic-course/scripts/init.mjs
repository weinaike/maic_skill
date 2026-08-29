#!/usr/bin/env node
/**
 * init.mjs — bootstrap a fresh course project (the `new` entrypoint).
 *
 * Creates the source tree from templates: course.yaml (with real timestamps),
 * scenes/ audio/ media/ dirs, and an outline.md stub carrying the interview
 * defaults. After init, the flow is: outline workflow → generate → voice →
 * build (all driven by the workflow docs).
 *
 * Usage:
 *   node scripts/init.mjs <courseDir> --name 课程名 [--audience …] [--style professional]
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} courseDir
 * @param {{ name?: string, audience?: string, style?: string, voice?: string }} options
 * @returns {{ created: string[] }}
 */
export function initCourse(courseDir, options = {}) {
  if (existsSync(courseDir) && readdirSync(courseDir).length > 0) {
    throw new Error(`${courseDir} 非空（init 只建新课程）`);
  }
  const now = Date.now();
  /** @type {string[]} */
  const created = [];

  mkdirSync(path.join(courseDir, 'scenes'), { recursive: true });
  mkdirSync(path.join(courseDir, 'audio'), { recursive: true });
  mkdirSync(path.join(courseDir, 'media'), { recursive: true });
  mkdirSync(path.join(courseDir, 'build'), { recursive: true });

  const courseYaml = [
    '# 课程元数据 —— 人/agent 可编辑；密钥永远走环境变量，不进本文件',
    `name: ${yamlScalar(options.name ?? '新课程')}`,
    'description: ""',
    'language: 全程使用中文授课。技术术语保留英文，不做翻译。',
    `style: ${options.style ?? 'professional'}`,
    `createdAt: ${now}`,
    `updatedAt: ${now}`,
    'voice:',
    `  voice: ${options.voice ? yamlScalar(options.voice) : '""'}`,
    '  speed: 1.0',
    '',
  ].join('\n');
  writeFileSync(path.join(courseDir, 'course.yaml'), courseYaml);
  created.push('course.yaml');

  const outline = [
    '---',
    `course: ${yamlScalar(options.name ?? '新课程')}`,
    `audience: ${yamlScalar(options.audience ?? '（待补：目标受众）')}`,
    'goal: （待补：一句话课程目标）',
    'totalMinutes: 0',
    `style: ${options.style ?? 'professional'}`,
    'voice: ""',
    '---',
    '',
    '<!-- 由 workflow-outline 生成：每节格式 `## N. 标题 · type · Xmin` + 要点/画布意图/讲稿意图 -->',
    '',
  ].join('\n');
  writeFileSync(path.join(courseDir, 'outline.md'), outline);
  created.push('outline.md');

  // Copy the scene templates in as `_`-prefixed reference stubs (excluded from
  // compilation by the scenes loader, kept one `ls` away when generating).
  const templates = path.join(SKILL_ROOT, 'templates');
  for (const t of ['scene-slide.template.md', 'scene-quiz.template.md']) {
    const src = path.join(templates, t);
    if (existsSync(src)) {
      writeFileSync(path.join(courseDir, 'scenes', `_${t}`), `<!-- 模板参考（编译时被忽略，可删） -->\n`);
      created.push(`scenes/_${t}`);
    }
  }
  return { created };
}

/** @param {string} s */
function yamlScalar(s) {
  return /[:#]/.test(s) || /^\s|\s$/.test(s) || /^[-?[\]{},&*!|>'"%@`]/.test(s) || s === ''
    ? JSON.stringify(s)
    : s;
}

if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('usage: node scripts/init.mjs <courseDir> --name 课程名 [--audience …] [--style professional]');
    process.exit(0);
  }
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  try {
    const { created } = initCourse(path.resolve(args[0]), {
      name: flag('--name'),
      audience: flag('--audience'),
      style: flag('--style'),
      voice: flag('--voice'),
    });
    console.log(`✓ 新课程已初始化（${created.join(', ')}）`);
    console.log(`  下一步: workflow-outline 生成大纲（interview 或 brief 模式）`);
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
