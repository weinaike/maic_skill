#!/usr/bin/env node
/**
 * setup.mjs — vendor the @openmaic/dsl dist into the skill and sanity-check
 * the environment (zip CLI, ffprobe for the voice module).
 *
 * Usage:
 *   node scripts/setup.mjs [--repo /path/to/OpenMAIC]
 *
 * DSL source: --repo > config.json dslRepoPath > npm (@openmaic/dsl — pin
 * with config.json dslNpmVersion). The package is dependency-free, so the
 * tarball's dist/ is self-contained.
 */
import { cpSync, rmSync, existsSync, readdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, dslCandidates, loadDsl, SKILL_ROOT } from './lib/dsl.mjs';

const args = process.argv.slice(2);

// ---------------------------------------------------------------------------
// --check: skill integrity self-test (install/upgrade confidence)
// ---------------------------------------------------------------------------
if (args.includes('--check')) {
  const failures = [];
  // 1. SKILL.md frontmatter (name + description — what Claude Code discovers)
  const skillPath = path.join(SKILL_ROOT, 'SKILL.md');
  if (!existsSync(skillPath)) failures.push('SKILL.md missing');
  else {
    const fm = readFileSync(skillPath, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    if (!fm) failures.push('SKILL.md: no frontmatter');
    else {
      if (!/^name:\s*\S+/m.test(fm[1])) failures.push('SKILL.md: frontmatter missing name');
      if (!/^description:\s*\S+/m.test(fm[1])) failures.push('SKILL.md: frontmatter missing description');
    }
    // 2. every references/… and scripts/… mentioned in SKILL.md exists
    for (const m of readFileSync(skillPath, 'utf8').matchAll(/(references|scripts|templates)\/[\w./-]+/g)) {
      if (!existsSync(path.join(SKILL_ROOT, m[0]))) failures.push(`SKILL.md 引用缺失: ${m[0]}`);
    }
  }
  // 3. references inventory
  const requiredRefs = [
    'scene-source-spec.md', 'maic-format.md', 'dsl-cheatsheet.md', 'layout-patterns.md',
    'review-checklists.md', 'workflow-outline.md', 'workflow-generate.md',
    'workflow-voice.md', 'workflow-edit.md', 'workflow-auto.md', 'speech-style.md', 'agents.md', 'workflow-translate.md', 'translation-style.md',
  ];
  for (const ref of requiredRefs) {
    if (!existsSync(path.join(SKILL_ROOT, 'references', ref))) failures.push(`references/${ref} 缺失`);
  }
  // 3.5 registered agent types (mechanical context isolation)
  for (const agent of ['maic-scene-generator.md', 'maic-reviewer.md', 'maic-fixer.md', 'maic-translator.md']) {
    const p = path.join(SKILL_ROOT, 'agents', agent);
    if (!existsSync(p)) failures.push(`agents/${agent} 缺失`);
    else {
      const fm = readFileSync(p, 'utf8').match(/^---\n([\s\S]*?)\n---/);
      if (!fm || !/^tools:/m.test(fm[1])) failures.push(`agents/${agent}: frontmatter 缺 tools 限制`);
    }
  }
  // 4. scripts syntax
  const scriptsDir = path.join(SKILL_ROOT, 'scripts');
  for (const f of readdirSync(scriptsDir).filter((f) => f.endsWith('.mjs'))) {
    const r = spawnSync(process.execPath, ['--check', path.join(scriptsDir, f)], { stdio: 'pipe' });
    if (r.status !== 0) failures.push(`scripts/${f}: 语法错误`);
  }
  // 5. dsl vendor present + loadable
  try {
    const dsl = await loadDsl();
    console.log(`  dsl: DSL_VERSION ${dsl.DSL_VERSION}（vendor${existsSync(path.join(SKILL_ROOT, 'vendor', 'dsl', 'index.js')) ? '' : ' ← 仓库 fallback'}）`);
  } catch (err) {
    failures.push(`dsl 无法加载: ${err instanceof Error ? err.message : err}`);
  }
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.log(failures.length ? `✗ skill 自检未过（${failures.length} 项）` : '✓ skill 完整性自检通过（SKILL/references/scripts/dsl）');
  process.exit(failures.length ? 1 : 0);
}

const repoFlag = readFlag(args, '--repo');
const config = loadConfig();
const repoPath = repoFlag ?? config.dslRepoPath;

let distDir = repoPath
  ? path.join(repoPath, 'packages', '@openmaic', 'dsl', 'dist')
  : undefined;

// No usable monorepo checkout → the DSL is a zero-dependency published npm
// package; its tarball ships the very dist/ the monorepo builds. Pack it into
// a temp dir and vendor from there.
let npmTmp = null;
let tarball = null;
if (!distDir || !existsSync(distDir)) {
  const spec = config.dslNpmVersion
    ? `@openmaic/dsl@${config.dslNpmVersion}`
    : '@openmaic/dsl';
  console.log(`→ repo 路径不可用（${distDir ?? '未配置'}），改从 npm 拉取 ${spec}`);
  try {
    ({ distDir, tmp: npmTmp, tarball } = npmPackDist(spec));
  } catch (err) {
    console.error(`✗ DSL dist not found at ${distDir ?? '(no repo path configured)'}，且 npm fallback 失败：`);
    console.error(`  ${err instanceof Error ? err.message : err}`);
    console.error('  Pass --repo /path/to/OpenMAIC, set dslRepoPath in config.json, or check npm connectivity.');
    process.exit(1);
  }
}

// Copy the dist into vendor/ (drop source maps — dead weight for us).
const vendorDir = path.join(SKILL_ROOT, 'vendor', 'dsl');
rmSync(vendorDir, { recursive: true, force: true });
cpSync(distDir, vendorDir, {
  recursive: true,
  filter: (src) => !src.endsWith('.map') && !src.endsWith('.tsbuildinfo'),
});
if (npmTmp) rmSync(npmTmp, { recursive: true, force: true });

// Report what we vendored.
const files = readdirSync(vendorDir, { recursive: true }).filter(
  (f) => typeof f === 'string' && !/** @type {string} */ (f).startsWith('schema'),
);
const dsl = await loadDsl();
const exported = Object.keys(dsl).length;

console.log(`✓ vendored @openmaic/dsl → ${path.relative(process.cwd(), vendorDir)}${tarball ? `（npm ${tarball.replace(/^openmaic-dsl-|\.tgz$/g, '')}）` : ''}`);
console.log(`  DSL_VERSION = ${dsl.DSL_VERSION}`);
console.log(`  exports     = ${exported} (${files.length} files + schema/)`);

// Environment doctor.
console.log(`\nEnvironment:`);
console.log(`  ${cmd('zip')}    ${which('zip') ? '✓' : '✗ required for build (brew install zip)'}`);
console.log(`  ${cmd('unzip')}  ${which('unzip') ? '✓' : '✗ required for unpack'}`);
console.log(`  ${cmd('ffprobe')} ${which('ffprobe') ? '✓ durations' : '– absent (audio duration falls back to mediaIndex only)'}`);

function which(bin) {
  const probe = process.platform === 'win32' ? spawnSync('where', [bin]) : spawnSync('which', [bin]);
  return probe.status === 0;
}

function cmd(bin) {
  return bin.padEnd(8);
}

/**
 * `npm pack` the DSL into a temp dir and extract it.
 * @param {string} spec npm spec, e.g. `@openmaic/dsl` or `@openmaic/dsl@0.11.0`
 * @returns {{ distDir: string, tmp: string, tarball: string }}
 */
function npmPackDist(spec) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'maic-dsl-'));
  const pack = spawnSync('npm', ['pack', spec, '--silent'], { cwd: tmp, stdio: 'pipe', encoding: 'utf8' });
  if (pack.status !== 0) throw new Error(`npm pack ${spec}: ${(pack.stderr || pack.stdout || '').trim()}`);
  const tarball = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error(`npm pack ${spec}: no tarball produced`);
  const untar = spawnSync('tar', ['-xzf', tarball, '-C', tmp], { cwd: tmp, stdio: 'pipe' });
  if (untar.status !== 0) throw new Error(`tar extract ${tarball}: ${untar.stderr}`);
  return { distDir: path.join(tmp, 'package', 'dist'), tmp, tarball };
}

/** @param {string[]} args @param {string} flag @returns {string | undefined} */
function readFlag(args, flag) {
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}
