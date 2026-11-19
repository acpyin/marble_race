import { danmakuFor, stageLabel, t } from './i18n/index.js';
const cleanStageName=value=>String(value??'').replace(/^\s*\d+\s*[.．、·:：—-]?\s*/,'').trim();

// Pure race observer; never consumes the physics RNG or writes to race bodies.
export class AudienceReactions{
  constructor(random=Math.random){this.random=random;this.previous=null;this.lastAt=-Infinity;this.recent=[];this.stage='';this.started=false;this.winner=null;}
  phrase(kind,values={}){
    const source=danmakuFor(kind);
    const pool=source.filter(text=>!this.recent.includes(text));
    const choices=pool.length?pool:source;
    const template=choices[Math.floor(this.random()*choices.length)];
    this.recent.push(template);if(this.recent.length>24)this.recent.shift();
    return template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
  }
  update(order,time,state,stage,context=null){
    if(!order.length||!['ready','racing','finished'].includes(state))return null;
    if(context?.mode==='director'&&state!=='ready'){
      const subject=order.find(m=>m.id===context.subjectId);
      if(!subject)return null;
      const rank=order.indexOf(subject)+1,section=cleanStageName(subject.stage);
      this.started=true;
      if(time-this.lastAt<4500)return null;
      this.lastAt=time;
      if(subject.finished){
        if(rank===1&&this.winner===null){this.winner=subject.id;return this.phrase('winner',{name:subject.name});}
        return null;
      }
      if(rank===1)return this.phrase('lead',{name:subject.name});
      if(rank>=order.length-2)return this.phrase('tail',{name:subject.name});
      if(subject.speed>=4)return this.phrase('speed',{name:subject.name});
      return this.phrase('stage',{stage:stageLabel(section)});
    }
    if(state==='racing'&&!this.started)this.lastAt=-Infinity;
    const champion=order.find(m=>m.finished);
    if(champion&&this.winner!==champion.id&&this.winner===null){
      this.winner=champion.id;this.lastAt=time;return this.phrase('winner',{name:champion.name});
    }
    if(time-this.lastAt<4500||state==='finished')return null;
    this.lastAt=time;
    if(state==='ready')return this.phrase('ready');
    const before=this.previous;this.previous=order.map(m=>({...m}));
    if(!this.started){this.started=true;this.stage=stage;return this.phrase('start');}
    let kind,values={};
    if(before){
      const gains=order.map((m,i)=>({m,gain:before.findIndex(b=>b.id===m.id)-i})).filter(x=>x.gain>0).sort((a,b)=>b.gain-a.gain);
      if(gains.length){const {m,gain}=gains[0];kind=gain>=3?'jump':'pass';values={name:m.name,gain};}
      if(!kind){
        for(let i=1;i<Math.min(4,order.length);i++){
          const a=order[i-1],b=order[i],oldA=before.find(m=>m.id===a.id),oldB=before.find(m=>m.id===b.id);
          if(oldA&&oldB&&a.progress-b.progress>=0&&oldA.progress-oldB.progress-(a.progress-b.progress)>1.2){kind='close';values={name:b.name,rival:a.name};break;}
        }
      }
    }
    if(!kind&&stage!==this.stage){kind='stage';values={stage:stageLabel(stage)};}
    this.stage=stage;
    if(!kind){
      const roll=this.random(),m=roll<.3?order.at(-1):roll<.6?[...order].sort((a,b)=>b.speed-a.speed)[0]:order[0];
      kind=roll<.3?'tail':roll<.6&&m.speed>=4?'speed':'lead';values={name:kind==='lead'?order[0].name:m.name,speed:m.speed.toFixed(1)};
    }
    return this.phrase(kind,values);
  }
}

