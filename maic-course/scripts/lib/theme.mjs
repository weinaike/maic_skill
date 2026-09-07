/**
 * theme.mjs — L1 主题包读取与 $token 解析（design-system.md §2/§4）。
 *
 * 主题包 = maic-course/themes/<name>.json；course.yaml 的 design.theme 选包
 * （缺省 platform）。骨架（L2）只写 token 引用，落盘前必须解析为具体色值
 * ——平台 DSL 不认运行时变量。
 *
 *   resolveToken(theme, '$panel.bg')        → '#eff6ff'
 *   resolveToken(theme, '$seq.1')           → '#2563eb'
 *   flattenTheme(theme)                     → Map<'panel.bg', '#eff6ff'>
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './yaml.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 纯文字字段——其中的 #hex 是禁用例/说明，不是色板或 token 成员。 */
const PROSE_KEYS = new Set(['forbidden', 'rules', '$comment', 'name', 'style']);

/**
 * 课程生效主题名：course.yaml design.theme，缺省 platform。
 * @param {string} courseDir
 */
export function themeNameOf(courseDir) {
  const coursePath = path.join(courseDir, 'course.yaml');
  if (!existsSync(coursePath)) return 'platform';
  const course = parseYaml(readFileSync(coursePath, 'utf8'));
  const design = course['design'];
  const name = design && typeof design === 'object' ? design['theme'] : design;
  return typeof name === 'string' && name.trim() ? name.trim() : 'platform';
}

/**
 * 读取主题包；不存在即抛错（无色板 = 无一致性基准）。
 * @param {string} name
 */
export function loadTheme(name) {
  const p = path.join(SKILL_DIR, 'themes', `${name}.json`);
  if (!existsSync(p)) throw new Error(`主题包缺失：${p}（先建主题或改 course.yaml design.theme）`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** 课程生效主题包（design.theme → themes/<name>.json）。 */
export function loadThemeFor(courseDir) {
  return loadTheme(themeNameOf(courseDir));
}

/**
 * 主题扁平化：嵌套对象/数组 → 'panel.bg' / 'seq.1' 点路径。
 * PROSE 字段（forbidden/rules 等）不参与——它们不是色板。
 * @param {any} node
 * @param {string} prefix
 * @returns {Map<string, string>}
 */
export function flattenTheme(node, prefix = '') {
  const out = new Map();
  if (node === null || node === undefined) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    if (prefix) out.set(prefix, String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => { for (const [k, val] of flattenTheme(v, `${prefix}.${i}`)) out.set(k, val); });
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$') || PROSE_KEYS.has(k)) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || typeof v === 'number') out.set(key, String(v));
    else for (const [k2, val] of flattenTheme(v, key)) out.set(k2, val);
  }
  return out;
}

/**
 * 解析单个 $token 引用；未命中抛错（宁失败不猜色）。
 * @param {Record<string, unknown>} theme
 * @param {string} ref 形如 '$panel.bg' / '$seq.1'
 */
export function resolveToken(theme, ref) {
  if (!ref.startsWith('$')) return ref;
  const key = ref.slice(1);
  const flat = flattenTheme(theme);
  if (!flat.has(key)) throw new Error(`主题 token 未命中：$${key}（检查 themes/${theme['name']}.json 的字段路径）`);
  return flat.get(key);
}

/**
 * 把画布 JSON 里全部 '$x.y' 引用解析为具体值。
 * 两级严格度：纯引用（"fill": "$panel.bg"）未命中即抛错——宁失败不猜色；
 * 长文本内嵌（讲稿/命令里的 shell $VAR、style 里混排）尽力替换、未命中保留
 * 原文（不误伤 $PATH 这类内容），由调用方计数回报。
 * @param {any} canvas
 * @param {Record<string, unknown>} theme
 * @returns {{ canvas: any, resolved: number, unresolved: string[] }}
 */
export function resolveCanvasTokens(canvas, theme) {
  const flat = flattenTheme(theme);
  let resolved = 0;
  /** @type {string[]} */
  const unresolved = [];
  const STRICT_FIELDS = new Set(['fill', 'defaultColor', 'color']);
  const walk = (node, key = '') => {
    if (typeof node === 'string') {
      if (!node.includes('$')) return node;
      const strict = STRICT_FIELDS.has(key);
      const pure = /^\$[A-Za-z0-9_.]+$/.test(node);
      if (strict && pure && flat.has(node.slice(1))) {
        resolved++;
        return flat.get(node.slice(1));
      }
      if (strict && pure) {
        throw new Error(`主题 token 未命中：${node}（色值字段只许 $token 引用，检查主题包字段路径）`);
      }
      return node.replace(/\$([A-Za-z0-9_.]+)/g, (whole, k2) => {
        if (!flat.has(k2)) { unresolved.push(whole); return whole; }
        resolved++;
        return flat.get(k2);
      });
    }
    if (Array.isArray(node)) return node.map((v) => walk(v, key));
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, k);
      return out;
    }
    return node;
  };
  return { canvas: walk(canvas), resolved, unresolved };
}
