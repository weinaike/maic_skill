#!/usr/bin/env node
/**
 * setup.mjs — vendor the @openmaic/dsl dist into the skill and sanity-check
 * the environment (zip CLI, ffprobe for the voice module).
 *
 * Usage:
 *   node scripts/setup.mjs [--repo /path/to/OpenMAIC]
 */
import { cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, dslCandidates, loadDsl, SKILL_ROOT } from './lib/dsl.mjs';

const args = process.argv.slice(2);
const repoFlag = readFlag(args, '--repo');
const config = loadConfig();
const repoPath = repoFlag ?? config.dslRepoPath;

const distDir = repoPath
  ? path.join(repoPath, 'packages', '@openmaic', 'dsl', 'dist')
  : undefined;

if (!distDir || !existsSync(distDir)) {
  console.error(`✗ DSL dist not found at ${distDir ?? '(no repo path configured)'}`);
  console.error('  Pass --repo /path/to/OpenMAIC or set dslRepoPath in config.json');
  process.exit(1);
}

// Copy the dist into vendor/ (drop source maps — dead weight for us).
const vendorDir = path.join(SKILL_ROOT, 'vendor', 'dsl');
rmSync(vendorDir, { recursive: true, force: true });
cpSync(distDir, vendorDir, {
  recursive: true,
  filter: (src) => !src.endsWith('.map') && !src.endsWith('.tsbuildinfo'),
});

// Report what we vendored.
const files = readdirSync(vendorDir, { recursive: true }).filter(
  (f) => typeof f === 'string' && !/** @type {string} */ (f).startsWith('schema'),
);
const dsl = await loadDsl();
const exported = Object.keys(dsl).length;

console.log(`✓ vendored @openmaic/dsl → ${path.relative(process.cwd(), vendorDir)}`);
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

/** @param {string[]} args @param {string} flag @returns {string | undefined} */
function readFlag(args, flag) {
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}
