/**
 * Scene source-file parse/serialize — the heart of the course source format.
 *
 * A scene file is Markdown: frontmatter (type/title), a 讲稿 section whose
 * paragraphs compile to speech actions, and JSON fences for the machine
 * payloads. See references/scene-source-spec.md for the full contract.
 *
 *   ---
 *   type: slide
 *   title: 导论封面
 *   ---
 *   ## 讲稿
 *
 *   好，正式进入今天的主题。 @[text_2FzIQGyp]
 *
 *   <!-- action
 *   { "type": "laser", "points": [[500, 280]], "duration": 1500 }
 *   -->
 *
 *   ## 画布
 *
 *   ```canvas
 *   { "id": "slide_x", ... }
 *   ```
 */

/** @typedef {{ kind: 'speech', text: string, spotlights: string[] }} SpeechBlock */
/** @typedef {{ kind: 'raw', action: Record<string, unknown> }} RawBlock */

/** @typedef {{
 *   file: string,
 *   orderPrefix: number,
 *   frontmatter: { type?: string, title?: string },
 *   speech: (SpeechBlock | RawBlock)[],
 *   canvas?: Record<string, unknown>,
 *   quiz?: Record<string, unknown>,
 *   rawContent?: Record<string, unknown>,
 *   whiteboards?: Record<string, unknown>[],
 *   multiAgent?: Record<string, unknown>,
 *   warnings: string[],
 * }} ParsedScene */

const SECTION_RE = /^##[ \t]+(.+?)[ \t]*$/;
const FENCE_RE = /```([\w-]*)[^\n]*\n([\s\S]*?)```/;

/**
 * Parse one scene markdown file.
 * @param {string} text
 * @param {string} file file name for diagnostics
 * @returns {ParsedScene}
 */
export function parseSceneMd(text, file) {
  /** @type {string[]} */
  const warnings = [];
  const { frontmatter, body } = splitFrontmatter(text, file);

  // Split the body into `## name` sections, keeping insertion order.
  /** @type {{ name: string, body: string }[]} */
  const sections = [];
  let preamble = '';
  for (const line of body.split('\n')) {
    const match = line.match(SECTION_RE);
    if (match) {
      sections.push({ name: match[1].trim(), body: '' });
    } else if (sections.length === 0) {
      preamble += line + '\n';
    } else {
      sections[sections.length - 1].body += line + '\n';
    }
  }
  if (preamble.trim()) warnings.push(`${file}: content before the first ## section is ignored`);

  const orderPrefix = Number.parseInt((file.match(/^(\d+)/) ?? [])[1] ?? '', 10);

  /** @type {ParsedScene} */
  const scene = { file, orderPrefix, frontmatter, speech: [], warnings };
  if (Number.isNaN(orderPrefix)) {
    warnings.push(`${file}: no numeric order prefix (NN-title.md); sort order undefined`);
  }

  for (const section of sections) {
    const name = section.name;
    if (name === '讲稿') {
      scene.speech = parseSpeechSection(section.body, file, warnings);
    } else {
      const fence = extractFence(section.body);
      if (!fence) {
        warnings.push(`${file}: section "${name}" has no \`\`\` fence — skipped`);
        continue;
      }
      const json = parseJsonOr(fence, `${file} ## ${name}`, warnings);
      if (json === undefined) continue;
      if (name === '画布') scene.canvas = json;
      else if (name === '题目') scene.quiz = json;
      else if (name === '内容') scene.rawContent = json;
      else if (name === '白板') scene.whiteboards = Array.isArray(json) ? json : [json];
      else if (name === '多智能体') scene.multiAgent = json;
      else warnings.push(`${file}: unknown section "${name}" — skipped`);
    }
  }
  return scene;
}

/**
 * Serialize a scene back to markdown (used by unpack; compile never rewrites
 * source).
 * @param {{
 *   type: string, title: string,
 *   speech: (SpeechBlock | RawBlock)[],
 *   canvas?: unknown, quiz?: unknown, rawContent?: unknown,
 *   whiteboards?: unknown, multiAgent?: unknown,
 * }} scene
 * @returns {string}
 */