export class DanmakuOverlay{
  constructor(root,button){
    this.root=root;this.button=button;this.items=[];this.enabled=true;this.observer=new AudienceReactions();this.clock=0;this.maxItems=3;this.speedScale=1.5;
    this.rankPanel=document.querySelector?.('.leaderboard');this.focusPanel=document.querySelector?.('.focus-card');
    this.occluders=['#betSummary','.leaderboard'].map(selector=>document.querySelector?.(selector)).filter(Boolean);
    try{this.enabled=localStorage.getItem('marble-race-danmaku-v1')!=='off';}catch{}
    try{const saved=JSON.parse(localStorage.getItem('marble-race-danmaku-settings-v1'));if(saved){this.maxItems=Math.round(Math.min(6,Math.max(1,Number(saved.count)||3)));this.speedScale=Math.min(3,Math.max(.5,Number(saved.speed)||1.5));}}catch{}
    this.syncButton();button?.addEventListener('click',()=>this.setEnabled(!this.enabled));
    // Panel/layout resizes must never wipe in-flight comments: re-seat them into the new lane area instead.
    this.resizeObserver=new ResizeObserver(()=>this.relayout());this.resizeObserver.observe(root);if(this.rankPanel)this.resizeObserver.observe(this.rankPanel);if(this.focusPanel)this.resizeObserver.observe(this.focusPanel);
  }
  syncButton(){
    if(!this.button)return;
    const label=t('danmaku.toggle');
    this.button.setAttribute('aria-pressed',String(this.enabled));
    this.button.setAttribute('aria-label',label);
    this.button.title=label;
  }
  setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.clear();this.observer.lastAt=this.clock;this.syncButton();try{localStorage.setItem('marble-race-danmaku-v1',this.enabled?'on':'off');}catch{}}
  saveSettings(){try{localStorage.setItem('marble-race-danmaku-settings-v1',JSON.stringify({count:this.maxItems,speed:this.speedScale}));}catch{}}
  setMaxItems(value){this.maxItems=Math.round(Math.min(6,Math.max(1,Number(value)||3)));this.saveSettings();}
  setSpeedScale(value){this.speedScale=Math.min(3,Math.max(.5,Number(value)||1.5));this.items.forEach(item=>{item.speed=item.baseSpeed*this.speedScale;});this.saveSettings();}
  clear(){this.items.forEach(item=>item.node.remove());this.items=[];}
  // Re-place current comments after a layout change; existing messages keep their full pass across the screen.
  relayout(){
    const bounds=this.verticalBounds();
    if(bounds){
      for(const item of this.items)item.node.style.top=`${Math.round(bounds.top+(bounds.bottom-bounds.top-26)*item.ratio)}px`;
    }
    this.items.forEach(item=>this.maskPanels(item));
  }
  maskPanels(item){
    if(!item.node.getBoundingClientRect)return;
    const a=item.node.getBoundingClientRect();
    item.node.style.visibility=this.occluders.some(panel=>{
      if(panel.hidden)return false;
      const b=panel.getBoundingClientRect();
      return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    })?'hidden':'visible';
  }
  verticalBounds(){
    if(!this.rankPanel||!this.focusPanel)return null;
    const rootRect=this.root.getBoundingClientRect(),rankRect=this.rankPanel.getBoundingClientRect(),focusRect=this.focusPanel.getBoundingClientRect();
    const top=Math.max(0,rankRect.bottom-rootRect.top+100);
    const bottom=Math.min(this.root.clientHeight,focusRect.top-rootRect.top-100);
    return bottom-top>=28?{top,bottom}:null;
  }
  // Per-lane state from the newest comment in that lane: remaining gap and its speed.
  laneState(){
    const lanes=Array.from({length:this.maxItems},(_,index)=>({lane:index,gap:Infinity,speed:Infinity}));
    for(const item of this.items){
      const slot=lanes[item.lane];if(!slot)continue;
      const gap=this.root.clientWidth-(item.x+item.width);
      if(gap<slot.gap){slot.gap=gap;slot.speed=item.speed;}
    }
    return lanes;
  }
  // Prefer an empty lane; when every lane is busy, take the one with the largest gap so a new comment
  // can still enter and simply trail the previous one — the lane count is a layout baseline, not a cap.
  pickSlot(){
    const lanes=this.laneState();
    const empty=lanes.filter(slot=>slot.gap===Infinity);
    if(empty.length)return empty[Math.floor(Math.random()*empty.length)];
    return lanes.reduce((best,slot)=>slot.gap>best.gap?slot:best,lanes[0]);
  }
  spawn(text,own=false){
    if(!this.enabled||this.root.clientWidth<120)return false;
    if(this.items.length>=this.maxItems*6)return false;
    const bounds=this.verticalBounds();if(!bounds)return false;
    const slot=this.pickSlot(),lane=slot.lane;
    const node=document.createElement('span');node.className=own?'danmaku-item is-own':'danmaku-item';
    const label=document.createElement('span');label.textContent=text;
    const like=document.createElement('button');like.type='button';like.className='danmaku-like';
    like.setAttribute('aria-label',t('danmaku.like'));
    const icon=document.createElement('span');icon.textContent='👍';
    const count=document.createElement('span');count.className='danmaku-like-count';count.textContent='0';
    like.append(icon,count);node.append(label,like);
    like.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      count.textContent=String(Number(count.textContent)+1);
      like.classList.add('liked');
    });
    const laneRatio=this.maxItems===1?.5:(lane+.15+Math.random()*.7)/this.maxItems;
    node.style.top=`${Math.round(bounds.top+(bounds.bottom-bounds.top-26)*laneRatio)}px`;this.root.append(node);
    let speed=(58+Math.random()*14)*this.speedScale;
    // Sharing a lane never rear-ends the comment ahead of it.
    if(Number.isFinite(slot.speed))speed=Math.max(20,Math.min(speed,slot.speed*.97));
    const baseSpeed=speed/this.speedScale,item={node,lane,ratio:laneRatio,x:this.root.clientWidth,width:node.offsetWidth,baseSpeed,speed,hovered:false};
    node.addEventListener('pointerenter',()=>{item.hovered=true;node.classList.add('hovered');});
    node.addEventListener('pointerleave',()=>{item.hovered=false;node.classList.remove('hovered');});
    node.style.transform=`translateX(${item.x}px)`;this.items.push(item);this.maskPanels(item);return true;
  }
  update(order,dt,state,stage,context=null){
    if(document.hidden||state==='paused'||state==='countdown')return;
    this.clock+=dt*1000;
    for(const item of this.items){if(!item.hovered)item.x-=item.speed*dt;item.node.style.transform=`translateX(${item.x}px)`;this.maskPanels(item);}
    this.items=this.items.filter(item=>{if(item.x+item.width<0){item.node.remove();return false;}return true;});
    // A new race situation never evicts what is already flying: it gets an extra lane instead.
    if(!this.enabled)return;
    const text=this.observer.update(order,this.clock,state,stage,context);if(text)this.spawn(text);
  }
}
