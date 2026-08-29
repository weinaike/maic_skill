#!/usr/bin/env node
/**
 * tts.mjs — the voice module's engine: synthesize course narration with a
 * pluggable provider, hash-cached so editing one line re-synthesizes exactly
 * one file.
 *
 * Providers (MAIC_TTS_PROVIDER, replaceable):
 *   doubao             Volcengine Doubao Seed-TTS 2.0 — request-for-request
 *                      compatible with the platform's generateDoubaoTTS (same
 *                      key works for both). Two auth modes by key shape:
 *                      "appId:accessKey" → /api/v3/tts + X-Api-App-Id/X-Api-Access-Key;
 *                      single "ark-…" Agent-Plan key → /api/v3/plan/tts + X-Api-Key.
 *                      Key resolution: MAIC_TTS_API_KEY → active arkcli profile.
 *   openai-compatible  POST {base}/audio/speech {model, voice, input, speed}
 *   platform           reuse a running OpenMAIC server's /api/generate/tts
 *   edge               edge-tts CLI wrapper (free fallback; needs the CLI)
 *
 * Env: MAIC_TTS_PROVIDER / _API_KEY / _BASE_URL / _MODEL / _VOICE / _SPEED
 *      MAIC_TTS_PLATFORM_URL (platform provider) — secrets stay in env.
 *
 * Usage:
 *   node scripts/tts.mjs doctor
 *   node scripts/tts.mjs <courseDir> [--dry-run] [--force] [--scenes 3-5]
 *                        [--provider …] [--voice …] [--speed …]
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readCourse } from './lib/course.mjs';
import { compileCourse } from './compile.mjs';
import { audioKey, shortHash } from './lib/hash.mjs';
import { stringifyYaml } from './lib/yaml.mjs';
import { loadConfig } from './lib/dsl.mjs';
import { isMainModule } from './lib/main.mjs';

const isMain = isMainModule(import.meta.url);

const DOUBAO_RESOURCE_ID = 'seed-tts-2.0';
const DOUBAO_TTS_BASE = 'https://openspeech.bytedance.com/api/v3/tts';
const DOUBAO_PLAN_TTS_BASE = 'https://openspeech.bytedance.com/api/v3/plan/tts';
/** Rate-limit codes the platform treats as retryable concurrency quota hits. */
const DOUBAO_RATE_LIMIT_CODES = new Set([45000000, 45000292]);

/**
 * @typedef {{
 *   provider: string, apiKey?: string, baseUrl?: string, model?: string,
 *   voice?: string, speed: number, platformUrl?: string,
 * }} TtsConfig
 */

/** Resolve provider config from env + CLI overrides (never secrets in course.yaml). */
export function resolveTtsConfig(overrides = {}) {
  const env = process.env;
  const cfg = {
    provider: overrides.provider ?? env['MAIC_TTS_PROVIDER'] ?? 'doubao',
    apiKey: overrides.apiKey ?? env['MAIC_TTS_API_KEY'] ?? undefined,
    baseUrl: overrides.baseUrl ?? env['MAIC_TTS_BASE_URL'] ?? undefined,
    model: overrides.model ?? env['MAIC_TTS_MODEL'] ?? undefined,
    voice: overrides.voice ?? env['MAIC_TTS_VOICE'] ?? undefined,
    speed: Number(overrides.speed ?? env['MAIC_TTS_SPEED'] ?? 1.0),
    platformUrl: env['MAIC_TTS_PLATFORM_URL'] ?? 'http://localhost:3000',
  };
  // Doubao fallback: the active arkcli agent-plan profile's key (local machine
  // config only; env always wins).
  if (cfg.provider === 'doubao' && !cfg.apiKey) {
    cfg.apiKey = arkcliApiKey();
  }
  if (Number.isNaN(cfg.speed) || cfg.speed <= 0) cfg.speed = 1.0;
  return cfg;
}

/**
 * The active arkcli profile's api_key, if present. Returns undefined silently —
 * doctor reports the resolution chain, the synth path just needs a key or not.
 */
