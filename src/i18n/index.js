// Locale registry, lookup helpers and IP-based auto detection.
// Kept free of DOM side effects at import time so the check scripts can load it under Node.
import zh from './locales/zh.js';
import en from './locales/en.js';
import ru from './locales/ru.js';
import fr from './locales/fr.js';
import ja from './locales/ja.js';

const STORAGE_KEY = 'marble-race-locale-v1';
const GEO_KEY = 'marble-race-geo-v1';
const GEO_TTL = 6 * 60 * 60 * 1000;

export const SUPPORTED = ['zh-CN', 'en', 'ru', 'fr', 'ja'];
export const LOCALES = { 'zh-CN': zh, en, ru, fr, ja };
export const DEFAULT_LOCALE = 'zh-CN';
export { STORAGE_KEY };

const ALIASES = {
  zh: 'zh-CN', 'zh-cn': 'zh-CN', 'zh-hans': 'zh-CN', 'zh-sg': 'zh-CN',
  'zh-tw': 'zh-CN', 'zh-hk': 'zh-CN', 'zh-mo': 'zh-CN', cn: 'zh-CN', chinese: 'zh-CN',
  'en-us': 'en', 'en-gb': 'en', 'en-au': 'en', 'en-ca': 'en', 'en-nz': 'en', english: 'en',
  'ru-ru': 'ru', 'ru-by': 'ru', 'ru-kz': 'ru', russian: 'ru',
  'fr-fr': 'fr', 'fr-ca': 'fr', 'fr-be': 'fr', 'fr-ch': 'fr', french: 'fr',
  'ja-jp': 'ja', 'ja-jp-u-ca-japanese': 'ja', japanese: 'ja', jp: 'ja',
};

// Countries whose visitors see Russian / French / Japanese / Chinese by default.
const COUNTRY_LOCALE = {
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', UZ: 'ru', TJ: 'ru', AM: 'ru', AZ: 'ru', MD: 'ru',
  FR: 'fr', BE: 'fr', LU: 'fr', CH: 'fr', MC: 'fr', CI: 'fr', SN: 'fr', ML: 'fr', BF: 'fr',
  NE: 'fr', TG: 'fr', BJ: 'fr', GA: 'fr', CM: 'fr', CD: 'fr', CG: 'fr', MG: 'fr', HT: 'fr',
  TD: 'fr', GN: 'fr', RW: 'fr', BI: 'fr', DJ: 'fr', KM: 'fr', VU: 'fr',
  JP: 'ja',
  CN: 'zh-CN', TW: 'zh-CN', HK: 'zh-CN', MO: 'zh-CN', SG: 'zh-CN',
};

export function normalizeCode(value) {
  if (!value) return '';
  const raw = String(value).trim().replace(/_/g, '-').toLowerCase();
  if (LOCALES[raw]) return raw;
  if (ALIASES[raw]) return ALIASES[raw];
  const base = raw.split('-')[0];
  if (base === 'zh') return 'zh-CN';
  if (LOCALES[base]) return base;
  return ALIASES[base] || '';
}

let current = DEFAULT_LOCALE;
const listeners = new Set();

export function getLocale() { return current; }
export function getLocaleData() { return LOCALES[current] || zh; }
export function localeLabel(code = current) { return (LOCALES[code] || zh).label || code; }

export function format(template, vars) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (match, key) => (vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match));
}

export function t(key, vars) {
  const data = getLocaleData();
  const raw = data?.ui?.[key] ?? zh.ui?.[key] ?? key;
  return vars ? format(raw, vars) : raw;
}

export function has(key) { return Boolean(getLocaleData()?.ui?.[key] ?? zh.ui?.[key]); }

export function stripStageNumber(value) {
  return String(value ?? '').replace(/^\s*\d+\s*[.．、·:：—-]?\s*/, '').trim();
}

export function racerName(zhName) {
  if (!zhName) return zhName;
  const dict = getLocaleData().racers || {};
  return dict[zhName] ?? zhName;
}

export function stageLabel(raw) {
  const key = stripStageNumber(raw);
  const dict = getLocaleData().stages || {};
  return dict[key] ?? zh.stages?.[key] ?? key;
}

export function woodName(zhName) {
  const dict = getLocaleData().woods || {};
  return dict[zhName] ?? zh.woods?.[zhName] ?? zhName;
}

export function moduleLabel(zhName) {
  const dict = getLocaleData().modules || {};
  return dict[zhName] ?? zh.modules?.[zhName] ?? zhName;
}

export function danmakuFor(kind) {
  const data = getLocaleData().danmaku || {};
  const pool = data[kind];
  if (Array.isArray(pool) && pool.length) return pool;
  return zh.danmaku?.[kind] || [];
}

