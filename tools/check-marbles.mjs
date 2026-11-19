// Verifies the 28-marble catalog, random 8-marble draw, material/pattern
// generation, and the collection vault storage logic under a minimal DOM stub.
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

const { MARBLE_CATALOG, pickMarbles, makeMarbleMaterial, marblePreview } = await import('../src/marbles.js');

assert.equal(MARBLE_CATALOG.length, 28, 'catalog holds 28 marbles');
assert.equal(new Set(MARBLE_CATALOG.map(m => m[0])).size, 28, 'marble names are unique');

let seed = 42;
const rng = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
for (let round = 0; round < 20; round++) {
  const pick = pickMarbles(8, rng);
  assert.equal(pick.length, 8);
  assert.equal(new Set(pick.map(m => m[0])).size, 8, 'a race draws 8 distinct marbles');
}

for (const [name, color, style] of MARBLE_CATALOG) {
  const material = makeMarbleMaterial(color, style);
  assert.ok(material.isMeshPhysicalMaterial, `${name} has a physical material`);
  const preview = marblePreview(color, style, material);
  assert.match(preview, /^data:image\/png;base64,/, `${name} has a preview`);
}

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

console.log('Marble checks passed: 28 catalog, unique draw of 8, 28 materials/previews, vault persistence.');