function arkcliApiKey() {
  const file = path.join(os.homedir(), '.arkcli', 'config.yaml');
  if (!existsSync(file)) return undefined;
  const text = readFileSync(file, 'utf8');
  const active = text.match(/^default_profile:\s*(\S+)/m);
  if (!active) return undefined;
  const section = text.split(new RegExp(`^  ${escapeRe(active[1])}:`, 'm'))[1];
  if (!section) return undefined;
  const key = section.match(/^\s+api_key:\s*(\S+)\s*$/m);
  return key ? key[1] : undefined;
}

/**
 * Synthesize one text → mp3 bytes.
 * @param {string} text
 * @param {TtsConfig} cfg
 * @returns {Promise<Uint8Array>}
 */
export async function synthesize(text, cfg) {
  switch (cfg.provider) {
    case 'doubao':
      return synthesizeDoubao(text, cfg);
    case 'openai-compatible':
      return synthesizeOpenAI(text, cfg);
    case 'platform':
      return synthesizePlatform(text, cfg);
    case 'edge':
      return synthesizeEdge(text, cfg);
    default:
      throw new Error(`unknown provider "${cfg.provider}" (doubao | openai-compatible | platform | edge)`);
  }
}

/**
 * Doubao Seed-TTS 2.0 — mirrors the platform's generateDoubaoTTS byte for byte:
 * endpoint+auth picked by key shape, concatenated-JSON-stream response parsed
 * string-aware, rate-limit codes retried with backoff.
 */
