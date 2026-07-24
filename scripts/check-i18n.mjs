// i18n consistency check:
// 1. every literal t('...') key in src/ must exist in zh.json and en.json
// 2. zh.json and en.json must have identical key sets
// Exits non-zero on failure. Run: npm run check:i18n
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

const keyRe = /\bt\(\s*['"`]([^'"`]+?)['"`]/g;
const codeKeys = new Set();
for (const f of walk(SRC)) {
  const text = readFileSync(f, 'utf8');
  let m;
  while ((m = keyRe.exec(text))) {
    if (!m[1].includes('${') && !m[1].includes('\\')) codeKeys.add(m[1]);
  }
}

const zh = flatten(JSON.parse(readFileSync(join(SRC, 'i18n/zh.json'), 'utf8')));
const en = flatten(JSON.parse(readFileSync(join(SRC, 'i18n/en.json'), 'utf8')));

let failed = false;
const report = (label, keys) => {
  if (keys.length === 0) return;
  failed = true;
  console.error(`✗ ${label} (${keys.length}):`);
  for (const k of keys) console.error(`    ${k}`);
};

report('keys used in code but missing from zh.json', [...codeKeys].filter(k => !zh.has(k)).sort());
report('keys used in code but missing from en.json', [...codeKeys].filter(k => !en.has(k)).sort());
report('keys only in zh.json', [...zh].filter(k => !en.has(k)).sort());
report('keys only in en.json', [...en].filter(k => !zh.has(k)).sort());

if (failed) process.exit(1);
console.log(`✓ i18n OK: ${codeKeys.size} code keys covered; zh/en both have ${zh.size} keys.`);
