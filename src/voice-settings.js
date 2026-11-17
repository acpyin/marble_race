import {GOOGLE_TAIWAN_VOICE,voiceGender} from './voice-commentary.js';
const key='marble-race-voice-settings-v1';
export function loadVoiceSettings(){
  try{const saved=JSON.parse(localStorage.getItem(key));
    if(saved&&typeof saved.choice==='string'&&Number.isFinite(saved.rate))return {choice:saved.choice,rate:Math.min(3,Math.max(.7,saved.rate))};
  }catch{}
  return {choice:GOOGLE_TAIWAN_VOICE,rate:1.2};
}
export function setupVoiceSettings(announcer,controls={}){
  const dialog=document.querySelector('#voiceSettings'),speed=document.querySelector('#voiceRate'),tone=document.querySelector('#voiceTone'),note=document.querySelector('#voiceSettingsNote');
  const output=document.querySelector('#voiceRateValue'),preview=document.querySelector('#voicePreviewBtn');
  const musicToggle=document.querySelector('#musicToggle'),effectsToggle=document.querySelector('#effectsToggle'),voiceToggle=document.querySelector('#voiceToggle'),danmakuToggle=document.querySelector('#danmakuToggle');
  const musicVolume=document.querySelector('#musicVolume'),musicVolumeValue=document.querySelector('#musicVolumeValue');
  const danmakuCount=document.querySelector('#danmakuCount'),danmakuCountValue=document.querySelector('#danmakuCountValue'),danmakuSpeed=document.querySelector('#danmakuSpeed'),danmakuSpeedValue=document.querySelector('#danmakuSpeedValue');
  function syncSwitches(){
    musicToggle.checked=controls.musicEnabled?.()??true;effectsToggle.checked=controls.effectsEnabled?.()??true;
    voiceToggle.checked=announcer.enabled;voiceToggle.disabled=!announcer.supported;danmakuToggle.checked=controls.danmakuEnabled?.()??true;
    musicVolume.value=String(controls.musicVolume?.()??.35);musicVolumeValue.textContent=`${Math.round(Number(musicVolume.value)*100)}%`;
    danmakuCount.value=String(controls.danmakuCount?.()??3);danmakuCountValue.textContent=`${danmakuCount.value} 条`;
    danmakuSpeed.value=String(controls.danmakuSpeed?.()??1.5);danmakuSpeedValue.textContent=`${Number(danmakuSpeed.value).toFixed(2)} 倍`;
  }
  function refresh(){
    const voices=announcer.synth?.getVoices().filter(v=>/^zh|^cmn/i.test(v.lang))??[];
    tone.replaceChildren(...[[GOOGLE_TAIWAN_VOICE,'Google 国语台湾 · 系统音色（优先）'],['random','每场随机男声 / 女声'],['male','优先男声'],['female','优先女声'],...voices.map(v=>[
      `voice:${v.voiceURI}`,`${v.name} · ${voiceGender(v)==='male'?'男声':voiceGender(v)==='female'?'女声':'系统音色'}`
    ])].map(([value,label])=>new Option(label,value)));
    if(![...tone.options].some(o=>o.value===announcer.settings.choice))tone.add(new Option('先前音色（当前不可用，将使用其他中文音色）',announcer.settings.choice));
    tone.value=announcer.settings.choice;speed.value=String(announcer.settings.rate);output.textContent=`${Number(speed.value).toFixed(2)} 倍`;
    preview.disabled=!announcer.supported||!voices.length;
    note.textContent=!announcer.supported?'当前浏览器不支持语音播报。':!voices.length?'暂未发现中文音色，请检查系统中文语音是否已安装。':`发现 ${voices.length} 个中文音色。没有所选男声或女声时，使用现有中文音色。`;
  }
  function save(){
    announcer.setSettings({rate:Number(speed.value),choice:tone.value});output.textContent=`${Number(speed.value).toFixed(2)} 倍`;
    try{localStorage.setItem(key,JSON.stringify(announcer.settings));}catch{note.textContent='设置已生效，但此浏览器无法保存，下次打开需重新设置。';}
  }
  document.querySelector('#settingsBtn').addEventListener('click',()=>{refresh();syncSwitches();dialog.showModal();});
  document.querySelector('#voiceSettingsClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();});
  speed.addEventListener('input',save);tone.addEventListener('change',save);
  musicToggle.addEventListener('change',()=>controls.setMusicEnabled?.(musicToggle.checked));
  effectsToggle.addEventListener('change',()=>controls.setEffectsEnabled?.(effectsToggle.checked));
  voiceToggle.addEventListener('change',()=>controls.setVoiceEnabled?.(voiceToggle.checked));
  danmakuToggle.addEventListener('change',()=>controls.setDanmakuEnabled?.(danmakuToggle.checked));
  musicVolume.addEventListener('input',()=>{const value=Number(musicVolume.value);musicVolumeValue.textContent=`${Math.round(value*100)}%`;controls.setMusicVolume?.(value);});
  danmakuCount.addEventListener('input',()=>{const value=Number(danmakuCount.value);danmakuCountValue.textContent=`${value} 条`;controls.setDanmakuCount?.(value);});
  danmakuSpeed.addEventListener('input',()=>{const value=Number(danmakuSpeed.value);danmakuSpeedValue.textContent=`${value.toFixed(2)} 倍`;controls.setDanmakuSpeed?.(value);});
  preview.addEventListener('click',()=>announcer.announce('我们看到银河正在加速，漂亮，这一下反超到第一！接下来的蛇形弯，精彩还在继续！',{priority:true,preview:true}));
  document.querySelector('#voiceSettingsReset').addEventListener('click',()=>{
    speed.value='1.2';tone.value=GOOGLE_TAIWAN_VOICE;save();
    controls.setMusicEnabled?.(true);controls.setEffectsEnabled?.(true);controls.setVoiceEnabled?.(false);controls.setDanmakuEnabled?.(true);controls.setMusicVolume?.(.35);controls.setDanmakuCount?.(3);controls.setDanmakuSpeed?.(1.5);
    refresh();syncSwitches();
  });
  announcer.synth?.addEventListener('voiceschanged',()=>{if(dialog.open)refresh();});
}
