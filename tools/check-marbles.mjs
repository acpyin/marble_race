// Verifies the five themed marble groups, random single-group 8-marble draw,
// material/pattern generation, and vault storage under a minimal DOM stub.
import assert from 'node:assert/strict';

const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'canvas') return { width: 768, height: 384 };
    return () => {};
  },
  set() { return true; },
});
globalThis.document = {
  createElement() {
    return { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,stub' };
  },
};

const { MARBLE_CATALOG, MARBLE_GROUPS, pickMarbles, makeMarbleMaterial, marblePreview } = await import('../src/marbles.js');

assert.equal(MARBLE_CATALOG.length, 58, 'catalog holds 58 marbles');
assert.equal(new Set(MARBLE_CATALOG.map(m => m[0])).size, 58, 'marble names are unique');
for (const retired of ['虎纹', '斑马', '熔岩', '陨星', '缠丝', '孔雀', '青花']) assert.ok(!MARBLE_CATALOG.some(([name]) => name === retired), `${retired} is retired`);
for (const added of ['千花', '木星', '欧泊', '蜻蜓眼', '水晶', '猫眼', '青金', '绿松', '龙鳞', '珐琅', '青花瓷', '汝窑', '钧窑', '官窑', '哥窑', '龙泉青瓷', '釉里红', '唐三彩', '冰裂', '土星', '地球', '月球', '海王星', '金星', '拉长石', '月光石', '紫晶', '黑曜', '脉冲星', '太阳', '水星', '火星', '天王星', '冥王星']) assert.ok(MARBLE_CATALOG.some(([name]) => name === added), `${added} is in the catalog`);

assert.equal(MARBLE_GROUPS.length, 4, 'catalog is split into four groups');
assert.deepEqual(MARBLE_GROUPS.map(group => group.id), ['solid', 'pattern', 'cosmic', 'porcelain'], 'groups are solid, pattern, solar system and porcelain');
const GROUP_OF = new Map(MARBLE_GROUPS.flatMap(group => group.names.map(name => [name, group.id])));
const groupedNames = MARBLE_GROUPS.flatMap(group => group.names);
assert.equal(groupedNames.length, MARBLE_CATALOG.length, 'the five groups cover the whole catalog');
assert.equal(new Set(groupedNames).size, groupedNames.length, 'no marble belongs to two groups');
for (const group of MARBLE_GROUPS) assert.ok(group.names.length >= 8, `${group.id} holds a full eight-marble roster`);
for (const [name] of MARBLE_CATALOG) assert.ok(GROUP_OF.has(name), `${name} belongs to a group`);

let seed = 42;
const rng = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
const seenGroups = new Set();
for (let round = 0; round < 80; round++) {
  const pick = pickMarbles(8, rng);
  assert.equal(pick.length, 8);
  assert.equal(new Set(pick.map(m => m[0])).size, 8, 'a race draws 8 distinct marbles');
  const groupIds = new Set(pick.map(([name]) => GROUP_OF.get(name)));
  assert.equal(groupIds.size, 1, 'a race always draws from a single group');
  seenGroups.add([...groupIds][0]);
}
assert.equal(seenGroups.size, 4, 'every group can host a race');
const solar = MARBLE_GROUPS.find(group => group.id === 'cosmic');
assert.equal(solar.names.length, 10, 'the solar family is the Sun plus nine planets');
for (const body of ['太阳', '水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星', '冥王星']) assert.ok(solar.names.includes(body), `${body} belongs to the solar group`);

for (const [name, color, style] of MARBLE_CATALOG) {
  const material = makeMarbleMaterial(color, style);
  assert.ok(material.isMeshPhysicalMaterial, `${name} has a physical material`);
  const preview = marblePreview(color, style, material);
  assert.match(preview, /^data:image\/png;base64,/, `${name} has a preview`);
}
const crystal = makeMarbleMaterial(0xe8fbff, 'crystal');
assert.ok(crystal.transparent && crystal.transmission >= .9, 'crystal is a genuinely transparent glass marble');

const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
const { addCollected, collectionOwned, loadCollection } = await import('../src/collection.js');
assert.equal(collectionOwned(), 0);
const first = addCollected('青岚');
assert.equal(first.isNew, true);
assert.equal(first.count, 1);
const again = addCollected('青岚');
assert.equal(again.isNew, false);
assert.equal(again.count, 2);
assert.equal(collectionOwned(), 1, 'repeat win does not add a slot');
addCollected('极光');
assert.equal(collectionOwned(), 2);
store.set('marble-race-collection-v1', '{broken json');
assert.equal(collectionOwned(), 0, 'corrupt storage degrades to empty');
assert.deepEqual(loadCollection(), {});
store.set('marble-race-collection-v1', JSON.stringify({
  熔岩: { count: 3, firstAt: '2026-01-01T00:00:00.000Z', lastAt: '2026-01-01T00:00:00.000Z' },
  缠丝: { count: 2, firstAt: '2026-01-01T00:00:00.000Z', lastAt: '2026-01-01T00:00:00.000Z' },
  孔雀: { count: 2, firstAt: '2026-01-01T00:00:00.000Z', lastAt: '2026-01-01T00:00:00.000Z' },
  青花: { count: 2, firstAt: '2026-01-01T00:00:00.000Z', lastAt: '2026-01-01T00:00:00.000Z' },
  千花: { count: 1, firstAt: '2026-01-02T00:00:00.000Z', lastAt: '2026-01-02T00:00:00.000Z' },
}));
assert.equal(collectionOwned(), 1, 'retired marbles in old saves do not inflate progress');

console.log('Marble checks passed: 4 groups covering 58 marbles, Sun plus nine planets, single-group draw of 8, 58 materials/previews, vault persistence.');
