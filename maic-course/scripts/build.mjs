#!/usr/bin/env node
/**
 * build.mjs — course project → <name>.maic.zip (platform-importable).
 *
 * Pipeline: compile (deterministic manifest) → check (three-layer gate; any
 * error aborts) → stage (manifest.json + audio/ + media/) → zip (store, no
 * compression — byte-compatible with platform exports).
 *
 * Usage:
 *   node scripts/build.mjs <courseDir> [--out build] [--force]
 */
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readCourse } from './lib/course.mjs';
import { compileCourse } from './compile.mjs';
import { checkCourse } from './check.mjs';
import { loadConfig } from './lib/dsl.mjs';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/**
 * @param {string} courseDir
 * @param {{ out?: string, force?: boolean }} [options]
 * @returns {Promise<{ zipPath: string, findings: import('./check.mjs').Finding[], manifest: Record<string, unknown> }>}
 */
export async function buildCourse(courseDir, options = {}) {
  const config = loadConfig();
  const project = readCourse(courseDir);
  const { manifest, notes } = compileCourse(project, config);
  const findings = await checkCourse(project, manifest, notes);
  const errors = findings.filter((f) => f.severity === 'error');
  if (errors.length > 0) {
    for (const f of errors) console.error(`  ✗ [${f.layer}] ${f.location} — ${f.message}`);
    throw new Error(`${errors.length} error(s) — fix them before building (run check.mjs for the full report)`);
  }

  const buildDir = path.join(courseDir, options.out ?? 'build');
  const staging = path.join(buildDir, 'zip');
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  // manifest.json
  writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // audio/ + media/ — only files the manifest references (plus lock orphans
  // that made it into mediaIndex), keeping the zip free of dead weight.
  const referenced = new Set(Object.keys(manifest['mediaIndex'] ?? {}));
  for (const dirName of ['audio', 'media']) {
    const src = path.join(courseDir, dirName);
    if (!existsSync(src)) continue;
    mkdirSync(path.join(staging, dirName), { recursive: true });
    for (const name of readdirSync(src)) {
      if (!referenced.has(`${dirName}/${name}`)) continue;
      cpSync(path.join(src, name), path.join(staging, dirName, name));
    }
  }

  // zip (store method, no extra file attributes — matches platform exports)
  const zipName = `${safeName(String(manifest['stage']?.['name'] ?? 'course'))}.maic.zip`;
  const zipPath = path.join(buildDir, zipName);
  rmSync(zipPath, { force: true });
  const zip = spawnSync('zip', ['-X', '-0', '-r', '-q', path.resolve(zipPath), 'manifest.json', 'audio', 'media'], {
    cwd: staging,
    stdio: 'pipe',
  });
  if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr.toString().trim()}`);

  // integrity: the staged zip must re-open and contain every mediaIndex key
  const test = spawnSync('unzip', ['-t', path.resolve(zipPath)], { stdio: 'pipe' });
  if (test.status !== 0) throw new Error(`zip integrity check failed: ${test.stderr.toString().trim()}`);
  const listing = spawnSync('unzip', ['-Z1', path.resolve(zipPath)], { stdio: 'pipe' });
  const entries = new Set(listing.stdout.toString().split('\n').map((s) => s.trim()).filter(Boolean));
  for (const ref of referenced) {
    if (!entries.has(ref)) throw new Error(`staged zip is missing ${ref}`);
  }

  // build report
  const warnings = findings.filter((f) => f.severity !== 'error');
  const sizeMb = (statSync(zipPath).size / 1024 / 1024).toFixed(1);
  writeFileSync(
    path.join(buildDir, 'report.md'),
    [
      `# build report`,
      ``,
      `- zip: \`${path.relative(courseDir, zipPath)}\` (${sizeMb} MB, store method)`,
      `- scenes: ${manifest['scenes']?.length}`,
      `- mediaIndex: ${Object.keys(manifest['mediaIndex'] ?? {}).length} entries`,
      `- warnings: ${warnings.length}`,
      ``,
      ...warnings.map((f) => `- [${f.severity}] ${f.layer} ${f.location} — ${f.message}`),
      ``,
    ].join('\n'),
  );
  return { zipPath, findings, manifest };
}

/** @param {string} name */
function safeName(name) {
  return name.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'course';
}

if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('usage: node scripts/build.mjs <courseDir> [--out build]');
    process.exit(0);
  }
  const courseDir = path.resolve(args[0]);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : 'build';
  try {
    const { zipPath, findings } = await buildCourse(courseDir, { out });
    const warnings = findings.filter((f) => f.severity !== 'error').length;
    console.log(`✓ ${path.relative(process.cwd(), zipPath)} (${warnings} warnings → build/report.md)`);
    console.log(`  import: 平台 → 课程列表 → 导入 → 选择该 zip`);
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
