/**
 * Tiny YAML-subset parser/stringifier — zero dependencies.
 *
 * The skill's source files (course.yaml, voice.lock.yaml, media.lock.yaml and
 * scene frontmatter) are written by this skill's own tools and edited by
 * humans/agents within a documented shape, so a full YAML implementation is
 * unnecessary. Supported subset:
 *
 *   - nested maps by 2-space indentation (any depth), keys are plain scalars
 *   - scalar values: JSON-looking ({...} / [...] → embedded JSON), true/false,
 *     null, numbers, quoted strings ('...' / "..."), raw strings
 *   - lists of scalars ("- item") under a "key:" block; lists of maps are NOT
 *     supported — use a sibling .json file instead (e.g. agents.json)
 *   - full-line comments (# ...) and blank lines
 *
 * Reparse rule for values emitted by stringify(): a scalar containing ": ",
 * " #", leading/trailing whitespace, or starting with a YAML indicator is
 * always quoted, so the writer/reader pair round-trips.
 */

/** @typedef {Record<string, unknown>} YMap */

/** @typedef {{ indent: number, kind: 'map', map: YMap, key: string | null, owner: YMap | null }} MapFrame */
/** @typedef {{ indent: number, kind: 'list', list: unknown[] }} ListFrame */

/**
 * Parse a YAML-subset document into a plain object.
 * @param {string} text
 * @returns {YMap}
 */
export function parseYaml(text) {
  const root = {};
  /** @type {(MapFrame | ListFrame)[]} */
  const stack = [{ indent: -1, kind: 'map', map: root, key: null, owner: null }];

  for (const rawLine of text.split(/\r?\n/)) {
    const noComment = stripComment(rawLine);
    if (!noComment.trim()) continue;
    const indent = countIndent(noComment);
    const line = noComment.trim();

    if (line.startsWith('- ') || line === '-') {
      // Pop map frames until the top frame is shallower than this item.
      while (stack.length > 1 && top(stack).indent >= indent) stack.pop();
      let frame = top(stack);
      // A fresh map placeholder (from the preceding "key:" line) becomes a
      // list container on its first "- item". Only an *empty* placeholder
      // converts — one with map children followed by a list item is malformed.
      if (frame.kind === 'map' && frame.owner !== null && frame.key !== null) {
        if (Object.keys(frame.map).length > 0) {
          throw new Error(`List item after map entries under "${frame.key}": ${line}`);
        }
        const list = [];
        frame.owner[frame.key] = list;
        frame = { indent: frame.indent, kind: 'list', list };
        stack[stack.length - 1] = frame;
      }
      if (frame.kind !== 'list') throw new Error(`List item outside a list: ${line}`);
      const itemText = line === '-' ? '' : line.slice(2).trim();
      frame.list.push(parseScalar(itemText));
      continue;
    }

    const colon = findKeyColon(line);
    if (colon < 0) throw new Error(`Not a key: value line: ${line}`);
    const key = unquote(line.slice(0, colon).trim());
    const rest = line.slice(colon + 1).trim();

    // Pop frames at deeper-or-equal indent (list frames always pop; a sibling
    // map key at the same indent pops the previous map frame).
    while (stack.length > 1 && top(stack).indent >= indent) stack.pop();
    const parentFrame = top(stack);
    if (parentFrame.kind !== 'map') throw new Error(`Key under a list: ${line}`);
    const parent = parentFrame.map;

    if (rest === '') {
      // Block form — placeholder map; the *next* line decides map vs list by
      // being "key:" (map) or "- item" (list, converted on demand).
      parent[key] = {};
      stack.push({
        indent,
        kind: 'map',
        map: /** @type {YMap} */ (parent[key]),
        key,
        owner: parent,
      });
    } else {
      parent[key] = parseScalar(rest);
    }
  }

  return root;
}

/**
 * @param {(MapFrame | ListFrame)[]} stack
 */
function top(stack) {
  return stack[stack.length - 1];
}

/**
 * Stringify a plain object into the same subset (maps + scalar leaves; scalar
 * lists allowed). Values that are plain objects/arrays are emitted as inline
 * JSON (single line) — a documented convention of this subset.
 * @param {YMap} obj
 * @param {string} [header]
 * @returns {string}
 */
export function stringifyYaml(obj, header) {
  const out = header ? [`# ${header}`] : [];
  emitMap(obj, 0, out);
  return out.join('\n') + '\n';
}

/**
 * @param {YMap} obj
 * @param {number} depth
 * @param {string[]} out
 */
function emitMap(obj, depth, out) {
  const pad = '  '.repeat(depth);
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (isPlainObject(value)) {
      if (Object.keys(value).length === 0) {
        out.push(`${pad}${key}: {}`);
      } else {
        out.push(`${pad}${key}:`);
        emitMap(/** @type {YMap} */ (value), depth + 1, out);
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        out.push(`${pad}${key}: []`);
      } else {
        out.push(`${pad}${key}:`);
        for (const item of value) out.push(`${pad}  - ${formatScalar(item)}`);
      }
    } else {
      out.push(`${pad}${key}: ${formatScalar(value)}`);
    }
  }
}

/**
 * Parse one scalar according to the subset rules.
 * @param {string} raw
 * @returns {unknown}
 */
export function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return '';
  // JSON-looking values are embedded verbatim.
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return JSON.parse(s);
    } catch {
      // fall through: treat as raw string
    }
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return unquote(s);
  }
  return s;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatScalar(value) {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  const s = /** @type {string} */ (value);
  if (s === '') return '""';
  if (/[:#]/.test(s) || /^\s|\s$/.test(s) || /^[-?[\]{},&*!|>'"%@`]/.test(s)) {
    return JSON.stringify(s); // JSON quoting is valid YAML quoting for our subset
  }
  return s;
}

/**
 * @param {string} line
 * @returns {string}
 */
function stripComment(line) {
  // A '#' preceded by whitespace or at line start starts a comment — unless
  // inside quotes.
  let inQuote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = '';
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * @param {string} line
 * @returns {number}
 */
function countIndent(line) {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

/**
 * Find the colon that separates key from value (first ':' at top level,
 * respecting quotes; a ':' not followed by space/end is part of the value,
 * e.g. URLs).
 * @param {string} line
 * @returns {number}
 */
function findKeyColon(line) {
  let inQuote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = '';
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ':') {
      if (i === line.length - 1 || line[i + 1] === ' ') return i;
    }
  }
  return -1;
}

/**
 * @param {string} s
 * @returns {string}
 */
function unquote(s) {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const body = s.slice(1, -1);
      return first === '"' ? body.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : body;
    }
  }
  return s;
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
