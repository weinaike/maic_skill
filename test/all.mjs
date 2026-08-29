#!/usr/bin/env node
/**
 * test/all.mjs — the skill's integration suite. Three layers:
 *
 *   1. skill integrity  — setup --check (SKILL.md frontmatter, references
 *                         inventory, script syntax, dsl vendor loads)
 *   2. fresh-course path — init → 手写最小大纲 → scaffold → 手写最小画布 →
 *                         normalize → check → preview → build，全程无网络无 TTS
 *                         （覆盖"从零新建课程"路径，样例课不经过 init/scaffold）
 *   3. golden round-trip — test/golden-roundtrip.mjs（真实课程的无损/稳定/健全）
 *
 * Usage: node test/all.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, '..', 'maic-course');
const scripts = path.join(skill, 'scripts');

let failures = 0;
const step = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const work = mkdtempSync(path.join(os.tmpdir(), 'maic-all-'));

// --- 1. skill integrity ------------------------------------------------------
const check = run(process.execPath, [path.join(scripts, 'setup.mjs'), '--check']);
step('skill 完整性自检', check.status === 0, check.stdout.trim().split('\n').pop() ?? '');

// --- 2. fresh-course path ------------------------------------------------------
const course = path.join(work, 'fresh');
run(process.execPath, [path.join(scripts, 'init.mjs'), course, '--name', '集成测试课', '--audience', '测试受众']);
step('init 新课程', existsSync(path.join(course, 'course.yaml')) && existsSync(path.join(course, 'scenes')));

// 手写最小大纲（模拟 outline workflow 的产物）
writeFileSync(path.join(course, 'outline.md'), `---
course: 集成测试课
audience: 测试受众
goal: 验证从零建课管线
totalMinutes: 2
style: professional
voice: ""
---

## 1. 开场 · slide · 1min

要点：
- 引入主题
画布意图：标题+一张卡
讲稿意图：一句话开场

## 2. 小测 · quiz · 1min

要点：
- 检验理解
quiz 意图：1 单选
`);
const lint = run(process.execPath, [path.join(scripts, 'outline.mjs'), 'lint', course]);
step('outline lint', lint.status === 0);

run(process.execPath, [path.join(scripts, 'generate.mjs'), 'scaffold', course]);
step('scaffold 骨架', existsSync(path.join(course, 'scenes', '01-开场.md')) && existsSync(path.join(course, 'scenes', '02-小测.md')));

// 填充第 1 页（模拟 generator 产出）
writeFileSync(path.join(course, 'scenes', '01-开场.md'), `---
type: slide
title: 开场
---

## 讲稿

欢迎来到集成测试课，这一页验证从零建课的完整管线。 @[text_title]

## 画布

\`\`\`canvas
{
  "id": "slide_it_1",
  "viewportSize": 1000,
  "viewportRatio": 0.5625,
  "theme": { "backgroundColor": "#ffffff", "themeColors": ["#5b9bd5"], "fontColor": "#333333", "fontName": "Microsoft YaHei" },
  "elements": [
    { "id": "text_title", "type": "text", "left": 60, "top": 50, "width": 880, "height": 62,
      "content": "<p style=\\"font-size: 28px; color: #333333;\\">集成测试课</p>" }
  ],
  "animations": []
}
\`\`\`
`);
writeFileSync(path.join(course, 'scenes', '02-小测.md'), `---
type: quiz
title: 小测
---

## 题目

\`\`\`quiz
{ "questions": [ { "id": "q1", "type": "single", "question": "本页验证什么？",
  "options": [ { "label": "建课管线", "value": "A" }, { "label": "别的", "value": "B" } ],
  "answer": ["A"], "analysis": "测试说明", "hasAnswer": true, "points": 1 } ] }
\`\`\`
`);
run(process.execPath, [path.join(scripts, 'generate.mjs'), 'normalize', path.join(course, 'scenes', '01-开场.md')]);
const check2 = run(process.execPath, [path.join(scripts, 'check.mjs'), course]);
step('check 三层校验（新课，讲稿无音频=预期 warning）', check2.status === 0);

const status = run(process.execPath, [path.join(scripts, 'edit.mjs'), 'status', course]);
step('status 看板（应报 1 句缺音频 → exit 1）', status.status === 1 && status.stdout.includes('缺音频'));

run(process.execPath, [path.join(scripts, 'preview.mjs'), course]);
step('preview 生成', existsSync(path.join(course, 'build', 'preview.html')));

const build = run(process.execPath, [path.join(scripts, 'build.mjs'), course]);
const zipOk = existsSync(path.join(course, 'build', '集成测试课.maic.zip'));
step('build 出包（无音频也允许——warning 不阻断）', build.status === 0 && zipOk);

// review gate on the fresh course: an open blocker must refuse the build
writeFileSync(path.join(course, 'build', 'review', 'outline-review.r1.json'), JSON.stringify({
  scope: 'outline', target: 'outline.md', round: 1, reviewer: 't',
  findings: [{ id: 'O-1', severity: 'blocker', status: 'open', location: 'outline.md', finding: 'x', fix: 'y' }],
}, null, 2));
const blocked = run(process.execPath, [path.join(scripts, 'build.mjs'), course]);
step('review blocker 拒绝出包', blocked.status === 1 && blocked.stderr.includes('blocker'));

// --- 3. golden round-trip ------------------------------------------------------
const golden = spawnSync(process.execPath, [path.join(here, 'golden-roundtrip.mjs')], { stdio: 'inherit' });
step('golden round-trip', golden.status === 0);

rmSync(work, { recursive: true, force: true });
console.log(failures === 0 ? '\n✅ all integration tests PASSED' : `\n❌ ${failures} step(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);

/** @param {string} bin @param {string[]} args */
function run(bin, args) {
  const r = spawnSync(bin, args, { stdio: 'pipe', encoding: 'utf8' });
  if (r.status !== 0 && process.env['MAIC_TEST_VERBOSE']) {
    console.error(`── ${bin} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  }
  return r;
}
