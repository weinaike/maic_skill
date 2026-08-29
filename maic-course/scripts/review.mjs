#!/usr/bin/env node
/**
 * review.mjs — the review framework's mechanical half.
 *
 * Reviewers (Claude in a dedicated reviewer role, see
 * references/review-checklists.md) write structured findings files;
 * this tool validates them, aggregates the latest round per scope into a
 * verdict, and *gates the build*: any open blocker refuses to ship.
 *
 * Findings file: build/review/<scope>-review.r<round>.json
 *
 *   {
 *     "scope": "outline",              // outline | content | spec | full
 *     "target": "outline.md",          // reviewed artifact
 *     "round": 1,
 *     "reviewer": "outline-reviewer",
 *     "findings": [
 *       { "id": "O-01", "severity": "blocker", "status": "open",
 *         "location": "outline.md §4", "finding": "…", "fix": "…" }
 *     ]
 *   }
 *
 * severity: blocker (不修不能出包) | warning (应修，出包需明示) | nit (可选打磨)
 * status:   open | fixed | wontfix
 *
 * Usage:
 *   node scripts/review.mjs init  <courseDir> --scope outline [--round 1]
 *   node scripts/review.mjs validate <findings.json> […]
 *   node scripts/review.mjs verdict <courseDir> [--no-fail]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isMainModule } from './lib/main.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isMain = isMainModule(import.meta.url);

const SCOPES = new Set(['outline', 'content', 'spec', 'full', 'translation']);
const SEVERITIES = new Set(['blocker', 'warning', 'nit']);
const STATUSES = new Set(['open', 'fixed', 'wontfix']);

/**
 * @param {unknown} doc
 * @param {string} fileName
 * @returns {{ ok: true, doc: ReviewDoc } | { ok: false, errors: string[] }}
 */
