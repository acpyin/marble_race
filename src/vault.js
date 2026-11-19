// Collection vault UI: renders all 28 marbles, marks captured ones, and stores
// a win when the player's picked marble takes first place.
import { MARBLE_CATALOG, makeMarbleMaterial, marblePreview } from './marbles.js';
import { loadCollection, addCollected, collectionOwned } from './collection.js';
import { racerName, t } from './i18n/index.js';

const previewCache = new Map();
function previewFor(nameKey, color, style) {
  let url = previewCache.get(nameKey);
  if (!url) {
    url = marblePreview(color, style, makeMarbleMaterial(color, style));
    previewCache.set(nameKey, url);
  }
  return url;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function setupVault() {
  const dialog = document.querySelector('#vaultDialog');
  const openBtn = document.querySelector('#vaultBtn');
  const closeBtn = document.querySelector('#vaultClose');
  const grid = document.querySelector('#vaultGrid');
  const badge = document.querySelector('#vaultBadge');
  const progress = document.querySelector('#vaultProgress');
  if (!dialog || !openBtn || !grid) return { refresh() {}, recordWin() {} };

  function refresh() {
    const owned = loadCollection();
    const count = collectionOwned();
    if (badge) badge.textContent = `${count}/${MARBLE_CATALOG.length}`;
    if (progress) progress.textContent = `${count}/${MARBLE_CATALOG.length}`;
    const nodes = MARBLE_CATALOG.map(([nameKey, color, style]) => {
      const entry = owned[nameKey];
      const card = document.createElement('div');
      card.className = `vault-card${entry ? ' is-owned' : ''}`;
      const ball = document.createElement('div');
      ball.className = 'vault-ball';
      if (entry) {
        ball.style.backgroundImage = `url("${previewFor(nameKey, color, style)}")`;
      } else {
        ball.classList.add('is-locked');
      }
      const name = document.createElement('strong');
      name.textContent = entry ? racerName(nameKey) : '???';
      const meta = document.createElement('small');
      meta.textContent = entry
        ? t('vault.times', { count: entry.count }) + (entry.firstAt ? ` · ${formatDate(entry.firstAt)}` : '')
        : t('vault.locked');
      card.append(ball, name, meta);
      card.title = entry ? `${racerName(nameKey)} · ${t('vault.times', { count: entry.count })}` : t('vault.locked');
      return card;
    });
    grid.replaceChildren(...nodes);
  }

  function recordWin(nameKey) {
    if (!nameKey) return;
    const result = addCollected(nameKey);
    refresh();
    if (result?.isNew && badge) {
      badge.classList.remove('is-new');
      void badge.offsetWidth;
      badge.classList.add('is-new');
    }
  }

  openBtn.addEventListener('click', () => { refresh(); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); });
  closeBtn?.addEventListener('click', () => { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); } });

  refresh();
  return { refresh, recordWin };
}