export function serializeSceneMd(scene) {
  const out = ['---', `type: ${scene.type}`, `title: ${yamlScalar(scene.title)}`, '---', ''];

  out.push('## 讲稿', '');
  if (scene.speech.length === 0) {
    out.push('（无讲稿）', '');
  }
  for (const block of scene.speech) {
    if (block.kind === 'speech') {
      const annotations = block.spotlights.map((el) => ` @[${el}]`).join('');
      out.push(`${block.text}${annotations}`, '');
    } else {
      out.push(`<!-- action`, JSON.stringify(block.action, null, 2), '-->', '');
    }
  }

  if (scene.canvas !== undefined) {
    out.push('## 画布', '', '```canvas', JSON.stringify(scene.canvas, null, 2), '```', '');
  }
  if (scene.quiz !== undefined) {
    out.push('## 题目', '', '```quiz', JSON.stringify(scene.quiz, null, 2), '```', '');
  }
  if (scene.rawContent !== undefined) {
    out.push('## 内容', '', '```content', JSON.stringify(scene.rawContent, null, 2), '```', '');
  }
  if (scene.whiteboards !== undefined) {
    out.push('## 白板', '', '```whiteboards', JSON.stringify(scene.whiteboards, null, 2), '```', '');
  }
  if (scene.multiAgent !== undefined) {
    out.push('## 多智能体', '', '```multiAgent', JSON.stringify(scene.multiAgent, null, 2), '```', '');
  }
  return out.join('\n');
}

/**
 * Parse the 讲稿 section into ordered blocks: speech paragraphs (with trailing
 * `@[elementId]` annotations that become preceding spotlights) and raw-action
 * HTML comments spliced verbatim.
 * @param {string} body
 * @param {string} file
 * @param {string[]} warnings
 * @returns {(SpeechBlock | RawBlock)[]}
 */
function parseSpeechSection(body, file, warnings) {
  /** @type {(SpeechBlock | RawBlock)[]} */
  const blocks = [];
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/^\s*\n/, '')).filter((p) => p.trim());

  for (const paragraph of paragraphs) {
    const raw = paragraph.trim();
    const rawMatch = raw.match(/^<!--\s*action\s*([\s\S]*?)\s*-->$/);
    if (rawMatch) {
      const action = parseJsonOr(rawMatch[1], `${file} raw action`, warnings);
      if (action !== undefined) blocks.push({ kind: 'raw', action });
      continue;
    }
    // Split trailing @[elementId] annotations from the prose.
    const annotations = [];
    let text = raw;
    const annRe = /(?:\s*@\[[^\]\s]+\])+\s*$/;
    const annMatch = text.match(annRe);
    if (annMatch) {
      text = text.slice(0, text.length - annMatch[0].length).trim();
      for (const m of annMatch[0].matchAll(/@\[([^\]\s]+)\]/g)) {
        if (m[1]) annotations.push(m[1]);
      }
    }
    // Paragraph-internal line breaks collapse to single spaces (manifest
    // speech text is one line).
    text = text.replace(/\s*\n\s*/g, ' ').trim();
    if (!text) {
      warnings.push(`${file}: 讲稿 paragraph has annotations but no text — dropped`);
      continue;
    }
    blocks.push({ kind: 'speech', text, spotlights: annotations });
  }
  return blocks;
}

/**
 * @param {string} text
 * @param {string} file
 */
function splitFrontmatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: {}, body: text };
  }
  // Frontmatter is flat `key: value` lines (subset of lib/yaml.mjs).
  /** @type {Record<string, unknown>} */
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(': ');
    const idx = colon >= 0 ? colon : line.endsWith(':') ? line.length - 1 : -1;
    if (idx < 0) throw new Error(`${file}: bad frontmatter line: ${line}`);
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    frontmatter[key] = scalar(value);
  }
  return { frontmatter, body: text.slice(match[0].length) };
}

/**
 * Extract the first fenced block's content (language-agnostic).
 * @param {string} body
 * @returns {string | undefined}
 */
function extractFence(body) {
  const match = body.match(FENCE_RE);
  return match ? match[2] : undefined;
}

/**
 * @param {string} raw
 * @param {string} where
 * @param {string[]} warnings
 * @returns {Record<string, unknown> | undefined}
 */
function parseJsonOr(raw, where, warnings) {
  try {
    const value = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      warnings.push(`${where}: JSON is not an object — skipped`);
      return undefined;
    }
    return /** @type {Record<string, unknown>} */ (value);
  } catch (err) {
    warnings.push(`${where}: invalid JSON (${err instanceof Error ? err.message : err}) — skipped`);
    return undefined;
  }
}

/**
 * Frontmatter scalar (same rules as lib/yaml.mjs parseScalar, inlined to keep
 * scene.mjs dependency-free).
 * @param {string} s
 */
function scalar(s) {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * YAML-safe scalar for frontmatter emission.
 * @param {string} s
 */
function yamlScalar(s) {
  return /[:#]/.test(s) || /^\s|\s$/.test(s) || /^[-?[\]{},&*!|>'"%@`]/.test(s) || s === ''
    ? JSON.stringify(s)
    : s;
}