export function validateReviewDoc(doc, fileName) {
  /** @type {string[]} */
  const errors = [];
  if (typeof doc !== 'object' || doc === null) return { ok: false, errors: [`${fileName}: not an object`] };
  const d = /** @type {Record<string, unknown>} */ (doc);
  if (!SCOPES.has(String(d['scope']))) errors.push(`${fileName}: scope must be one of ${[...SCOPES].join('|')}`);
  if (typeof d['target'] !== 'string' || !d['target']) errors.push(`${fileName}: target missing`);
  if (!Number.isInteger(d['round']) || /** @type {number} */ (d['round']) < 1) errors.push(`${fileName}: round must be a positive integer`);
  if (!Array.isArray(d['findings'])) {
    errors.push(`${fileName}: findings must be an array`);
    return { ok: false, errors };
  }
  const ids = new Set();
  d['findings'].forEach((f, i) => {
    const where = `${fileName} findings[${i}]`;
    if (typeof f !== 'object' || f === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    const g = /** @type {Record<string, unknown>} */ (f);
    if (typeof g['id'] !== 'string' || !g['id']) errors.push(`${where}: id missing`);
    else if (ids.has(g['id'])) errors.push(`${where}: duplicate id ${g['id']}`);
    else ids.add(g['id']);
    if (!SEVERITIES.has(String(g['severity']))) errors.push(`${where}: severity must be blocker|warning|nit`);
    const status = String(g['status'] ?? 'open');
    if (!STATUSES.has(status)) errors.push(`${where}: status must be open|fixed|wontfix`);
    if (typeof g['location'] !== 'string' || !g['location']) errors.push(`${where}: location missing (must be file-anchored)`);
    if (typeof g['finding'] !== 'string' || !g['finding']) errors.push(`${where}: finding missing`);
    if (g['severity'] === 'blocker' && status === 'open' && typeof g['fix'] !== 'string') {
      errors.push(`${where}: an open blocker must carry an actionable fix`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, doc: /** @type {ReviewDoc} */ (doc) };
}

/**
 * Aggregate the latest round per scope across build/review/*.review.*.json.
 * @param {string} courseDir
 * @returns {{ docs: ReviewDoc[], stale: { file: string, target: string }[] , counts: Record<string, number>, blockers: {file:string,id:string,location:string,finding:string}[] }}
 */
export function aggregateReviews(courseDir) {
  const reviewDir = path.join(courseDir, 'build', 'review');
  /** @type {ReviewDoc[]} */
  const docs = [];
  if (existsSync(reviewDir)) {
    for (const name of readdirSync(reviewDir).sort()) {
      if (!/-review\.r\d+\.json$/.test(name)) continue;
      const file = path.join(reviewDir, name);
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue; // malformed files are reported by validate, not aggregate
      }
      const result = validateReviewDoc(parsed, name);
      if (result.ok) docs.push({ ...result.doc, _file: file, _mtime: statSync(file).mtimeMs });
    }
  }
  // Latest round per scope wins.
  const latest = new Map();
  for (const doc of docs) {
    const prev = latest.get(doc.scope);
    if (!prev || doc.round > prev.round) latest.set(doc.scope, doc);
  }
  const winners = [...latest.values()];

  // Staleness: the reviewed target changed after the review was written.
  // A directory target compares against the max mtime of its contained files.
  const stale = [];
  for (const doc of winners) {
    if (doc['target'] === 'full') continue;
    const target = path.join(courseDir, String(doc['target']));
    if (!existsSync(target)) continue;
    const targetMtime = latestMtime(target);
    if (targetMtime > /** @type {number} */ (doc['_mtime'])) {
      stale.push({ file: path.basename(/** @type {string} */ (doc['_file'])), target: String(doc['target']) });
    }
  }

  const counts = { blocker: 0, warning: 0, nit: 0 };
  const blockers = [];
  for (const doc of winners) {
    for (const f of doc['findings']) {
      if (f['status'] !== 'open') continue;
      counts[/** @type {'blocker'|'warning'|'nit'} */ (f['severity'])] = (counts[/** @type {'blocker'|'warning'|'nit'} */ (f['severity'])] ?? 0) + 1;
      if (f['severity'] === 'blocker') {
        blockers.push({ file: path.basename(/** @type {string} */ (doc['_file'])), id: String(f['id']), location: String(f['location']), finding: String(f['finding']) });
      }
    }
  }
  return { docs: winners, stale, counts, blockers };
}

/**
 * @param {string} courseDir
 * @returns {{ counts: Record<string, number>, blockers: {file:string,id:string,location:string,finding:string}[], stale: {file:string,target:string}[], reportPath: string }}
 */
export function reviewVerdict(courseDir) {
  const { docs, stale, counts, blockers } = aggregateReviews(courseDir);
  const reviewDir = path.join(courseDir, 'build', 'review');
  mkdirSync(reviewDir, { recursive: true });
  const reportPath = path.join(reviewDir, 'verdict.md');
  const lines = [
    `# review verdict`,
    ``,
    docs.length === 0 ? `（无审查记录——本课程尚未跑审查）` : `最新轮次：${docs.map((d) => `${d.scope} r${d.round}`).join(' · ')}`,
    ``,
    `| severity | open 数 |`,
    `|---|---|`,
    `| blocker | ${counts['blocker'] ?? 0} |`,
    `| warning | ${counts['warning'] ?? 0} |`,
    `| nit | ${counts['nit'] ?? 0} |`,
    ``,
  ];
  for (const doc of docs) {
    lines.push(`## ${doc['scope']} — round ${doc['round']} (${path.basename(/** @type {string} */ (doc['_file']))})`);
    for (const f of doc['findings']) {
      lines.push(`- [${f['status']}] ${f['severity']} ${f['id']} ${f['location']} — ${f['finding']}${f['fix'] ? `（fix: ${f['fix']}）` : ''}`);
    }
    lines.push('');
  }
  for (const s of stale) lines.push(`- ⚠ 审查后目标又变更：${s.target}（被 ${s.file} 审过）— 需重审`);
  writeFileSync(reportPath, lines.join('\n') + '\n');
  return { counts, blockers, stale, reportPath };
}

/** @typedef {{ scope: string, target: string, round: number, reviewer?: string, findings: Record<string, string>[], _file?: string, _mtime?: number }} ReviewDoc */

/**
 * @param {string} target file or directory (one level deep: scenes/*.md)
 * @returns {number} latest mtimeMs, or 0
 */
function latestMtime(target) {
  const s = statSync(target);
  if (s.isFile()) return s.mtimeMs;
  let max = s.mtimeMs;
  for (const name of readdirSync(target)) {
    if (name.startsWith('.')) continue;
    const m = statSync(path.join(target, name)).mtimeMs;
    if (m > max) max = m;
  }
  return max;
}

if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  try {
    if (cmd === 'init') {
      const courseDir = path.resolve(args[1] ?? '.');
      const scope = flagValue(args, '--scope') ?? 'outline';
      const round = Number.parseInt(flagValue(args, '--round') ?? '1', 10);
      if (!SCOPES.has(scope)) throw new Error(`scope must be one of ${[...SCOPES].join('|')}`);
      const target = scope === 'outline' ? 'outline.md' : scope === 'content' || scope === 'spec' ? 'scenes' : 'full';
      const reviewDir = path.join(courseDir, 'build', 'review');
      mkdirSync(reviewDir, { recursive: true });
      const file = path.join(reviewDir, `${scope}-review.r${round}.json`);
      const doc = {
        scope, target, round, reviewer: `${scope}-reviewer`,
        findings: [
          {
            id: `${scope[0]?.toUpperCase()}-01`,
            severity: 'warning',
            status: 'open',
            location: `${target}（示例条目——删除我并填入真实发现）`,
            finding: '示例：这里是问题描述，location 必须能定位到文件与位置',
            fix: '示例：可执行的修复建议（open blocker 必填）',
          },
        ],
      };
      writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
      console.log(`✓ scaffold → ${path.relative(process.cwd(), file)}`);
    } else if (cmd === 'validate') {
      const files = args.slice(1);
      if (files.length === 0) throw new Error('validate 需要至少一个 findings 文件');
      let bad = 0;
      for (const file of files) {
        const doc = JSON.parse(readFileSync(file, 'utf8'));
        const result = validateReviewDoc(doc, path.basename(file));
        if (result.ok) console.log(`✓ ${file}`);
        else {
          bad++;
          for (const e of result.errors) console.error(`  ✗ ${e}`);
        }
      }
      process.exit(bad ? 1 : 0);
    } else if (cmd === 'verdict') {
      const courseDir = path.resolve(args[1] ?? '.');
      const noFail = args.includes('--no-fail');
      const { counts, blockers, stale, reportPath } = reviewVerdict(courseDir);
      for (const b of blockers) console.error(`  ✗ [blocker] ${b.id} ${b.location} — ${b.finding} (${b.file})`);
      for (const s of stale) console.log(`  ⚠ 审查后目标又变更：${s.target} — 需重审`);
      console.log(
        `verdict: ${counts['blocker'] ? '✗ BLOCKED' : '✓ pass'} · blocker ${counts['blocker'] ?? 0} / warning ${counts['warning'] ?? 0} / nit ${counts['nit'] ?? 0} → ${path.relative(process.cwd(), reportPath)}`,
      );
      if (counts['blocker'] && !noFail) process.exit(1);
    } else {
      console.log('usage: node scripts/review.mjs init|validate|verdict …');
      process.exit(args[0] === '--help' ? 0 : 2);
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

/** @param {string[]} args @param {string} flag @returns {string | undefined} */
function flagValue(args, flag) {
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}
