#!/usr/bin/env node
/**
 * translate.mjs — course translation, mechanical half.
 *
 * A translation is a DERIVED course project: full structural copy (scene
 * order, canvas geometry, element ids, quiz/pbl skeletons) with content
 * translated in place. Audio is deliberately NOT copied — cache keys embed
 * voice, and a target-language course re-synthesizes with a target voice.
 *
 *   init    scaffold the target course from a source course
 *   verify  mechanical parity + residue checks (structure is script-verified,
 *           meaning is reviewed by the translation reviewer — see T1-T5)
 *
 * Usage:
 *   node scripts/translate.mjs init <srcCourseDir> <targetDir> --lang en [--voice <id>]
 *   node scripts/translate.mjs verify <targetDir> [--strict]
 *
 * verify exit 1 on: structural divergence (ids/counts/spotlights vs source),
 * or (--strict) source-language residue in a non-zh target.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from './lib/course.mjs';
import { isMainModule } from './lib/main.mjs';

const isMain = isMainModule(import.meta.url);

// ---------------------------------------------------------------------------
// init — scaffold the derived course
// ---------------------------------------------------------------------------

/**
 * @param {string} srcDir
 * @param {string} targetDir
 * @param {{ lang?: string, voice?: string }} options
 */
export function initTranslation(srcDir, targetDir, options = {}) {
  if (!existsSync(path.join(srcDir, 'course.yaml'))) throw new Error(`${srcDir} 不是课程项目`);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`${targetDir} 非空（init 只建新翻译）`);
  }
  const src = readCourse(srcDir);
  const lang = options.lang ?? 'en';
  const now = Date.now();

  mkdirSync(path.join(targetDir, 'scenes'), { recursive: true });
  mkdirSync(path.join(targetDir, 'audio'), { recursive: true });
  mkdirSync(path.join(targetDir, 'build'), { recursive: true });
  if (existsSync(path.join(srcDir, 'media'))) {
    cpSync(path.join(srcDir, 'media'), path.join(targetDir, 'media'), { recursive: true });
  }
  // scenes 复制原样——翻译器在目标课程内就地翻译（源课程保持不动）
  cpSync(path.join(srcDir, 'scenes'), path.join(targetDir, 'scenes'), { recursive: true });

  const courseYaml = [
    '# 翻译课程 —— 由 translate init 生成；[] 待填',
    `name: "TODO：${src.course['name'] ?? ''} 的 ${lang} 译名"`,
    'description: ""',
    `language: "TODO：目标语言授课指令（授课语言=${lang}；列出保留原文的专有名词：MCP、Agent、Claude Code、WorkBuddy、fastmcp、Skill 等）"`,
    `style: ${src.course['style'] ?? 'professional'}`,
    `lang: ${lang}`,
    `sourceLang: zh`,
    `translatedFrom: ${JSON.stringify(path.relative(targetDir, srcDir))}`,
    `createdAt: ${now}`,
    `updatedAt: ${now}`,
    'voice:',
    `  voice: ${options.voice ? JSON.stringify(options.voice) : '""'}`,
    '  speed: 1.0',
    '',
  ].join('\n');
  writeFileSync(path.join(targetDir, 'course.yaml'), courseYaml);

  writeFileSync(
    path.join(targetDir, 'glossary.yaml'),
    [
      '# 术语表 —— 翻译前由术语 pass 填定；译者只读不写，审查按此核对 T2',
      '# 形如  源词: 译法  （保留原文的写  源词: 源词）',
      'MCP: MCP',
      'Agent: Agent',
      'Claude Code: Claude Code',
      'fastmcp: fastmcp',
      '',
    ].join('\n'),
  );
  return { scenes: src.scenes.length, lang };
}

// ---------------------------------------------------------------------------
// verify — structural parity + source-language residue
// ---------------------------------------------------------------------------

/**
 * @param {string} targetDir
 * @param {{ strict?: boolean }} options
 */
