const male=/yunxi|yunjian|yunyang|yunfeng|yunhao|kangkang|康康|云希|云健|云扬/i;
const female=/xiaoxiao|xiaoyi|xiaohan|xiaomo|xiaoxuan|xiaorui|xiaoshuang|huihui|yaoyao|tingting|tracy|hanhan|晓晓|晓伊|慧慧|瑶瑶|婷婷/i;
export const GOOGLE_TAIWAN_VOICE='google-zh-tw';
export function voiceGender(voice){return male.test(voice.name)?'male':female.test(voice.name)?'female':'unknown';}
export function isGoogleTaiwanVoice(voice){return /google/i.test(voice.name)&&(/国语.*台湾|國語.*台灣|taiwan|台湾|台灣/i.test(voice.name)||/^zh[-_]tw/i.test(voice.lang));}
export function chooseChineseVoice(voices,gender,random=Math.random){
  const chinese=voices.filter(v=>/^zh(?:-|_|$)|^cmn(?:-|_|$)/i.test(v.lang));
  const matching=chinese.filter(v=>voiceGender(v)===gender);
  const pool=matching.length?matching:chinese;
  return pool.length?pool[Math.floor(random()*pool.length)]:null;
}
export function speechMood(text,mood){
  const moods={excited:{rate:1.22,pitch:1.08,volume:.95},tense:{rate:1.16,pitch:1.04,volume:.9},concerned:{rate:1.03,pitch:.98,volume:.85},analysis:{rate:1.05,pitch:1,volume:.85},celebrate:{rate:1.15,pitch:1.06,volume:.92}};
  if(moods[mood])return moods[mood];
  if(/冠军|夺冠|冲线|夺魁|桂冠/.test(text))return {rate:1.15,pitch:1.08,volume:.95};
  if(/反超|超越|连超|黑马|提速|加速|超到/.test(text))return {rate:1.22,pitch:1.05,volume:.9};
  if(/受阻|迟滞|卡住|耽搁/.test(text))return {rate:1.03,pitch:.98,volume:.85};
  return {rate:1.12,pitch:1,volume:.85};
}
export class VoiceCommentary {
  constructor({synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,random=Math.random,onStatus=()=>{},settings={}}={}){
    this.settings={rate:1.2,choice:GOOGLE_TAIWAN_VOICE,...settings};
    this.settings.rate=Math.min(3,Math.max(.7,Number(this.settings.rate)||1.2));
    this.synth=synth;this.Utterance=Utterance;this.random=random;this.onStatus=onStatus;
    this.supported=!!synth&&!!Utterance;this.enabled=true;this.paused=false;this.generation=0;
    this.gender=random()<.5?'male':'female';this.voice=null;this.pending=null;this.active=null;this.confirmedQueue=[];
    this.refresh=()=>{if(!this.supported)return;
      const voices=this.synth.getVoices();
      if(!this.voice||!voices.some(v=>v.voiceURI===this.voice.voiceURI)||(this.settings.choice===GOOGLE_TAIWAN_VOICE&&!isGoogleTaiwanVoice(this.voice)&&voices.some(isGoogleTaiwanVoice))){
        const choice=this.settings.choice;
        const preferred=choice===GOOGLE_TAIWAN_VOICE?voices.find(isGoogleTaiwanVoice):choice.startsWith('voice:')?voices.find(v=>v.voiceURI===choice.slice(6)&&/^zh|^cmn/i.test(v.lang)):null;
        this.voice=preferred??chooseChineseVoice(voices,['male','female'].includes(choice)?choice:this.gender,this.random);
      }
      this.status();this.pump();
    };
    this.synth?.addEventListener('voiceschanged',this.refresh);this.refresh();this.status();
  }
  status(error=''){
    this.lastError=error;
    const gender=this.voice?voiceGender(this.voice):'unknown';
    const tone=gender==='male'?'男声':gender==='female'?'女声':'系统音色';
    this.onStatus({supported:this.supported,enabled:this.enabled,ready:!!this.voice,tone,error,voiceName:this.voice?.name??''});
  }
  startRace(){this.stop();this.paused=false;this.gender=this.random()<.5?'male':'female';this.voice=null;this.refresh();}
  setSettings(settings){
    const rate=Number(settings.rate);
    this.settings={rate:Number.isFinite(rate)?Math.min(3,Math.max(.7,rate)):1.2,choice:typeof settings.choice==='string'?settings.choice:GOOGLE_TAIWAN_VOICE};
    this.stop();this.voice=null;this.refresh();
  }
  stop(){this.generation++;clearTimeout(this.watchdog);this.pending=null;this.confirmedQueue=[];this.active=null;this.synth?.cancel();}
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();this.status();}
  setPaused(paused){this.paused=paused;if(paused)this.stop();}
  announce(text,{priority=false,preview=false,mood,confirmed=false}={}){
    if(!this.supported||(!preview&&(!this.enabled||this.paused)))return;
    if(priority)this.stop();
    // Keep only the latest waiting line, so spoken commentary cannot fall far behind.
    const message={text,at:Date.now(),preview,mood,confirmed};
    if(confirmed){if(this.confirmedQueue.length<8)this.confirmedQueue.push(message);}else this.pending=message;
    this.pump();
  }
  pump(){
    if(!this.voice||(!this.pending&&!this.confirmedQueue.length)||this.active||((!this.enabled||this.paused)&&!this.pending?.preview))return;
    const pending=this.confirmedQueue.shift()||this.pending;if(pending===this.pending)this.pending=null;if(!pending.confirmed&&Date.now()-pending.at>6000)return;
    const utterance=new this.Utterance(pending.text),token=this.generation;
    utterance.lang=this.voice.lang;utterance.voice=this.voice;
    Object.assign(utterance,speechMood(pending.text,pending.mood));
    utterance.rate*=this.settings.rate;
    utterance.pitch*=.98+this.random()*.04;
    this.active=utterance;
    const complete=()=>{if(token!==this.generation||this.active!==utterance)return;clearTimeout(this.watchdog);this.active=null;this.pump();};
    utterance.onend=complete;
    utterance.onerror=event=>{if(token!==this.generation)return;this.status(event.error==='not-allowed'?'请点击语音开关开启播报':'语音暂不可用');this.stop();};
    this.watchdog=setTimeout(()=>{if(token===this.generation){const latest=this.pending,confirmed=this.confirmedQueue.slice();this.stop();this.pending=latest;this.confirmedQueue=confirmed;this.pump();}},22000);
    try{this.synth.speak(utterance);}catch{this.status('语音暂不可用');this.stop();}
  }
}
