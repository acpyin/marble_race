// Collection vault UI: lists the marbles the player already owns (most recent
// first) and stores a win when the picked marble takes first place.
import { MARBLE_CATALOG, makeMarbleMaterial, marblePreview } from './marbles.js';
import { loadCollection, addCollected, collectionOwned } from './collection.js';
import { onLocaleChange, racerName, t } from './i18n/index.js';

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
  const container = document.querySelector('#vaultGrid');
  const badge = document.querySelector('#vaultBadge');
  const progress = document.querySelector('#vaultProgress');
  if (!dialog || !openBtn || !container) return { refresh() {}, recordWin() {} };

  // Most recently won first, then the most frequently collected.
  function rankOf(entry) {
    const at = Date.parse(entry.lastAt || entry.firstAt || '');
    return { at: Number.isNaN(at) ? 0 : at, count: entry.count || 0 };
  }

  function refresh() {
    const owned = loadCollection();
    const count = collectionOwned();
    if (badge) badge.textContent = `${count}/${MARBLE_CATALOG.length}`;
    if (progress) progress.textContent = `${count}/${MARBLE_CATALOG.length}`;

    const entries = MARBLE_CATALOG
      .filter(([nameKey]) => owned[nameKey])
      .map(([nameKey, color, style]) => ({ nameKey, color, style, entry: owned[nameKey] }))
      .sort((a, b) => {
        const ra = rankOf(a.entry), rb = rankOf(b.entry);
        return rb.at - ra.at || rb.count - ra.count;
      });

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'vault-empty';
      empty.textContent = t('vault.empty');
      container.replaceChildren(empty);
      return;
    }

    container.replaceChildren(...entries.map(({ nameKey, color, style, entry }) => {
      const card = document.createElement('div');
      card.className = 'vault-card';
      const ball = document.createElement('div');
      ball.className = 'vault-ball';
      ball.style.backgroundImage = `url("${previewFor(nameKey, color, style)}")`;
      const text = document.createElement('span');
      text.className = 'vault-text';
      const nameEl = document.createElement('strong');
      nameEl.textContent = racerName(nameKey);
      const meta = document.createElement('small');
      meta.textContent = t('vault.times', { count: entry.count }) + (entry.firstAt ? ` · ${formatDate(entry.firstAt)}` : '');
      text.append(nameEl, meta);
      card.append(ball, text);
      card.title = `${racerName(nameKey)} · ${t('vault.times', { count: entry.count })}`;
      return card;
    }));
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

  onLocaleChange(refresh);
  refresh();
  return { refresh, recordWin };
}