async function synthesizeDoubao(text, cfg) {
  const rawKey = cfg.apiKey ?? '';
  if (!rawKey) {
    throw new Error('Doubao TTS 需要密钥：设置 MAIC_TTS_API_KEY（Agent Plan 单 key 或 "appId:accessKey"），或登录 arkcli');
  }
  const colonIdx = rawKey.indexOf(':');
  const isPlanKey = colonIdx < 0;
  const appId = isPlanKey ? '' : rawKey.slice(0, colonIdx);
  const accessKey = isPlanKey ? '' : rawKey.slice(colonIdx + 1);
  if (!isPlanKey && (!appId || !accessKey)) {
    throw new Error('Doubao key "appId:accessKey" 两半都必须非空（或改用 Agent Plan 单 key）');
  }
  const baseUrl = cfg.baseUrl ?? (isPlanKey ? DOUBAO_PLAN_TTS_BASE : DOUBAO_TTS_BASE);
  const speechRate = Math.round((cfg.speed - 1) * 100);

  /** @type {Record<string, string>} */
  let authHeaders;
  if (isPlanKey) authHeaders = { 'X-Api-Key': rawKey };
  else authHeaders = { 'X-Api-App-Id': appId, 'X-Api-Access-Key': accessKey };

  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(`${baseUrl}/unidirectional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        'X-Api-Resource-Id': DOUBAO_RESOURCE_ID,
      },
      body: JSON.stringify({
        user: { uid: 'maic-skill' },
        req_params: {
          text,
          speaker: cfg.voice ?? 'zh_male_liufei_uranus_bigtts',
          audio_params: { format: 'mp3', sample_rate: 24000, speech_rate: speechRate },
        },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        await sleep(2000 * attempt);
        continue;
      }
      throw new Error(`Doubao TTS HTTP ${response.status}: ${errorText.slice(0, 300)}（key 形态=${isPlanKey ? 'Agent Plan 单 key → plan 端点' : 'appId:accessKey → 语音控制台端点'}）`);
    }

    const body = await response.text();
    /** @type {Uint8Array[]} */
    const chunks = [];
    let rateLimited = false;
    for (const objectText of splitConcatenatedJsonObjects(body)) {
      /** @type {{ code?: number, message?: string, data?: string }} */
      let chunk;
      try {
        chunk = JSON.parse(objectText);
      } catch {
        continue;
      }
      if (chunk.code === 0 && chunk.data) {
        chunks.push(new Uint8Array(Buffer.from(chunk.data, 'base64')));
      } else if (chunk.code === 20000000) {
        break; // explicit end-of-stream marker
      } else if (chunk.code && chunk.code !== 0) {
        if (DOUBAO_RATE_LIMIT_CODES.has(chunk.code)) {
          rateLimited = true;
          break;
        }
        throw new Error(`Doubao TTS 错误: ${chunk.message ?? 'unknown'} (code ${chunk.code})`);
      }
    }
    if (rateLimited && attempt < 4) {
      await sleep(2000 * attempt);
      continue;
    }
    if (chunks.length === 0) throw new Error('Doubao TTS 未返回音频数据');
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.length;
    }
    return combined;
  }
  throw new Error('Doubao TTS 重试用尽（并发限额）——稍后重跑，已合成的部分已入缓存');
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST {base}/v1/audio/speech → binary mp3. */
async function synthesizeOpenAI(text, cfg) {
  if (!cfg.baseUrl) throw new Error('openai-compatible 需要 MAIC_TTS_BASE_URL（代理/网关地址）');
  let base = cfg.baseUrl.replace(/\/+$/, '');
  if (!/\/v\d+$/.test(base)) base += '/v1';
  const response = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model ?? 'tts-1',
      voice: cfg.voice ?? 'alloy',
      input: text,
      speed: cfg.speed,
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`audio/speech HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Reuse a running OpenMAIC server's configured TTS. */
async function synthesizePlatform(text, cfg) {
  const provider = cfg.model ?? 'doubao-tts'; // model slot carries ttsProviderId here
  const response = await fetch(`${cfg.platformUrl}/api/generate/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      audioId: `skill_${shortHash(text, 8)}`,
      ttsProviderId: provider,
      ...(cfg.voice ? { ttsVoice: cfg.voice } : {}),
      ttsSpeed: cfg.speed,
      ...(cfg.apiKey ? { ttsApiKey: cfg.apiKey } : {}),
      ...(cfg.baseUrl ? { ttsBaseUrl: cfg.baseUrl } : {}),
    }),
  });
  const body = /** @type {any} */ (await response.json().catch(() => ({})));
  if (!response.ok || !body?.success || typeof body.base64 !== 'string') {
    throw new Error(`平台 /api/generate/tts 失败: HTTP ${response.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return new Uint8Array(Buffer.from(body['base64'], 'base64'));
}

/** edge-tts CLI wrapper (free Microsoft voices, needs `pip install edge-tts`). */
async function synthesizeEdge(text, cfg) {
  const voice = cfg.voice ?? 'zh-CN-YunxiNeural';
  const tmp = path.join(os.tmpdir(), `maic-edge-${shortHash(text + voice, 10)}.mp3`);
  const r = spawnSync('edge-tts', ['--voice', voice, '--text', text, '--write-media', tmp], { stdio: 'pipe' });
  if (r.status !== 0) {
    throw new Error(`edge-tts 失败（pip install edge-tts？）: ${r.stderr.toString().slice(0, 200)}`);
  }
  const bytes = new Uint8Array(readFileSync(tmp));
  rmSync(tmp, { force: true });
  return bytes;
}

/**
 * Split concatenated top-level JSON objects (string-aware — braces inside
 * string values don't count). Ported verbatim from the platform's json-stream.
 * @param {string} text
 */
export function splitConcatenatedJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

/** ffprobe duration in seconds, or undefined. */
function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { stdio: 'pipe' });
  if (r.status !== 0) return undefined;
  const d = Number.parseFloat(r.stdout.toString().trim());
  return Number.isFinite(d) ? d : undefined;
}

/**
 * Voice a course project: collect speech lines, skip cache hits, synthesize
 * misses into audio/, update voice.lock.yaml (durations via ffprobe).
 * @param {string} courseDir
 * @param {{ dryRun?: boolean, force?: boolean, range?: string, provider?: string, voice?: string, speed?: number }} options
 */
export async function voiceCourse(courseDir, options = {}) {
  const project = readCourse(courseDir);
  const cfg = resolveTtsConfig(options);
  const compileResult = compileCourse(project, loadConfig());
  const audioMisses = compileResult.notes.audioMisses;

  // Effective voice for cache keying: explicit flag > course.yaml > env default.
  const effectiveVoice = options.voice ?? project.voice.voice ?? cfg.voice;
  const effectiveSpeed = options.speed ?? project.voice.speed ?? cfg.speed;

  // Collect jobs: one per speech block in the (possibly range-filtered) scenes.
  const want = options.range ? parseRange(options.range) : undefined;
  /** @type {{ scene: string, text: string, key: string }[]} */
  const jobs = [];
  for (const scene of project.scenes) {
    if (want && !want.has(scene.orderPrefix)) continue;
    for (const block of scene.speech) {
      if (block.kind !== 'speech') continue;
      jobs.push({
        scene: scene.file,
        text: block.text,
        key: audioKey(block.text, effectiveVoice, effectiveSpeed),
      });
    }
  }

  // Dedup identical lines (same key = same audio).
  const byKey = new Map(jobs.map((j) => [j.key, j]));

  /** @type {{ synthesized: typeof jobs, cached: typeof jobs, chars: number, seconds: number }} */
  const result = { synthesized: [], cached: [], chars: 0, seconds: 0 };
  const lock = { ...project.voiceLock };
  const audioDir = path.join(courseDir, 'audio');
  mkdirSync(audioDir, { recursive: true });

  for (const job of byKey.values()) {
    const entry = lock[job.key];
    const file = typeof entry?.['file'] === 'string' ? entry['file'] : `audio/ast_${shortHash(job.key, 10)}.mp3`;
    const localPath = path.join(courseDir, file);
    const cacheHit = !options.force && entry && existsSync(localPath);

    if (options.dryRun) {
      (cacheHit ? result.cached : result.synthesized).push(job);
      if (!cacheHit) result.chars += job.text.length;
      continue;
    }
    if (cacheHit) {
      result.cached.push(job);
      continue;
    }

    process.stdout.write(`  ⋯ 合成 ${job.scene}: ${job.text.slice(0, 24)}… `);
    const bytes = await synthesize(job.text, cfg);
    writeFileSync(localPath, bytes);
    const duration = probeDuration(localPath);
    lock[job.key] = {
      file,
      format: 'mp3',
      ...(duration !== undefined ? { duration: Math.round(duration * 1000) / 1000 } : {}),
      voice: effectiveVoice ?? '',
    };
    result.synthesized.push(job);
    if (duration !== undefined) result.seconds += duration;
    console.log(`✓ ${(bytes.length / 1024).toFixed(0)}KB${duration !== undefined ? ` ${duration.toFixed(1)}s` : ''}`);
  }

  if (!options.dryRun && result.synthesized.length > 0) {
    writeFileSync(
      path.join(courseDir, 'voice.lock.yaml'),
      stringifyYaml(lock, 'voice.lock — TTS cache: audioKey(text|voice|speed) → synthesized file. Managed by the voice module.'),
    );
  }

  const totalDuration = Object.values(lock)
    .filter((e) => typeof e['duration'] === 'number' && !String(e['file'] ?? '').includes('orphan'))
    .reduce((acc, e) => acc + Number(e['duration']), 0);

  return {
    ...result,
    provider: cfg.provider,
    voice: effectiveVoice ?? '(default)',
    audioMisses: audioMisses.length,
    totalSeconds: totalDuration,
  };
}

/**
 * Prune dead audio: lock entries (and their files) whose speech line no longer
 * exists — the residue of edited 讲稿. `orphan:` entries from unpacked courses
 * are preserved (they intentionally ride in mediaIndex).
 * @param {string} courseDir
 * @param {{ dryRun?: boolean }} options
 */
export function pruneAudio(courseDir, options = {}) {
  const project = readCourse(courseDir);
  const effectiveVoice = project.voice.voice;
  const effectiveSpeed = project.voice.speed;
  const usedFiles = new Set();
  for (const scene of project.scenes) {
    for (const block of scene.speech) {
      if (block.kind !== 'speech') continue;
      const entry = project.voiceLock[audioKey(block.text, effectiveVoice, effectiveSpeed)];
      if (typeof entry?.['file'] === 'string') usedFiles.add(String(entry['file']));
    }
  }
  /** @type {string[]} */
  const deadKeys = [];
  const kept = {};
  for (const [key, entry] of Object.entries(project.voiceLock)) {
    if (key.startsWith('orphan:') || usedFiles.has(String(entry['file'] ?? ''))) {
      kept[key] = entry;
    } else {
      deadKeys.push(key);
    }
  }
  if (options.dryRun || deadKeys.length === 0) {
    return { pruned: deadKeys.length, kept: Object.keys(kept).length, dryRun: true, deadKeys };
  }
  writeFileSync(
    path.join(courseDir, 'voice.lock.yaml'),
    stringifyYaml(kept, 'voice.lock — TTS cache: audioKey(text|voice|speed) → synthesized file. Managed by the voice module.'),
  );
  for (const key of deadKeys) {
    const file = project.voiceLock[key]?.['file'];
    if (typeof file === 'string') {
      const local = path.join(courseDir, file);
      if (existsSync(local)) rmSync(local, { force: true });
    }
  }
  return { pruned: deadKeys.length, kept: Object.keys(kept).length, dryRun: false, deadKeys };
}


/**
 * Verify text↔audio sync (the manual-edit guard): every speech line must
 * resolve through audioKey → voice.lock → existing file with a duration;
 * lock entries no longer referenced are dead; durations far off the
 * chars/rate expectation flag suspicious (hand-swapped) files.
 * @param {string} courseDir
 * @returns {{ ok: {scene:string,text:string}[], missing: {scene:string,text:string,key:string}[], fileMissing: {scene:string,file:string}[], dead: string[], suspicious: {scene:string,file:string,duration:number,expect:number}[] }}
 */
export function verifyAudio(courseDir) {
  const project = readCourse(courseDir);
  const voice = project.voice.voice;
  const speed = project.voice.speed;
  /** @type {any} */
  const r = { ok: [], missing: [], fileMissing: [], dead: [], suspicious: [] };
  const usedKeys = new Set();
  for (const scene of project.scenes) {
    for (const block of scene.speech) {
      if (block.kind !== 'speech') continue;
      const key = audioKey(block.text, voice, speed);
      usedKeys.add(key);
      const entry = project.voiceLock[key];
      if (!entry || typeof entry['file'] !== 'string') {
        r.missing.push({ scene: scene.file, text: block.text.slice(0, 36), key });
        continue;
      }
      const local = path.join(courseDir, String(entry['file']));
      if (!existsSync(local)) {
        r.fileMissing.push({ scene: scene.file, file: String(entry['file']) });
        continue;
      }
      r.ok.push({ scene: scene.file, text: block.text.slice(0, 36) });
      // duration sanity: zh ≈370 chars/min (speech-style §9 实测口径)
      const dur = Number(entry['duration']);
      if (Number.isFinite(dur) && dur > 0) {
        const expect = (block.text.length / 370) * 60;
        if (Math.abs(dur - expect) / expect > 0.5) {
          r.suspicious.push({ scene: scene.file, file: String(entry['file']), duration: dur, expect: Math.round(expect) });
        }
      }
    }
  }
  for (const [key, entry] of Object.entries(project.voiceLock)) {
    if (!key.startsWith('orphan:') && !usedKeys.has(key)) r.dead.push(String(entry['file']));
  }
  return r;
}

/** Environment / connectivity doctor. Synthesizes one short sentence. */
export async function ttsDoctor() {
  const cfg = resolveTtsConfig();
  console.log(`provider: ${cfg.provider}`);
  console.log(`  MAIC_TTS_API_KEY: ${process.env['MAIC_TTS_API_KEY'] ? '<env>' : cfg.provider === 'doubao' ? (cfg.apiKey ? '<arkcli 自动取到>' : '✗ 未配置') : '—'}`);
  console.log(`  voice: ${cfg.voice ?? '(provider default)'} | speed: ${cfg.speed}`);
  console.log(`  ffprobe: ${whichBin('ffprobe') ? '✓' : '✗（时长将缺失，导入仍可用）'}`);
  if (cfg.provider === 'edge') console.log(`  edge-tts CLI: ${whichBin('edge-tts') ? '✓' : '✗ pip install edge-tts'}`);
  if (cfg.provider === 'platform') console.log(`  platform: ${cfg.platformUrl}`);

  const probe = '语音连通性测试。';
  process.stdout.write(`  试合成「${probe}」… `);
  try {
    const bytes = await synthesize(probe, cfg);
    const tmp = path.join(os.tmpdir(), `maic-doctor-${Date.now()}.mp3`);
    writeFileSync(tmp, bytes);
    const duration = probeDuration(tmp);
    rmSync(tmp, { force: true });
    console.log(`✓ ${cfg.provider} 返回 ${(bytes.length / 1024).toFixed(0)}KB mp3${duration ? `，${duration.toFixed(2)}s` : ''} —— 连通正常`);
    return true;
  } catch (err) {
    console.log(`✗ ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/** @param {string} [range] "3-5,8" */
function parseRange(range) {
  if (!range) return undefined;
  const set = new Set();
  for (const part of range.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const from = Number.parseInt(m[1], 10);
    const to = m[2] ? Number.parseInt(m[2], 10) : from;
    for (let i = from; i <= to; i++) set.add(i);
  }
  return set.size > 0 ? set : undefined;
}

function whichBin(bin) {
  const probe = process.platform === 'win32' ? spawnSync('where', [bin]) : spawnSync('which', [bin]);
  return probe.status === 0;
}

/** @param {string} s */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (isMain) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === 'doctor') {
      process.exit((await ttsDoctor()) ? 0 : 1);
    }
    if (args[0] === 'verify') {
      const r = verifyAudio(path.resolve(args[1] ?? '.'));
      for (const m of r.missing) console.error(`  ✗ 失配（讲稿已改，音频未重合成）${m.scene}: ${m.text}…`);
      for (const m of r.fileMissing) console.error(`  ✗ 音频文件缺失 ${m.scene}: ${m.file}`);
      for (const s of r.suspicious) console.log(`  ⚠ 时长可疑（可能换错文件）${s.scene}: ${s.file} 实测 ${s.duration.toFixed(1)}s vs 字数预期 ≈${s.expect}s`);
      for (const d of r.dead) console.log(`  · 死音频（讲稿已不含此句）: ${d}`);
      const bad = r.missing.length + r.fileMissing.length;
      console.log(`音频同步: ${bad ? '✗ 不同步' : '✓ 同步'} · 一致 ${r.ok.length} / 失配 ${r.missing.length} / 文件缺失 ${r.fileMissing.length} / 可疑 ${r.suspicious.length} / 死音频 ${r.dead.length}`);
      if (bad) console.log(`  → node scripts/tts.mjs <dir>（增量补齐）&& node scripts/tts.mjs prune <dir>（清死音频）`);
      process.exit(bad ? 1 : 0);
    }
    if (args[0] === 'prune') {
      const r = pruneAudio(path.resolve(args[1] ?? '.'), { dryRun: args.includes('--dry-run') });
      if (r.dryRun) {
        console.log(r.pruned === 0 ? '✓ 无死音频' : `将清理 ${r.pruned} 条死音频（--dry-run 未执行）`);
      } else {
        console.log(`✓ 清理 ${r.pruned} 条死音频（保留 ${r.kept} 条在用）`);
      }
      process.exit(0);
    }
    if (args.length === 0 || args[0] === '--help') {
      console.log('usage: node scripts/tts.mjs doctor | verify | prune | <courseDir> [--dry-run] [--force] [--scenes 3-5] [--provider …] [--voice …] [--speed …]');
      process.exit(0);
    }
    const courseDir = path.resolve(args[0]);
    const flag = (/** @type {string} */ name) => {
      const i = args.indexOf(name);
      return i >= 0 ? args[i + 1] : undefined;
    };
    const result = await voiceCourse(courseDir, {
      dryRun: args.includes('--dry-run'),
      force: args.includes('--force'),
      range: flag('--scenes'),
      provider: flag('--provider'),
      voice: flag('--voice'),
      speed: flag('--speed') !== undefined ? Number(flag('--speed')) : undefined,
    });
    const mins = Math.round(result.totalSeconds / 60 * 10) / 10;
    if (args.includes('--dry-run')) {
      console.log(`dry-run[${result.provider}]：待合成 ${result.synthesized.length} 句（${result.chars} 字），缓存命中 ${result.cached.length} 句`);
      console.log(`  音色 ${result.voice} | 全课音频总长 ≈ ${mins}min | 缺音频讲稿句 ${result.audioMisses}`);
    } else {
      console.log(`✓ 合成 ${result.synthesized.length} 句，缓存复用 ${result.cached.length} 句 → audio/ + voice.lock.yaml`);
      console.log(`  音色 ${result.voice} | 全课音频总长 ≈ ${mins}min`);
      console.log(`  下一步: node scripts/preview.mjs ${courseDir} 审片 → node scripts/build.mjs ${courseDir} 出包`);
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