export function verifyTranslation(targetDir, options = {}) {
  const target = readCourse(targetDir);
  const rel = target.course['translatedFrom'];
  /** @type {{ errors: string[], warnings: string[], residue: {scene:string,cjk:number,total:number}[] }} */
  const out = { errors: [], warnings: [], residue: [] };
  if (typeof rel !== 'string' || !rel) {
    out.errors.push('course.yaml 缺 translatedFrom（非翻译课程或 init 未完成）');
    return { ...out, target };
  }
  const srcDir = path.resolve(targetDir, rel);
  if (!existsSync(srcDir)) {
    out.errors.push(`translatedFrom 指向不存在: ${rel}`);
    return { ...out, target };
  }
  const src = readCourse(srcDir);

  // 1. scene-level parity
  if (src.scenes.length !== target.scenes.length) {
    out.errors.push(`场景数不一致：源 ${src.scenes.length} / 译 ${target.scenes.length}`);
  }
  const max = Math.min(src.scenes.length, target.scenes.length);
  for (let i = 0; i < max; i++) {
    const s = src.scenes[i];
    const t = target.scenes[i];
    const tag = `场景${i + 1}（源 ${s.file} / 译 ${t.file}）`;
    if (String(s.frontmatter['type']) !== String(t.frontmatter['type'])) out.errors.push(`${tag} type 不一致`);
    const sIds = (s.canvas?.['elements'] ?? []).map((/** @type {any} */ e) => `${e['id']}:${e['type']}`);
    const tIds = (t.canvas?.['elements'] ?? []).map((/** @type {any} */ e) => `${e['id']}:${e['type']}`);
    if (sIds.join('|') !== tIds.join('|')) {
      const missing = sIds.filter((x) => !tIds.includes(x));
      const added = tIds.filter((x) => !sIds.includes(x));
      out.errors.push(`${tag} 画布元素不一致${missing.length ? `，缺失: ${missing.join(',')}` : ''}${added.length ? `，多出: ${added.join(',')}` : ''}`);
    }
    // 非文本元素几何冻结（shape/table/code 位置尺寸不许动；text 元素允许改宽高字号适配译文）
    const sEls = s.canvas?.['elements'] ?? [];
    const tEls = t.canvas?.['elements'] ?? [];
    for (const se of sEls) {
      if (se['type'] === 'text') continue;
      const te = tEls.find((/** @type {any} */ e) => e['id'] === se['id']);
      if (!te) continue;
      for (const g of ['left', 'top', 'width', 'height']) {
        if (se[g] !== undefined && te[g] !== undefined && se[g] !== te[g]) {
          out.errors.push(`${tag} 元素 ${se['id']}（${se['type']}）几何被改动：${g} ${se[g]} → ${te[g]}（非文本元素几何冻结）`);
        }
      }
    }
    // 动作结构：数量、类型序列、spotlight 指向集合
    const sActs = s.speech.flatMap((b) => (b.kind === 'raw' ? [b.action['type']] : ['spotlight:' + b.spotlights.join(','), 'speech']));
    const tActs = t.speech.flatMap((b) => (b.kind === 'raw' ? [b.action['type']] : ['spotlight:' + b.spotlights.join(','), 'speech']));
    if (sActs.filter((x) => x.startsWith('spotlight:')).join('|') !== tActs.filter((x) => x.startsWith('spotlight:')).join('|')) {
      out.errors.push(`${tag} spotlight 序列不一致（译文不得改动指向）`);
    }
    if (sActs.filter((x) => x === 'speech').length !== tActs.filter((x) => x === 'speech').length) {
      out.errors.push(`${tag} 讲稿句数不一致：源 ${sActs.filter((x) => x === 'speech').length} / 译 ${tActs.filter((x) => x === 'speech').length}`);
    }
    // quiz/pbl 骨架
    const sq = (s.quiz?.['questions'] ?? []).length;
    const tq = (t.quiz?.['questions'] ?? []).length;
    if (sq !== tq) out.errors.push(`${tag} quiz 题数不一致：${sq} → ${tq}`);
  }

  // 2. 源语残留（非 zh 目标里的 CJK 比例）
  const lang = String(target.course['lang'] ?? 'en');
  if (lang !== 'zh') {
    for (const scene of target.scenes) {
      let cjk = 0;
      let total = 0;
      const count = (/** @type {string} */ s) => {
        for (const ch of s) {
          total++;
          if (/[一-鿿　-〿＀-￯]/.test(ch)) cjk++;
        }
      };
      for (const block of scene.speech) {
        if (block.kind === 'speech') count(block.text);
      }
      for (const el of scene.canvas?.['elements'] ?? []) {
        if (el['type'] === 'text') count(String(el['content'] ?? '').replace(/<[^>]+>/g, ''));
      }
      if (total > 0 && cjk / total > 0.02) out.residue.push({ scene: scene.file, cjk, total });
    }
    const unDone = out.residue.length;
    if (unDone > 0 && options.strict) out.errors.push(`${unDone} 个场景存在源语残留（CJK>2%，未翻译完成）`);
  }

  // 3. 配音前置提醒
  if (!target.voice.voice) out.warnings.push('目标语音色未设置（配音前须选目标语言音色并 doctor 验证）');
  return { ...out, target };
}

if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  try {
    if (cmd === 'init') {
      const flag = (/** @type {string} */ n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
      const r = initTranslation(path.resolve(args[1] ?? '.'), path.resolve(args[2] ?? '.'), {
        lang: flag('--lang'), voice: flag('--voice'),
      });
      console.log(`✓ 翻译课程已初始化（${r.scenes} 场景复制，lang=${r.lang}；音频不复制——目标语音色全量重合成）`);
      console.log(`  下一步：填 course.yaml 两个 TODO（译名/目标语言指令）→ 术语表 pass → 逐场景翻译（workflow-translate）`);
    } else if (cmd === 'verify') {
      const r = verifyTranslation(path.resolve(args[1] ?? '.'), { strict: args.includes('--strict') });
      for (const e of r.errors) console.error(`  ✗ ${e}`);
      for (const w of r.warnings) console.log(`  ⚠ ${w}`);
      for (const x of r.residue) console.log(`  · 源语残留（未翻译完成？）${x.scene}: CJK ${x.cjk}/${x.total}`);
      const structureOk = r.errors.filter((e) => !e.includes('残留')).length === 0;
      console.log(structureOk ? `✓ 结构一致性通过` : `✗ 结构不一致（翻译不得改动结构）`);
      process.exit(r.errors.length ? 1 : 0);
    } else {
      console.log('usage: node scripts/translate.mjs init <src> <target> --lang en [--voice id] | verify <target> [--strict]');
      process.exit(args[0] === '--help' ? 0 : 2);
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
