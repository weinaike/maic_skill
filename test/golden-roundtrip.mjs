#!/usr/bin/env node
/**
 * Golden round-trip test — the M1 contract proof.
 *
 * Takes a real platform export (.maic.zip), then proves three properties:
 *
 *   1. losslessness   unpack → compile reproduces the original manifest
 *                     (deep-equal modulo exportedAt + minted action ids)
 *   2. stability      build → unpack → compile reproduces the SAME manifest
 *                     (the zip we ship re-imports into the same source)
 *   3. soundness      three-layer check reports zero errors on both projects
 *
 * Usage:
 *   node test/golden-roundtrip.mjs [sample.maic.zip]
 *   (default: ~/Desktop/00.Agent 系列课程介绍.maic.zip)
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.resolve(here, '..', 'maic-course', 'scripts');

const sample =
  process.argv[2] ?? path.join(process.env['HOME'] ?? '', 'Desktop', '00.Agent 系列课程介绍.maic.zip');
if (!sample) {
  console.error('usage: node test/golden-roundtrip.mjs <sample.maic.zip>');
  process.exit(2);
}

const work = mkdtempSync(path.join(tmpdir(), 'maic-golden-'));
const courseA = path.join(work, 'a');
const courseB = path.join(work, 'b');

let failures = 0;
const step = (/** @type {string} */ name, /** @type {() => boolean} */ fn) => {
  const ok = fn();
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failures++;
};

// --- unpack original -------------------------------------------------------
run('node', [path.join(scripts, 'unpack.mjs'), sample, courseA, '--force']);
const manifestOriginal = readOriginalManifest();

// --- 1. losslessness ---------------------------------------------------------
const compileA = run('node', [path.join(scripts, 'compile.mjs'), courseA, '--stdout']);
const manifestA = JSON.parse(compileA.stdout);
step('losslessness: unpack→compile deep-equals the original manifest', () => {
  return deepEqualModulo(stripVolatile(manifestOriginal), stripVolatile(manifestA));
});

// --- 2. stability: build → unpack → compile ----------------------------------
run('node', [path.join(scripts, 'build.mjs'), courseA]);
const zipB = findZip(path.join(courseA, 'build'));
run('node', [path.join(scripts, 'unpack.mjs'), zipB, courseB, '--force']);
const compileB = run('node', [path.join(scripts, 'compile.mjs'), courseB, '--stdout']);
const manifestB = JSON.parse(compileB.stdout);
step('stability: build→unpack→compile reproduces the same manifest', () => {
  return deepEqualModulo(stripVolatile(manifestA), stripVolatile(manifestB));
});

// --- 3. soundness ------------------------------------------------------------
const checkA = run('node', [path.join(scripts, 'check.mjs'), courseA]);
step('soundness: check reports zero errors on the round-tripped project', () => checkA.status === 0);

// --- report -------------------------------------------------------------------
console.log(
  failures === 0
    ? `\n✅ golden round-trip PASSED (${manifestA.scenes.length} scenes, ${Object.keys(manifestA.mediaIndex).length} media)`
    : `\n❌ golden round-trip FAILED (${failures} step(s))`,
);
rmSync(work, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);

// ---------------------------------------------------------------------------

function readOriginalManifest() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'maic-golden-orig-'));
  run('unzip', ['-q', '-o', sample, 'manifest.json', '-d', tmp]);
  const m = JSON.parse(readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  rmSync(tmp, { recursive: true, force: true });
  return m;
}

/**
 * @param {string} bin
 * @param {string[]} args
 */
function run(bin, args) {
  const r = spawnSync(bin, args, { stdio: 'pipe', encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`✗ command failed: ${bin} ${args.join(' ')}\n${r.stderr}`);
    process.exit(1);
  }
  return r;
}

/**
 * @param {string} dir
 */
function findZip(dir) {
  const zip = readdirSync(dir).find((f) => f.endsWith('.maic.zip'));
  if (!zip) throw new Error(`no .maic.zip under ${dir}`);
  return path.join(dir, zip);
}

/**
 * Strip fields that legitimately differ across builds: exportedAt (clock) and
 * action ids (content-hash-minted vs platform nanoid).
 */
function stripVolatile(/** @type {any} */ manifest) {
  const clone = JSON.parse(JSON.stringify(manifest));
  delete clone.exportedAt;
  for (const scene of clone.scenes ?? []) {
    for (const action of scene.actions ?? []) delete action.id;
  }
  return clone;
}

function deepEqualModulo(/** @type {any} */ a, /** @type {any} */ b) {
  return JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
}

function sortDeep(/** @type {any} */ v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]));
  }
  return v;
}
