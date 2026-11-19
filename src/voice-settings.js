import { GOOGLE_TAIWAN_VOICE, voiceGender } from './voice-commentary.js';
import { localeLabel, t, voiceLang } from './i18n/index.js';
const key = 'marble-race-voice-settings-v1';

export function loadVoiceSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved.choice === 'string' && Number.isFinite(saved.rate)) return { choice: saved.choice, rate: Math.min(3, Math.max(.7, saved.rate)) };
  } catch { /* ignore */ }
  return { choice: GOOGLE_TAIWAN_VOICE, rate: 1.2 };
}

export function setupVoiceSettings(announcer, controls = {}) {
  const dialog = document.querySelector('#voiceSettings'), speed = document.querySelector('#voiceRate'), tone = document.querySelector('#voiceTone'), note = document.querySelector('#voiceSettingsNote');
  const output = document.querySelector('#voiceRateValue'), preview = document.querySelector('#voicePreviewBtn');
  const musicToggle = document.querySelector('#musicToggle'), effectsToggle = document.querySelector('#effectsToggle'), voiceToggle = document.querySelector('#voiceToggle'), danmakuToggle = document.querySelector('#danmakuToggle');
  const musicVolume = document.querySelector('#musicVolume'), musicVolumeValue = document.querySelector('#musicVolumeValue');
  const danmakuCount = document.querySelector('#danmakuCount'), danmakuCountValue = document.querySelector('#danmakuCountValue'), danmakuSpeed = document.querySelector('#danmakuSpeed'), danmakuSpeedValue = document.querySelector('#danmakuSpeedValue');

  function syncSwitches() {
    musicToggle.checked = controls.musicEnabled?.() ?? true; effectsToggle.checked = controls.effectsEnabled?.() ?? true;
    voiceToggle.checked = announcer.enabled; voiceToggle.disabled = !announcer.supported; danmakuToggle.checked = controls.danmakuEnabled?.() ?? true;
    musicVolume.value = String(controls.musicVolume?.() ?? .35); musicVolumeValue.textContent = `${Math.round(Number(musicVolume.value) * 100)}%`;
    danmakuCount.value = String(controls.danmakuCount?.() ?? 3); danmakuCountValue.textContent = t('settings.danmakuCountValue', { count: danmakuCount.value });
    danmakuSpeed.value = String(controls.danmakuSpeed?.() ?? 1.5); danmakuSpeedValue.textContent = t('settings.danmakuSpeedValue', { value: Number(danmakuSpeed.value).toFixed(2) });
    output.textContent = t('settings.rateValue', { value: Number(speed.value || announcer.settings.rate).toFixed(2) });
  }

  function localVoices() {
    const lang = voiceLang();
    return announcer.synth?.getVoices().filter(v => String(v.lang || '').toLowerCase().startsWith(lang)) ?? [];
  }

  function refresh() {
    const voices = localVoices(), lang = voiceLang(), languageName = localeLabel();
    const options = [];
    if (lang === 'zh') options.push([GOOGLE_TAIWAN_VOICE, t('voice.optPreferred')]);
    options.push(['random', t('voice.optRandom')], ['male', t('voice.optMale')], ['female', t('voice.optFemale')]);
    for (const voice of voices) {
      const gender = voiceGender(voice);
      options.push([`voice:${voice.voiceURI}`, `${voice.name} · ${gender === 'male' ? t('voice.toneMale') : gender === 'female' ? t('voice.toneFemale') : t('voice.toneSystem')}`]);
    }
    tone.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    if (![...tone.options].some(option => option.value === announcer.settings.choice)) tone.add(new Option(t('voice.optUnavailable'), announcer.settings.choice));
    tone.value = announcer.settings.choice;
    speed.value = String(announcer.settings.rate);
    output.textContent = t('settings.rateValue', { value: Number(speed.value).toFixed(2) });
    preview.disabled = !announcer.supported || !voices.length;
    note.textContent = !announcer.supported ? t('voice.noteUnsupported')
      : !voices.length ? t('voice.noteNoVoice', { language: languageName })
      : t('voice.noteFound', { count: voices.length, language: languageName });
  }

  function save() {
    announcer.setSettings({ rate: Number(speed.value), choice: tone.value });
    output.textContent = t('settings.rateValue', { value: Number(speed.value).toFixed(2) });
    try { localStorage.setItem(key, JSON.stringify(announcer.settings)); }
    catch { note.textContent = t('voice.saveFailed'); }
  }

  document.querySelector('#settingsBtn').addEventListener('click', () => { refresh(); syncSwitches(); dialog.showModal(); });
  document.querySelector('#voiceSettingsClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  speed.addEventListener('input', save); tone.addEventListener('change', save);
  musicToggle.addEventListener('change', () => controls.setMusicEnabled?.(musicToggle.checked));
  effectsToggle.addEventListener('change', () => controls.setEffectsEnabled?.(effectsToggle.checked));
  voiceToggle.addEventListener('change', () => controls.setVoiceEnabled?.(voiceToggle.checked));
  danmakuToggle.addEventListener('change', () => controls.setDanmakuEnabled?.(danmakuToggle.checked));
  musicVolume.addEventListener('input', () => { const value = Number(musicVolume.value); musicVolumeValue.textContent = `${Math.round(value * 100)}%`; controls.setMusicVolume?.(value); });
  danmakuCount.addEventListener('input', () => { const value = Number(danmakuCount.value); danmakuCountValue.textContent = t('settings.danmakuCountValue', { count: value }); controls.setDanmakuCount?.(value); });
  danmakuSpeed.addEventListener('input', () => { const value = Number(danmakuSpeed.value); danmakuSpeedValue.textContent = t('settings.danmakuSpeedValue', { value: value.toFixed(2) }); controls.setDanmakuSpeed?.(value); });
  preview.addEventListener('click', () => announcer.announce(t('voice.previewText'), { priority: true, preview: true }));
  document.querySelector('#voiceSettingsReset').addEventListener('click', () => {
    speed.value = '1.2'; tone.value = voiceLang() === 'zh' ? GOOGLE_TAIWAN_VOICE : 'random'; save();
    controls.setMusicEnabled?.(true); controls.setEffectsEnabled?.(true); controls.setVoiceEnabled?.(false); controls.setDanmakuEnabled?.(true); controls.setMusicVolume?.(.35); controls.setDanmakuCount?.(3); controls.setDanmakuSpeed?.(1.5);
    refresh(); syncSwitches();
  });
  announcer.synth?.addEventListener('voiceschanged', () => { if (dialog.open) refresh(); });

  return {
    sync() { syncSwitches(); if (dialog.open) refresh(); },
    refresh,
  };
}
