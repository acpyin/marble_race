// Guards the five locale packs against drift: same keys, same placeholders,
// same corpus shapes. Run with `node tools/check-i18n.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async name => (await import(pathToFile(name))).default;
const pathToFile = name => new URL(`../src/i18n/locales/${name}.js`, import.meta.url).href;

const codes = ['zh', 'en', 'ru', 'fr', 'ja'];
const packs = {};
for (const code of codes) packs[code] = await load(code);

const zh = packs.zh;
const sorted = object => Object.keys(object || {}).sort();
const placeholders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',');

assert.equal(zh.id, 'zh-CN', 'zh pack id');
for (const code of codes) {
  const pack = packs[code];
  assert.ok(pack.label && pack.htmlLang && pack.voiceLang, `${code}: meta fields`);
  assert.deepEqual(sorted(pack.ui), sorted(zh.ui), `${code}: ui keys`);
  for (const key of sorted(zh.ui)) {
    assert.equal(placeholders(pack.ui[key]), placeholders(zh.ui[key]), `${code}: placeholders in ${key}`);
    assert.ok(String(pack.ui[key]).trim().length > 0, `${code}: ${key} is empty`);
    assert.ok(!/\{\s|\s\}/.test(pack.ui[key]), `${code}: ${key} has a padded placeholder`);
  }
  assert.deepEqual(sorted(pack.racers), sorted(zh.racers), `${code}: racer keys`);
  assert.deepEqual(sorted(pack.woods), sorted(zh.woods), `${code}: wood keys`);
  assert.deepEqual(sorted(pack.stages), sorted(zh.stages), `${code}: stage keys`);
  assert.deepEqual(sorted(pack.modules), sorted(zh.modules), `${code}: module keys`);
  assert.equal(Object.keys(pack.stages).length, 44, `${code}: 44 stage labels`);

  // Danmaku: same categories, every one usable, no stray placeholders.
  assert.deepEqual(sorted(pack.danmaku), sorted(zh.danmaku), `${code}: danmaku categories`);
  for (const kind of sorted(zh.danmaku)) {
    const pool = pack.danmaku[kind];
    assert.ok(Array.isArray(pool) && pool.length >= 12, `${code}: ${kind} needs at least 12 lines`);
    assert.equal(new Set(pool).size, pool.length, `${code}: duplicate ${kind} lines`);
    for (const line of pool) {
      assert.ok(line.trim().length > 0, `${code}: empty ${kind} line`);
      assert.ok(!/\{\s|\s\}/.test(line), `${code}: padded placeholder in ${kind}`);
      for (const name of String(line).matchAll(/\{(\w+)\}/g)) assert.ok(['name', 'rival', 'gain', 'stage', 'speed'].includes(name[1]), `${code}: unknown danmaku placeholder ${name[1]}`);
    }
  }

  // Commentary: identical event keys, same template vocabulary.
  assert.deepEqual(sorted(pack.commentary.live), sorted(zh.commentary.live), `${code}: commentary keys`);
  for (const kind of sorted(zh.commentary.live)) {
    const pool = pack.commentary.live[kind];
    assert.ok(pool.length >= 3, `${code}: ${kind} needs at least 3 lines`);
    for (const line of pool) {
      for (const name of String(line).matchAll(/\{(\w+)\}/g)) {
        assert.ok(['name', 'rival', 'gain', 'rank', 'oldRank', 'gapText', 'names', 'stage', 'reason'].includes(name[1]), `${code}: unknown commentary placeholder ${name[1]}`);
      }
    }
  }
  assert.equal(pack.commentary.stageDetails.length, 30, `${code}: 30 stage details`);
  assert.deepEqual(sorted(pack.commentary.openingDetails), sorted(zh.commentary.openingDetails), `${code}: opening detail keys`);
  assert.deepEqual(sorted(pack.commentary.moduleDetails), sorted(zh.commentary.moduleDetails), `${code}: module detail keys`);
  assert.deepEqual(sorted(pack.commentary.keyStageFocus), sorted(zh.commentary.keyStageFocus), `${code}: key stage focus keys`);
}

// Every key used by the markup must exist, and every pack must stay Chinese-free
// in its values (the stage/opening identifiers live in object keys, not values).
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const used = new Set([...html.matchAll(/data-i18n(?:-aria|-title|-placeholder)?="([^"]+)"/g)].map(match => match[1]));
for (const key of used) assert.ok(key in zh.ui, `index.html uses missing key ${key}`);

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

// Japanese shares the CJK ideograph range, so it is exempt from this scan.
for (const code of codes.filter(name => name !== 'zh' && name !== 'ja')) {
  const leftovers = collectStrings(packs[code]).filter(text => /[\u4e00-\u9fff]{2,}/.test(text));
  assert.equal(leftovers.length, 0, `${code}: untranslated Chinese remains: ${leftovers.slice(0, 3).join(' / ')}`);
}

console.log(`i18n checks passed: ${codes.length} locales × ${Object.keys(zh.ui).length} UI keys, ${Object.keys(zh.danmaku).length} danmaku categories, ${Object.keys(zh.commentary.live).length} commentary events.`);
