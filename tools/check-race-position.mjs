import assert from 'node:assert/strict';
import {bowlPosition,rankingParameter,straightDistance,crossingTime} from '../src/race-position.js';
import {RaceCommentary} from '../src/race-commentary.js';
import {liveCorpus} from '../src/live-commentary-corpus.js';
const bowls=[{id:11,label:'11 · 落孔漏斗碗',x:0,z:-246,radius:12,hole:1.55,rimY:30},{id:16,label:'16 · 木质落孔碗',x:0,z:-354,radius:12,hole:1.55,rimY:10}];
for(const b of bowls){
  // Outer ball happens to sit farther down z; it must NOT lead the inner ball.
  const outside={x:0,y:b.rimY-1,z:b.z-10},inside={x:2,y:b.rimY-4,z:b.z};
  const outerInfo=bowlPosition(outside,{x:0,y:0,z:0},bowls),innerInfo=bowlPosition(inside,{x:-1,y:0,z:0},bowls);
  assert.equal(outerInfo.id,b.id);assert.equal(innerInfo.exitDistance,2);assert.equal(innerInfo.inwardSpeed,1);
  assert.ok(rankingParameter(inside,inside.z,bowls,innerInfo)<rankingParameter(outside,outside.z,bowls,outerInfo));
  const landing={x:0,y:b.rimY-8,z:b.z};assert.equal(bowlPosition(landing,{x:0,y:0,z:0},bowls),null);
  assert.ok(rankingParameter(landing,landing.z,bowls,null)<innerInfo.parameter);
}
assert.equal(straightDistance({x:0,y:0,z:0},{x:3,y:4,z:0}),5);
assert.equal(crossingTime(-990,-994,-992,1000,1040),1020);
assert.equal(crossingTime(-990,-991,-992,1000,1040),null);
assert.ok(crossingTime(-990,-995,-992,1000,1040)<crossingTime(-990,-993,-992,1000,1040));
const racers=()=>Array.from({length:8},(_,id)=>({id,name:`球${id}`,progress:100-id*10,speed:5,finished:false,finishTime:undefined,stage:'11 · 落孔漏斗碗',bowl:{id:11,exitDistance:5+id,hole:1.55,inwardSpeed:0,verticalSpeed:0,heightAboveOutlet:3}}));
const reporter=()=>{const c=new RaceCommentary(()=>0,{interval:3000,adaptive:false});c.update(racers(),0,'racing','11 · 落孔漏斗碗');return c;};
let c=reporter(),r=racers();r[0].bowl.exitDistance=3;
assert.match(c.update(r,3000,'racing','11 · 落孔漏斗碗'),/球0.*中心.*几个身位/);assert.equal(c.lastValues.change,'2.0');assert.equal(c.lastKind,'bowlInward');
c=reporter();r=racers();r[0].bowl.exitDistance=6;
assert.match(c.update(r,3000,'racing','11 · 落孔漏斗碗'),/球0.*往外.*不到一个身位/);assert.equal(c.lastKind,'bowlOutward');
c=reporter();r=racers();r[0].bowl={...r[0].bowl,exitDistance:1,verticalSpeed:-2,heightAboveOutlet:.3};
assert.match(c.update(r,3000,'racing','11 · 落孔漏斗碗'),/球0.*向下落/);assert.equal(c.lastKind,'bowlDrop');
c=reporter();assert.match(c.update(racers(),3000,'racing','11 · 落孔漏斗碗'),/球0.*球1.*第1/);assert.equal(c.lastValues.distance,'5.0');assert.equal(c.lastValues.margin,'1.0');
assert.equal(c.update(racers(),6000,'racing','11 · 落孔漏斗碗'),null);
// All arrivals are emitted in order, including when all finish in the same frame.
c=new RaceCommentary(()=>0);
r=racers().map((m,i)=>({...m,finished:true,finishTime:10000+i*100}));
assert.match(c.update(r,10000,'finished','终点'),/球0/);
for(let rank=2;rank<=8;rank++){
  const text=c.update(r,10000+(rank-1)*6000,'finished','终点');
  assert.ok(text.includes(`球${rank-1}`));assert.ok(text.includes(`第${rank}`));assert.equal(c.lastKind,'finish');
}
assert.equal(c.update(r,60000,'finished','终点'),null);
// Fifth/sixth places also receive live coverage after the champion arrives.
c=new RaceCommentary(()=>0,{interval:3000,adaptive:false});r=racers();r.forEach(m=>{m.stage='30 · 终点冲线';m.bowl=null;});r[0].finished=true;
c.update(r,0,'racing','30 · 终点冲线');c.update(r,500,'racing','30 · 终点冲线');
const swapped=[...r.slice(0,4),r[5],r[4],...r.slice(6)].map((m,i)=>({...m,progress:120-i*10}));
c.update(swapped,3000,'racing','30 · 终点冲线');c.update(swapped,3500,'racing','30 · 终点冲线');
assert.match(c.update(swapped,4000,'racing','30 · 终点冲线'),/球5.*第5/);assert.equal(c.lastKind,'remainingPass');
// Text length and emotion are event driven, with analysis kept longer.
c=new RaceCommentary(()=>0);
const short=c.line('leadChange',{name:'青岚',rival:'紫罗',gap:'1.0'});assert.ok(short.length<=35);assert.equal(c.lastMood,'excited');
const long=c.line('stage',{name:'青岚',stage:'落孔漏斗碗',detail:'先观察盘旋半径和出口位置，再看选手能否向中心收拢，把速度变成通过的先后。'});
assert.ok(long.length>short.length);assert.equal(c.lastMood,'analysis');
assert.equal(liveCorpus.start.length,18);
console.log('排名及情境解说检查通过：两个漏斗出口远近、下层先行、直线距离、同帧冲线、全部名次、赛后换位、动态漏斗及长短情绪。');
