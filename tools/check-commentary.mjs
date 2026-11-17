import assert from 'node:assert/strict';
import {RaceCommentary,describeDistance} from '../src/race-commentary.js';
const names=['青岚','紫罗','星渊','银河','烈焰','甜旋','金辉','翠羽'];
const base=[1000,980,960,940,900,860,820,800];
assert.equal(describeDistance(1),'不到一个身位');assert.equal(describeDistance(5),'几个身位');assert.equal(describeDistance(30),'一段距离');
const racers=(ids=[0,1,2,3,4,5,6,7],positions=base,speeds=[])=>ids.map((id,rank)=>({id,name:names[id],progress:positions[rank],speed:speeds[rank]??4,finished:false}));
function reporter(){const c=new RaceCommentary(()=>0,{interval:3000,adaptive:false});assert.match(c.update(racers(),0,'racing'),/比赛开场/);return c;}
function stable(c,order){c.update(order,3000,'racing');c.update(order,3500,'racing');return c.update(order,4000,'racing');}
let c=reporter();assert.equal(c.update(racers(),1000,'paused'),null);
const lead=racers([1,0,2,3,4,5,6,7],[1025,1020,980,960,920,880,840,820]);
assert.match(stable(c,lead),/紫罗.*青岚.*第一.*几个身位/);
c=reporter();const surge=racers([0,1,5,2,3,4,6,7],[1020,1000,990,980,960,920,840,820]);
assert.match(stable(c,surge),/甜旋.*3个名次.*第6.*第3/);
c=reporter();const drop=racers([0,2,3,4,5,1,6,7],[1020,1010,1005,1000,995,990,840,820]);
assert.match(stable(c,drop),/紫罗.*掉了4.*第6/);
c=reporter();assert.match(stable(c,racers([0,2,3,4,5,1,6,7],[1020,1010,1005,1000,995,970,840,820])),/紫罗.*掉了4/);
c=reporter();assert.match(c.update(racers(undefined,[1020,1000,988,960,920,880,840,820]),3000,'racing'),/星渊.*追近紫罗.*一小段/);
c=reporter();assert.match(c.update(racers(undefined,[1030,1000,980,960,920,880,840,820]),3000,'racing'),/青岚.*紫罗.*一段距离/);
c=reporter();assert.match(stable(c,racers([0,1,2,3,4,5,7,6],[1020,1000,980,960,920,880,850,840])),/后排.*翠羽.*金辉.*第7/);
c=reporter();assert.match(c.update(racers(undefined,[1020,1000,980,960,920,880,840,830]),3000,'racing'),/翠羽.*金辉.*一小段/);
c=reporter();assert.match(c.update(racers(undefined,[1020,1000,980,960,920,880,840,800.3],[4,4,4,4,4,4,4,.1]),5000,'racing'),/翠羽.*第8.*0.1/);
c=reporter();const midfield=racers([0,1,2,3,5,4,6,7],[1020,1000,980,960,920,910,840,820]);assert.equal(stable(c,midfield),null);
c=reporter();assert.match(c.update(racers(undefined,base.map(x=>x+20)),9000,'racing'),/青岚、紫罗、星渊、银河.*一段距离/);
c=reporter();assert.match(c.update(racers(undefined,base.map(x=>x+20)),18000,'racing'),/最后两名.*金辉.*翠羽/);
for(let stage=1;stage<=30;stage++){
 c=reporter();const text=c.update(racers(),3000,'racing',`${stage} · 赛段`);assert.match(text,/青岚进入赛段/);assert.ok(!text.includes('undefined'));
}
c=reporter();const finish=racers();finish[0].finished=true;assert.match(c.update(finish,1000,'racing'),/青岚.*冲线/);assert.equal(c.update(finish,1500,'racing'),null);
finish[1].finished=true;assert.match(c.update(finish,4000,'racing'),/紫罗.*第2/);assert.equal(c.update(finish,5000,'finished'),null);
console.log('实时解说检查通过：前排换位、±3名以上变化、前排距离趋势、末两名争位/追赶/迟滞、稳定确认、赛段和冲线');

