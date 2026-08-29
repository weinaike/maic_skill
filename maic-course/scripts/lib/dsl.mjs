/**
 * DSL loader — resolves the vendored @openmaic/dsl dist, falling back to the
 * live monorepo checkout. The DSL is zero-runtime-dependency ESM, so a plain
 * dynamic import of its built dist is all that's needed for offline
 * validation.
 */
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** @import {YMap} from './yaml.mjs' */

const here = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(here, '..', '..');

/** @typedef {{ dslRepoPath?: string }} SkillConfig */

/**
 * @returns {SkillConfig}
 */
export function loadConfig() {
  const file = path.join(SKILL_ROOT, 'config.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`config.json is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Candidate locations for the dsl dist, in priority order:
 * the vendored copy (offline, self-contained) then the monorepo checkout.
 * @param {SkillConfig} [config]
 * @returns {string[]}
 */
export function dslCandidates(config = loadConfig()) {
  const candidates = [path.join(SKILL_ROOT, 'vendor', 'dsl', 'index.js')];
  if (config.dslRepoPath) {
    candidates.push(path.join(config.dslRepoPath, 'packages', '@openmaic', 'dsl', 'dist', 'index.js'));
  }
  return candidates;
}

/**
 * Load the DSL module. Throws with a actionable message when neither location
 * has a build (hint: run `node scripts/setup.mjs`).
 * @param {SkillConfig} [config]
 * @returns {Promise<typeof import('@openmaic/dsl')>}
 */
export async function loadDsl(config = loadConfig()) {
  const tried = [];
  for (const candidate of dslCandidates(config)) {
    if (!existsSync(candidate)) {
      tried.push(`${candidate} (missing)`);
      continue;
    }
    try {
      // @ts-ignore — untyped dynamic import of the vendored ESM dist
      return await import(pathToFileURL(candidate).href);
    } catch (err) {
      tried.push(`${candidate} (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  throw new Error(
    `Cannot load @openmaic/dsl. Tried:\n  ${tried.join('\n  ')}\n` +
      `Run \`node ${path.join(SKILL_ROOT, 'scripts', 'setup.mjs')}\` to vendor the dist from the monorepo.`,
  );
}
