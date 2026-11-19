// Marble collection vault: persists which champion marbles the player has won.
// Data shape: { [nameKey]: { count: number, firstAt: ISO string, lastAt: ISO string } }
const STORAGE_KEY = 'marble-race-collection-v1';
export { STORAGE_KEY };

export function loadCollection() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const clean = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object') continue;
      const count = Number(value.count);
      if (!Number.isFinite(count) || count < 1) continue;
      clean[key] = {
        count: Math.floor(count),
        firstAt: typeof value.firstAt === 'string' ? value.firstAt : '',
        lastAt: typeof value.lastAt === 'string' ? value.lastAt : '',
      };
    }
    return clean;
  } catch { return {}; }
}

function saveCollection(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

// Records a champion win. Returns the updated entry plus whether it is a new capture.
export function addCollected(nameKey) {
  if (!nameKey) return null;
  const data = loadCollection();
  const now = new Date().toISOString();
  const existing = data[nameKey];
  const isNew = !existing;
  const entry = existing
    ? { count: existing.count + 1, firstAt: existing.firstAt, lastAt: now }
    : { count: 1, firstAt: now, lastAt: now };
  data[nameKey] = entry;
  saveCollection(data);
  return { nameKey, ...entry, isNew };
}

export function collectionOwned() {
  return Object.keys(loadCollection()).length;
}