// Actual per-racer module membership: keep describing bowls beyond the leader.
const inBowl=()=>racers().map(m=>({...m,stage:'11 · 落孔漏斗碗'}));
c=reporter();
assert.match(c.update(inBowl(),3000,'racing','11 · 落孔漏斗碗'),/木碗.*落孔/);
assert.match(c.update(inBowl(),9000,'racing','11 · 落孔漏斗碗'),/落孔漏斗碗.*青岚.*紫罗.*星渊.*银河/);
const left=inBowl();left[0].stage='12 · 下层双球窄桥';
assert.match(c.update(left,12000,'racing','12 · 下层双球窄桥'),/青岚.*通过落孔漏斗碗.*第1/);
const still=inBowl();still[0].stage='12 · 下层双球窄桥';
assert.match(c.update(still,19000,'racing','12 · 下层双球窄桥'),/落孔漏斗碗.*紫罗/);
// First arrival plus departure within the normal reporting interval retains its label.
c=reporter();c.update(inBowl(),1000,'racing','11 · 落孔漏斗碗');
assert.match(c.update(left,4000,'racing','12 · 下层双球窄桥'),/通过落孔漏斗碗/);
// Entry rank is tracked independently for all eight competitors.
c=reporter();c.update(inBowl(),3000,'racing','11 · 落孔漏斗碗');
const gainExit=racers([0,1,2,4,3,5,6,7],base.map(x=>x+10)).map(m=>({...m,stage:m.id===4?'12 · 下层双球窄桥':'11 · 落孔漏斗碗'}));
c.update(gainExit,6000,'racing','11 · 落孔漏斗碗');
assert.match(c.update(gainExit,7000,'racing','11 · 落孔漏斗碗'),/烈焰.*进入时第5.*现在第4.*净升1/);
// A headline lead change keeps the crucial stage explanation too.
c=reporter();
const criticalLead=lead.map(m=>({...m,stage:'16 · 木质落孔碗'}));
c.update(criticalLead,3000,'racing');c.update(criticalLead,3500,'racing');
const busy=c.update(criticalLead,4000,'racing','16 · 木质落孔碗');
assert.match(busy,/反超/);assert.ok(!busy.includes('我们再看'));
assert.match(c.update(criticalLead,7000,'racing','16 · 木质落孔碗'),/中心孔/);
// Performance coverage extends to midfield racers without inventing collision causes.
c=reporter();assert.match(c.update(racers(undefined,base.map(x=>x+5),[4,4,4,4,.5,4,4,4]),5000,'racing'),/烈焰.*节奏慢/);
console.log('关键赛段检查通过：入碗、持续争位、真实离段、入段名次对照、拥挤事件保留机制描述和中游表现');

const slower=new RaceCommentary(()=>0);
assert.equal(slower.interval,6000);
slower.update(racers(),0,'racing');
assert.equal(slower.update(racers(),3000,'racing','11 · 落孔漏斗碗'),null);
assert.equal(slower.update(racers(),5999,'racing','11 · 落孔漏斗碗'),null);
assert.match(slower.update(racers(),6000,'racing','11 · 落孔漏斗碗'),/落孔漏斗碗/);
assert.equal(slower.update(racers(),9000,'racing','12 · 下层双球窄桥'),null);
const champion=racers();champion[0].finished=true;
assert.match(slower.update(champion,9001,'racing','终点'),/青岚.*冲线/);
console.log('降低频率检查通过：常规间隔 6 秒，冠军仍即时播报');

// First-place events outrank critical stage and bowl commentary.
const priority=new RaceCommentary(()=>0,{adaptive:false});priority.update(racers(),0,'racing');
const newLeader=lead.map(m=>({...m,stage:'16 · 木质落孔碗'}));
priority.update(newLeader,1000,'racing','16 · 木质落孔碗');
priority.update(newLeader,2000,'racing','16 · 木质落孔碗');
assert.match(priority.update(newLeader,6000,'racing','16 · 木质落孔碗'),/紫罗.*青岚/);
assert.equal(priority.lastKind,'leadChange');
// Return of the former leader is not suppressed by a long repeat cooldown.
const returnLead=racers(undefined,base.map(x=>x+50));
priority.update(returnLead,7000,'racing','16 · 木质落孔碗');
assert.match(priority.update(returnLead,12000,'racing','16 · 木质落孔碗'),/青岚.*紫罗/);
assert.equal(priority.lastKind,'leadChange');
const closePriority=new RaceCommentary(()=>0,{interval:3000,adaptive:false});closePriority.update(racers(),0,'racing');
const closing=racers(undefined,[1020,1008,980,960,920,880,840,820]);
closing[0].stage='11 · 落孔漏斗碗';closing[0].bowl={id:11,exitDistance:3,hole:1.55,verticalSpeed:0,heightAboveOutlet:3};
assert.match(closePriority.update(closing,3000,'racing','11 · 落孔漏斗碗'),/紫罗.*青岚/);
assert.equal(closePriority.lastKind,'gapClosing');
console.log('第一争夺优先级检查通过：头名易主、追近、关键赛段竞争及反复易主不漏报');
