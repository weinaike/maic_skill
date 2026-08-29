/**
 * isMainModule — symlink-safe "am I the entry script?" check.
 *
 * Node resolves an ESM module's import.meta.url to the REAL file path while
 * process.argv[1] keeps the path as invoked — when the skill is installed as a
 * symlink (e.g. .claude/skills/maic-course → …/maic_skill/maic-course), a plain
 * path.resolve comparison silently fails and the CLI block never runs. Compare
 * realpaths on both sides instead.
 */
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} moduleUrl the caller's import.meta.url
 * @returns {boolean}
 */
export function isMainModule(moduleUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
