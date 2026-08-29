/**
 * Deterministic id / key helpers.
 *
 * Ids minted here are stable for identical content, so rebuilding an unchanged
 * course produces a byte-identical manifest (meaningful git diffs), while an
 * edit naturally mints a new id for the edited item.
 */
import { createHash } from 'node:crypto';

/**
 * @param {string} input
 * @returns {string} full sha1 hex
 */
export function sha1(input) {
  return createHash('sha1').update(input, 'utf8').digest('hex');
}

/**
 * Compact base36 of the sha1 — enough entropy for local ids, shorter files.
 * @param {string} input
 * @param {number} [length]
 * @returns {string}
 */
export function shortHash(input, length = 10) {
  return BigInt(`0x${sha1(input)}`).toString(36).slice(0, length);
}

/**
 * Audio lock key — the TTS cache identity of one speech line. Two speeches
 * with the same text synthesized with the same voice+speed are the same audio.
 * @param {string} text
 * @param {string | undefined} voice
 * @param {number | undefined} speed
 * @returns {string}
 */
export function audioKey(text, voice, speed) {
  return `t:${sha1(`${text}|${voice ?? ''}|${speed ?? 1}`)}`;
}

/**
 * Deterministic action id (matches the platform's `action_` prefix habit).
 * @param {string} sceneFile scene file name (order-bearing)
 * @param {number} blockIndex index of the speech block in the 讲稿 section
 * @param {string} kind 'speech' | 'spotlight' | 'raw'
 * @param {string} [extra] discriminator for spotlights within one block
 * @returns {string}
 */
export function actionId(sceneFile, blockIndex, kind, extra = '') {
  return `action_${shortHash(`${sceneFile}|${blockIndex}|${kind}|${extra}`)}`;
}
