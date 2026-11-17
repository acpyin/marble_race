// Seeded per race: repeatable for diagnostics, fresh seeds for normal play.
export function raceRandom(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function startVariation(random) {
  return { lateral: (random() - .5) * .06, longitudinal: 0 };
}