export function commentaryData() {
  const data = getLocaleData().commentary || {};
  return {
    live: data.live && Object.keys(data.live).length ? data.live : zh.commentary.live,
    stageDetails: data.stageDetails?.length ? data.stageDetails : zh.commentary.stageDetails,
    openingDetails: data.openingDetails && Object.keys(data.openingDetails).length ? data.openingDetails : zh.commentary.openingDetails,
    moduleDetails: data.moduleDetails && Object.keys(data.moduleDetails).length ? data.moduleDetails : zh.commentary.moduleDetails,
    keyStageFocus: data.keyStageFocus && Object.keys(data.keyStageFocus).length ? data.keyStageFocus : zh.commentary.keyStageFocus,
  };
}

// Latin and Cyrillic sentences run longer than Chinese ones; the commentary engine
// uses length bands to pick short versus detailed lines, so they have to be scaled.
export function lengthScale() {
  return Number(getLocaleData().lengthScale) || 1;
}

// Chinese and Japanese list racers with an ideographic comma, Latin and Cyrillic with a comma.
export function listSeparator() {
  return getLocaleData().listSeparator || (current === 'zh-CN' || current === 'ja' ? '、' : ', ');
}

export function voiceLang() {
  return getLocaleData().voiceLang || current.split('-')[0];
}

export function onLocaleChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function applyLocale(code) {
  current = LOCALES[code] ? code : DEFAULT_LOCALE;
}

export function setLocale(value, { persist = true, notify = true } = {}) {
  const code = normalizeCode(value) || DEFAULT_LOCALE;
  if (code === current) return false;
  applyLocale(code);
  if (persist) rememberPreference(code);
  if (notify) for (const handler of [...listeners]) { try { handler(code); } catch (error) { console.error(error); } }
  return true;
}

export function storedPreference() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function rememberPreference(value) {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* private mode */ }
}

function browserLocale() {
  const lang = typeof navigator !== 'undefined' ? navigator.language || navigator.userLanguage : '';
  return normalizeCode(lang) || 'en';
}

// Sync start-up guess: URL override, then saved choice, then the browser language.
export function initLocale() {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const fromUrl = normalizeCode(params.get('lang'));
  if (fromUrl) { applyLocale(fromUrl); return { code: fromUrl, source: 'url', auto: false }; }
  const stored = storedPreference();
  if (stored && stored !== 'auto') {
    const code = normalizeCode(stored);
    if (code) { applyLocale(code); return { code, source: 'stored', auto: false }; }
  }
  const guess = browserLocale();
  applyLocale(guess);
  return { code: guess, source: 'browser', auto: !stored || stored === 'auto' };
}

async function fetchText(url, timeout = 1600) {
  if (typeof fetch !== 'function') return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    return response.ok ? (await response.text()).slice(0, 400) : '';
  } catch { return ''; }
  finally { clearTimeout(timer); }
}

function readGeoCache() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(GEO_KEY));
    if (saved && saved.code && Date.now() - saved.at < GEO_TTL) return saved.code;
  } catch { /* ignore */ }
  return '';
}

function writeGeoCache(code) {
  try { sessionStorage.setItem(GEO_KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* ignore */ }
}

// Three public endpoints are tried in order; any one of them is enough.
export async function lookupCountry() {
  const cached = readGeoCache();
  if (cached) return cached;
  const parsers = [
    [text => text, 'https://ipapi.co/country/'],
    [text => { try { return JSON.parse(text).country_code || ''; } catch { return ''; } }, 'https://ipwho.is/?fields=country_code'],
    [text => { try { return JSON.parse(text).country || ''; } catch { return ''; } }, 'https://api.country.is/'],
  ];
  for (const [parse, url] of parsers) {
    const raw = await fetchText(url);
    const code = String(parse(raw) || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) { writeGeoCache(code); return code; }
  }
  return '';
}

export function localeForCountry(country) {
  return COUNTRY_LOCALE[String(country || '').toUpperCase()] || 'en';
}

// Auto mode: IP country first, then the browser's own language.
export async function resolveAutoLocale() {
  const country = await lookupCountry();
  if (country) return localeForCountry(country);
  return browserLocale();
}

export async function selectLanguage(value) {
  if (value === 'auto') {
    rememberPreference('auto');
    const code = await resolveAutoLocale();
    setLocale(code, { persist: false });
    return { code: getLocale(), auto: true };
  }
  const code = normalizeCode(value) || DEFAULT_LOCALE;
  setLocale(code, { persist: true });
  return { code: getLocale(), auto: false };
}

export function applyDomI18n(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(node.dataset.i18nAria));
  for (const node of root.querySelectorAll('[data-i18n-title]')) node.setAttribute('title', t(node.dataset.i18nTitle));
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  const html = typeof document !== 'undefined' ? document.documentElement : null;
  if (html) {
    html.lang = getLocaleData().htmlLang || getLocale();
    document.title = t('app.title');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t('app.description');
  }
}
