import { liveLines, keyStageFocusMap, stageDetail, describeGap } from './i18n/commentary.js';
import { format, lengthScale, listSeparator, stageLabel } from './i18n/index.js';
import { racerDistance } from './race-position.js';
const cleanStageName = value => String(value ?? '').replace(/^\s*\d+\s*[.．、·:：—-]?\s*/, '').trim();

export function describeDistance(distance) {
  return describeGap(distance);
}

// Read-only observer: snapshots, sustained rank changes and along-track distance trends.
export class RaceCommentary {
  constructor(random=Math.random,{interval=6000,adaptive=true}={}){
    this.adaptive=adaptive;
    this.interval=interval;this.frequencyScale=interval/3000;
    this.random=random;this.history=[];this.stableRanks=new Map();this.cooldowns=new Map();
    this.recent=[];this.lastAt=-Infinity;this.lastSample=-Infinity;this.lastTail=0;
    this.seenFinish=new Set();this.stage='';this.started=false;
    this.openingLeadAnnounced=false;this.lastPlaceWatchAnnounced=false;this.lastPlaceAnnounced=false;
    this.stallStates=new Map();this.incidents=new Map();
    this.stageTarget='';this.stageSince=0;this.keySegments=new Map();this.bowlStates=new Map();
    this.confirmedLeader=null;this.leaderCandidate=null;this.leadSequence=0;
  }
  line(kind,values){
    const choices=liveLines(kind);
    if(!choices.length)return null;
    // Stage labels travel as internal Chinese keys so the director camera can still match
    // sections; only the sentence itself shows the translated name.
    const display={...values};
    if(typeof display.stage==='string')display.stage=stageLabel(display.stage);
    const render=text=>format(text,display);
    const scale=lengthScale();
    const urgent=['openingLead','leadChange','jumpUp','frontPass','remainingPass','bowlDrop','winner','flyAway'].includes(kind);
    const tense=['gapClosing','tailClosing','bowlContest','remainingContest'].includes(kind);
    this.lastMood=urgent?'excited':tense?'tense':['slowdown','jumpDown','tailStall','bowlOutward','stuck','failure','lastFailure','lastPlaceWatch'].includes(kind)?'concerned':['finish','lastPlace'].includes(kind)?'celebrate':'analysis';
    let entries=choices.map((text,index)=>({text,key:`${kind}:${index}`})).filter(x=>!x.text.includes('{time}')||values.time);
    const bounded=entries.filter(x=>render(x.text).length<=70*scale);if(bounded.length)entries=bounded;
    if(this.adaptive&&kind!=='start'&&kind!=='openingLead'){
      const compact=values.compact||(urgent&&this.random()<.7)||(tense&&Number(values.gap??values.margin)<1);
      const preferred=entries.filter(x=>compact?render(x.text).length<=30*scale:render(x.text).length>=26*scale&&render(x.text).length<=55*scale);
      if(preferred.length)entries=preferred;
    }
    const recentThree=new Set(this.recent.slice(-3));
    const allowed=entries.filter(x=>!recentThree.has(x.text));
    if(!allowed.length)return null;
    const fresh=allowed.filter(x=>!this.recent.includes(x.text));
    const pool=fresh.length?fresh:allowed;
    const choice=pool[Math.floor(this.random()*pool.length)];
    this.recent.push(choice.text);if(this.recent.length>12)this.recent.shift();
    const text=render(choice.text);this.lastLength=text.length<=35*scale?'short':text.length<=65*scale?'medium':'long';return text;
  }
  update(order,time,state,stage=''){
    if(!['racing','finished'].includes(state)||!order.length)return null;
    const current=order.map(m=>({...m})),leader=current[0];
    if(this.confirmedLeader!==null&&leader.id!==this.confirmedLeader){
      if(this.leaderCandidate?.id!==leader.id)this.leaderCandidate={id:leader.id,since:time};
    }else this.leaderCandidate=null;
    if(stage!==this.stageTarget){this.stageTarget=stage;this.stageSince=time;}
    // Each racer supplies its own actual module; a leader swap is not a module exit.
    current.forEach((m,rank)=>{
      const number=parseInt(m.stage,10);
      if(!keyStageFocusMap()[number]||m.finished)return;
      if(!this.keySegments.has(number))this.keySegments.set(number,{since:time,entries:new Map(),departures:new Map(),reported:new Set(),exitCount:0});
      const segment=this.keySegments.get(number);
      segment.label=cleanStageName(m.stage);
      if(!segment.entries.has(m.id))segment.entries.set(m.id,{rank:rank+1});
    });
    for(const [number,segment] of this.keySegments){
      current.forEach(m=>{
        if(segment.entries.has(m.id)&&parseInt(m.stage,10)>number&&!segment.departures.has(m.id))segment.departures.set(m.id,time);
      });
    }
    const emit=(kind,values,key,tail=false)=>{
      this.lastKind=kind;this.lastValues=values;this.lastAt=time;this.cooldowns.set(key,time);if(tail)this.lastTail=time;
      if(key.startsWith('bowl-live:'))this.bowlStates.set(key,{kind,...values});
      return this.line(kind,values);
    };
    if(leader.finished&&!this.seenFinish.has(leader.id)){
      this.seenFinish.add(leader.id);
      return emit('winner',{name:leader.name},'winner');
    }
    // The podium is called in order; places four through seven stay unannounced.
    for(let rank=1;rank<Math.min(3,current.length);rank++){
      const arrival=current[rank];
      if(!arrival.finished||this.seenFinish.has(arrival.id))break;
      if(time-this.lastAt<1800)return null;
      this.seenFinish.add(arrival.id);
      if(arrival.failed)return emit('failure',{name:arrival.name,reason:arrival.failureReason},`failure:${arrival.id}`);
      return emit('finish',{name:arrival.name,rank:rank+1,time:Number.isFinite(arrival.finishTime)?(arrival.finishTime/1000).toFixed(2):'',compact:true,remaining:current.filter(m=>!m.finished).length},`finish:${arrival.id}`);
    }
    if(this.seenFinish.size>=Math.min(3,current.length)&&!this.lastPlaceWatchAnnounced){
      if(time-this.lastAt<1800)return null;
      this.lastPlaceWatchAnnounced=true;
      if(!current.every(m=>m.finished)||!current.at(-1).failed)return emit('lastPlaceWatch',{name:current.at(-1).name},'last-place-watch');
    }
    if(this.lastPlaceWatchAnnounced&&!this.lastPlaceAnnounced&&current.every(m=>m.finished)){
      if(time-this.lastAt<1800)return null;
      this.lastPlaceAnnounced=true;
      const last=current.at(-1);
      return emit(last.failed?'lastFailure':'lastPlace',{name:last.name,reason:last.failureReason},'last-place');
    }
    if(state==='finished')return null;
    if(time-this.lastSample>=500){
      this.lastSample=time;this.history.push({time,order:current});
      this.history=this.history.filter(s=>time-s.time<=15000);
      current.forEach((m,rank)=>{
        const stable=this.stableRanks.get(m.id);
        if(!stable||stable.rank!==rank)this.stableRanks.set(m.id,{rank,since:time});
      });
    }
    if(!this.started){this.started=true;this.stage=stage;this.confirmedLeader=leader.id;return emit('start',{},'start');}
    if(!this.openingLeadAnnounced){
      if(time-this.lastAt<2500||leader.finished)return null;
      this.openingLeadAnnounced=true;this.confirmedLeader=leader.id;this.leaderCandidate=null;
      return emit('openingLead',{name:leader.name},'opening-lead');
    }
    // A stopped racer must stay stopped in the same module before it is called stuck.
    const incidents=[];
    for(const m of current){
      if(m.finished){this.stallStates.delete(m.id);continue;}
      const previous=this.stallStates.get(m.id);
      if(m.speed<=.1){
        if(!previous||previous.stage!==m.stage||Math.abs(m.progress-previous.progress)>.3)this.stallStates.set(m.id,{since:time,stage:m.stage,progress:m.progress});
        else if(time-previous.since>=8000&&time-(this.incidents.get(`stuck:${m.id}`)??-Infinity)>=20000)incidents.push({kind:'stuck',m,score:1});
      }else this.stallStates.delete(m.id);
      if(m.speed>300&&time-(this.incidents.get(`fly:${m.id}`)??-Infinity)>=20000)incidents.push({kind:'flyAway',m,score:2});
    }
    if(incidents.length&&time-this.lastAt>=1200){
      incidents.sort((a,b)=>b.score-a.score);
      const {kind,m}=incidents[0],key=`${kind==='stuck'?'stuck':'fly'}:${m.id}`;
      this.incidents.set(key,time);
      return emit(kind,{name:m.name,stage:cleanStageName(m.stage)},key);
    }
    if(this.seenFinish.size>=Math.min(3,current.length))return null;
    if(time-this.lastAt<this.interval)return null;
    const past=[...this.history].reverse().find(s=>s.time<=time-5000)??this.history[0];
    if(!past)return null;
    const old=past.order,oldById=new Map(old.map((m,rank)=>[m.id,{...m,rank}]));
    const fmt=n=>Math.max(0,n).toFixed(1),candidates=[];
    let pendingRankChange=false;
    const ready=(key,delay=12000)=>time-(this.cooldowns.get(key)??-Infinity)>=delay*this.frequencyScale;
    const add=(kind,values,key,score,tail=false,delay=12000)=>{
      if(ready(key,delay))candidates.push({kind,values,key,score,tail});
    };
    const stable=m=>time-(this.stableRanks.get(m.id)?.since??time)>=700;
    const leadPending=this.leaderCandidate&&time-this.leaderCandidate.since<700;
    if(this.leaderCandidate&&!leadPending&&!leader.finished){
      const rival=current.find(m=>m.id===this.confirmedLeader),next=current[1];
      if(rival&&next){const gap=racerDistance(leader,next);add('leadChange',{name:leader.name,rival:rival.name,gap:fmt(gap),gapText:describeDistance(gap)},`lead-change:${this.leadSequence}`,300,false,0);}
    }
    for(let rank=0;rank<current.length;rank++){
      const m=current[rank],before=oldById.get(m.id);if(!before||m.finished)continue;
      if(!stable(m)){
        if(Math.abs(before.rank-rank)>=3||(rank===0&&before.rank!==0))pendingRankChange=true;
        continue;
      }
      const gain=before.rank-rank,tail=rank>=current.length-2||before.rank>=current.length-2;
      const advance=m.progress-before.progress;
      if(Math.abs(gain)>=3){
        add(gain>0?'jumpUp':'jumpDown',{name:m.name,gain:Math.abs(gain),rank:rank+1,oldRank:before.rank+1},`jump:${m.id}:${Math.sign(gain)}`,100+Math.abs(gain),tail);
      }
      if(gain>0&&advance>0){
        const rival=old[rank];
        const next=current[rank+1],clearance=next?m.progress-next.progress:Infinity;
        if(clearance>.4&&rival&&rival.id!==m.id){
          if(rank===0&&this.seenFinish.size===0){
            // Leadership is tracked separately, so a six-second interval cannot lose it.
          }else if(leader.finished||rank<4){
            add(leader.finished?'remainingPass':'frontPass',{name:m.name,rival:rival.name,rank:rank+1},`pass:${m.id}:${rival.id}`,92);
          }else if(tail){
            add('tailPass',{name:m.name,rival:rival.name,rank:rank+1},`pass:${m.id}:${rival.id}`,time-this.lastTail>=15000?96:75,true);
          }
        }
      }
      const speed=Number.isFinite(m.speed)?m.speed:0;
      if(Number.isFinite(before.speed)&&speed-before.speed>3&&advance>2){
        add(before.speed<1.2?'recovery':'acceleration',{name:m.name,rank:rank+1,speed:fmt(speed),oldSpeed:fmt(before.speed),change:fmt(speed-before.speed)},`speed:${m.id}`,rank<4?65:62);
      }
      if(Number.isFinite(before.speed)&&before.speed-speed>3&&advance>=0){
        add('slowdown',{name:m.name,rank:rank+1,speed:fmt(speed),oldSpeed:fmt(before.speed),change:fmt(before.speed-speed)},`slow:${m.id}`,63);
      }
      if(rank>=current.length-2&&speed<1.2&&advance>=0&&advance<.6&&time-past.time>=4500){
        add('tailStall',{name:m.name,rank:rank+1,speed:fmt(speed)},`stall:${m.id}`,time-this.lastTail>=15000?95:73,true,18000);
      }
    }
    // Adjacent front-four pairs and the final pair: compare the SAME two racers.
    const pairs=(leader.finished?current.map((_,i)=>i).slice(0,-1):[0,1,2,current.length-2]).filter((index,pos,all)=>index>=0&&all.indexOf(index)===pos);
    for(const index of pairs){
      const ahead=current[index],behind=current[index+1];if(!ahead||!behind||ahead.finished||behind.finished)continue;
      const oldAhead=oldById.get(ahead.id),oldBehind=oldById.get(behind.id);
      if(!oldAhead||!oldBehind||oldBehind.rank!==oldAhead.rank+1)continue;
      const gap=racerDistance(ahead,behind),oldGap=racerDistance(oldAhead,oldBehind);
      const change=oldGap-gap,tail=index===current.length-2;
      const values={gap:fmt(gap),oldGap:fmt(oldGap),change:fmt(Math.abs(change)),gapText:describeDistance(gap),oldGapText:describeDistance(oldGap),changeText:describeDistance(Math.abs(change))};
      if(change>=1.5&&behind.progress>oldBehind.progress){
        add(tail?'tailClosing':'gapClosing',{...values,name:behind.name,rival:ahead.name,rank:index+2},`close:${ahead.id}:${behind.id}`,index===0?280:tail?(time-this.lastTail>=15000?95:74):85-Math.min(index,2),tail);
      }else if(!tail&&change<=-2){
        add('gapOpening',{...values,name:ahead.name,rival:behind.name},`open:${ahead.id}:${behind.id}`,index===0?260:80-Math.min(index,2));
      }
    }
    const runningLeader=current.find(m=>!m.finished)||leader;
    if(stage&&stage!==this.stage&&!runningLeader.finished){
      const number=parseInt(stage,10),detail=stageDetail(stage);
      if(detail)add('stage',{name:runningLeader.name,stage:cleanStageName(stage),detail},`stage:${number}`,time-this.stageSince>=(keyStageFocusMap()[number]?6000:12000)?116:keyStageFocusMap()[number]?96:70);
    }
    for(const [number,segment] of this.keySegments){
      const active=current.filter(m=>parseInt(m.stage,10)===number&&!m.finished);
      const stageName=cleanStageName(active[0]?.stage||current.find(m=>segment.entries.has(m.id))?.stage||'');
      // Use the stored module label on departures, not the next module's label.
      if(active.length)segment.label=stageName;
      const label=segment.label;
      const bowlRacers=active.filter(m=>m.bowl?.id===number).sort((a,b)=>a.bowl.exitDistance-b.bowl.exitDistance);
      if(bowlRacers.length&&time-segment.since>=3000){
        const m=bowlRacers[0],info=m.bowl,prior=oldById.get(m.id)?.bowl;
        const movement=prior?Math.abs(prior.exitDistance-info.exitDistance):0;
        const values={name:m.name,stage:label,rank:current.indexOf(m)+1,distance:fmt(info.exitDistance),distanceText:describeDistance(info.exitDistance),change:fmt(movement),changeText:describeDistance(movement),speed:fmt(m.speed)};
        const closest=bowlRacers[1];if(closest){const margin=closest.bowl.exitDistance-info.exitDistance;values.rival=closest.name;values.margin=fmt(margin);values.marginText=describeDistance(margin);}
        const kind=info.exitDistance<=info.hole&&info.verticalSpeed<-.5&&info.heightAboveOutlet<1.5?'bowlDrop':prior?.id===number&&prior.exitDistance-info.exitDistance>.6?'bowlInward':prior?.id===number&&info.exitDistance-prior.exitDistance>.6?'bowlOutward':closest?'bowlContest':'bowlSolo';
        const key=`bowl-live:${number}`,last=this.bowlStates.get(key);
        const unchanged=['bowlContest','bowlSolo'].includes(kind)&&last?.kind===kind&&last.name===values.name&&last.rival===values.rival&&Math.abs(Number(last.distance)-info.exitDistance)<.6;
        if(!unchanged)add(kind,values,key,103,false,6000);
      }else if(active.length>=2&&time-segment.since>=6000&&label){
        add('keyStageBattle',{stage:label,names:active.slice(0,4).map(m=>m.name).join(listSeparator()),name:active[0].name,focus:keyStageFocusMap()[number]},`key-battle:${number}`,time-(this.cooldowns.get(`key-battle:${number}`)??segment.since)>=15000?112:91,false,10000);
      }
      if(segment.exitCount>=2||!label)continue;
      const exits=current.map((m,rank)=>({m,rank:rank+1,at:segment.departures.get(m.id),entry:segment.entries.get(m.id)})).filter(x=>x.at!==undefined&&time-x.at<=12000&&!segment.reported.has(x.m.id)&&stable(x.m));
      exits.sort((a,b)=>Math.abs(b.entry.rank-b.rank)-Math.abs(a.entry.rank-a.rank));
      const exit=exits[0];
      if(exit){
        const gain=exit.entry.rank-exit.rank;
        if(segment.exitCount===0||Math.abs(gain)>=2){
          const kind=gain>0?'keyStageGain':gain<0?'keyStageLoss':'keyStageExit';
          add(kind,{name:exit.m.name,stage:label,rank:exit.rank,oldRank:exit.entry.rank,gain:Math.abs(gain)},`key-exit:${number}:${exit.m.id}`,time-exit.at>=6000?114:98);
        }
      }
    }
    const tail=current.slice(-2);
    if(tail.length===2&&!tail.some(m=>m.finished)&&time-this.lastTail>=18000*this.frequencyScale){
      const gap=racerDistance(tail[0],tail[1]);
      add('tailSummary',{name:tail[0].name,rival:tail[1].name,rank:current.length-1,otherRank:current.length,gap:fmt(gap),gapText:describeDistance(gap)},'tail-summary',time-this.lastTail>=30000?108:90,true,18000);
    }
    if(time-this.lastAt>=8500*this.frequencyScale&&current.length>=4&&!leader.finished){
      const gap=racerDistance(leader,current[1]);
      add('frontSummary',{names:current.slice(0,4).map(m=>m.name).join(listSeparator()),gap:fmt(gap),gapText:describeDistance(gap)},'front-summary',40,false,12000);
    }
    const unfinished=current.filter(m=>!m.finished);
    if(leader.finished&&unfinished.length&&time-this.lastAt>=8500*this.frequencyScale){
      const m=unfinished[0],rival=unfinished[1];
      const gap=rival?racerDistance(m,rival):0;
      add(rival?'remainingContest':'lastRunner',{name:m.name,rival:rival?.name,rank:current.indexOf(m)+1,gap:fmt(gap),gapText:describeDistance(gap),speed:fmt(m.speed)},'remaining-contest',89,false,8500);
    }
    candidates.sort((a,b)=>b.score-a.score);
    const event=candidates[0];if(!event)return null;
    if(leadPending&&event.score<260)return null;
    if(pendingRankChange&&event.score<100&&event.kind!=='stage'&&event.kind!=='keyStageBattle')return null;
    if(event.kind==='finish')this.seenFinish.add(current[event.values.rank-1].id);
    if(event.kind==='stage')this.stage=stage;
    if(event.kind==='leadChange'){this.confirmedLeader=leader.id;this.leaderCandidate=null;this.leadSequence++;}
    if(event.key.startsWith('key-exit:')){
      const [,number,id]=event.key.split(':');const segment=this.keySegments.get(Number(number));
      const racer=current.find(m=>String(m.id)===id);if(racer){segment.reported.add(racer.id);segment.exitCount++;}
    }
    return emit(event.kind,event.values,event.key,event.tail);
  }
}
