import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbbb5a9);
scene.fog = new THREE.FogExp2(0xb9b3a8, 0.011);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.06, 260);
camera.position.set(14, 11, 33);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.target.set(0, 2.6, 26);
orbit.maxDistance = 65;
orbit.minDistance = 3;
orbit.maxPolarAngle = Math.PI * 0.49;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.85;

scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x554630, 2.2));
const sun = new THREE.DirectionalLight(0xfff4df, 4.4);
sun.position.set(-14, 24, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.00015;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.24;
world.defaultContactMaterial.restitution = 0.18;

const trackMaterial = new CANNON.Material('track');
const marblePhysicsMaterial = new CANNON.Material('marble');
world.addContactMaterial(new CANNON.ContactMaterial(trackMaterial, marblePhysicsMaterial, {
  friction: 0.09, restitution: 0.28, contactEquationStiffness: 1e9, contactEquationRelaxation: 2
}));

function makeWoodTexture(size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0,0,size,0); g.addColorStop(0,'#b77a3e'); g.addColorStop(.42,'#d4a363'); g.addColorStop(1,'#a96c34');
  x.fillStyle = g; x.fillRect(0,0,size,size);
  let seed = 1847; const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<230;i++){
    const y=rnd()*size, amp=2+rnd()*12, freq=.006+rnd()*.018;
    x.beginPath();
    for(let px=0;px<=size;px+=7){ const py=y+Math.sin(px*freq+rnd()*.3)*amp; px?x.lineTo(px,py):x.moveTo(px,py); }
    x.strokeStyle=`rgba(${70+rnd()*45},${35+rnd()*25},${12+rnd()*15},${.025+rnd()*.08})`; x.lineWidth=.5+rnd()*2.5; x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.2,7); t.anisotropy=8; return t;
}

function makeMdfTexture() {
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d'); x.fillStyle='#806047'; x.fillRect(0,0,512,512);
  let seed=91; const rnd=()=>((seed=Math.imul(seed,1103515245)+12345|0)>>>0)/4294967296;
  for(let i=0;i<4200;i++){ const v=45+rnd()*60; x.fillStyle=`rgba(${v},${v*.72},${v*.48},${.05+rnd()*.12})`; x.fillRect(rnd()*512,rnd()*512,1+rnd()*2,1+rnd()*2); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,12); t.anisotropy=8; return t;
}

const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness:.53, metalness:0, color:0xd5a46b });
const mdf = new THREE.MeshStandardMaterial({ map: makeMdfTexture(), roughness:.72, color:0x8d6b50 });
const steel = new THREE.MeshPhysicalMaterial({ color:0xdce1e2, metalness:1, roughness:.16, clearcoat:.5 });
const yellow = new THREE.MeshStandardMaterial({ color:0xe7ad16, roughness:.38 });

const slope = 0.14;
const trackCenterZ = -38;
const trackCenterY = 1.8;
const trackStartZ = 46;
const trackEndZ = -126;
const trackWidth = 12;
function surfaceY(z){ return trackCenterY + slope * (z-trackCenterZ); }
function trackX(z){
  if(z>18)return 0;
  const t=THREE.MathUtils.clamp((18-z)/142,0,1);
  return Math.sin(t*Math.PI*2.35)*4.1+Math.sin(t*Math.PI*.82)*1.55;
}
function trackFrame(z){
  const dz=.1, dx=(trackX(z-dz)-trackX(z+dz))/(dz*2);
  const forward=new THREE.Vector3(dx,-slope,-1).normalize();
  const right=new THREE.Vector3(-forward.z,0,forward.x).normalize();
  return {forward,right};
}
function trackPoint(offset,z,lift=0){
  const {right}=trackFrame(z);
  return new THREE.Vector3(trackX(z)+right.x*offset,surfaceY(z)+lift,z+right.z*offset);
}

function addStaticBox({x=0,y=0,z=0,w,h,d,mat=wood,rx=0,ry=0,rz=0,quat=null,cast=true}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z);
  if(quat)mesh.quaternion.copy(quat);else mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=cast; mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))}); body.position.set(x,y,z);
  if(quat)body.quaternion.set(quat.x,quat.y,quat.z,quat.w);else body.quaternion.setFromEuler(rx,ry,rz);
  world.addBody(body); return {mesh,body};
}

function addTrackSegment(z1,z2){
  const p1=new THREE.Vector3(trackX(z1),surfaceY(z1),z1), p2=new THREE.Vector3(trackX(z2),surfaceY(z2),z2);
  const mid=p1.clone().add(p2).multiplyScalar(.5), dir=p2.clone().sub(p1), len=dir.length()+.28;
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().normalize());
  addStaticBox({x:mid.x,y:mid.y-.34,z:mid.z,w:trackWidth,h:.68,d:len,mat:mdf,quat:q});
  const {right}=trackFrame((z1+z2)/2);
  for(const side of [-1,1]){
    const p=mid.clone().add(right.clone().multiplyScalar(side*(trackWidth/2+.08)));
    addStaticBox({x:p.x,y:p.y+.83,z:p.z,w:.46,h:2.3,d:len+.15,mat:wood,quat:q});
  }
}
for(let z=trackStartZ;z>trackEndZ;z-=6)addTrackSegment(z,Math.max(trackEndZ,z-6));

// Room walls and supports, kept outside the race physics.
const wallMat=new THREE.MeshStandardMaterial({color:0xc9c6bf,roughness:.94});
const wall=new THREE.Mesh(new THREE.PlaneGeometry(210,55),wallMat); wall.position.set(-15,8,-38); wall.rotation.y=Math.PI/2; wall.receiveShadow=true; scene.add(wall);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(170,210),new THREE.MeshStandardMaterial({color:0x9a7653,roughness:.82})); floor.rotation.x=-Math.PI/2; floor.position.y=-11; floor.receiveShadow=true; scene.add(floor);
for(const z of [36,8,-22,-52,-82,-112]){
  const c=trackX(z);
  for(const x of [c-5.2,c+5.2]){ const p=new THREE.Mesh(new THREE.BoxGeometry(.8,15,.8),wood); p.position.set(x,surfaceY(z)-7.8,z); p.castShadow=p.receiveShadow=true; scene.add(p); }
}

function addPeg(offset,z,r=.28,h=1.6){
  const p=trackPoint(offset,z,h/2+.08);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),wood); mesh.position.copy(p); mesh.castShadow=mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Cylinder(r,r,h,16)}); body.position.set(p.x,p.y,p.z); world.addBody(body);
}

// Section 2: evenly spaced peg field; gaps are always wider than one marble.
for(let row=0;row<8;row++){
  const z=10-row*3.25, shift=row%2?1.35:0;
  for(let offset=-4.2+shift;offset<=4.3;offset+=2.7)addPeg(offset,z,.24,1.5);
}

function addBarrierBetween(a,b,mat=steel,height=.72,thickness=.34){
  const pa=trackPoint(a.offset,a.z,height/2+.08), pb=trackPoint(b.offset,b.z,height/2+.08);
  const mid=pa.clone().add(pb).multiplyScalar(.5), dir=pb.clone().sub(pa), len=dir.length();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),dir.clone().normalize());
  return addStaticBox({x:mid.x,y:mid.y,z:mid.z,w:len,h:height,d:thickness,mat,quat:q});
}

// Section 1: a sealed metal funnel. Rails touch both side walls and narrow to a 2.5-unit throat,
// allowing two 1.1-unit-diameter marbles through side by side with a small physical clearance.
addBarrierBetween({offset:-5.72,z:32},{offset:-1.25,z:21},steel,.86,.4);
addBarrierBetween({offset:5.72,z:32},{offset:1.25,z:21},steel,.86,.4);
addBarrierBetween({offset:-1.25,z:21},{offset:-1.25,z:17.5},steel,.86,.4);
addBarrierBetween({offset:1.25,z:21},{offset:1.25,z:17.5},steel,.86,.4);

// Section 3: alternating deflectors leave a clear escape lane and force overtaking lines.
for(const [offset,z,side] of [[-2.7,-20,1],[2.7,-31,-1],[-2.5,-42,1],[2.5,-53,-1]]){
  addBarrierBetween({offset:offset-side*2.35,z:z+1.6},{offset:offset+side*1.4,z:z-1.6},yellow,.72,.48);
}

// Section 4: a broad S-chicane with paired gates; never narrower than 2.6 units.
addBarrierBetween({offset:-5.65,z:-66},{offset:1.55,z:-73},steel,.82,.38);
addBarrierBetween({offset:5.65,z:-78},{offset:-1.55,z:-85},steel,.82,.38);
addBarrierBetween({offset:-5.65,z:-90},{offset:1.55,z:-97},steel,.82,.38);

// Finish sensor and catch box.
const finishZ=-116;
const stripeMat=new THREE.MeshStandardMaterial({color:0xf0eee8,roughness:.55});
const darkStripe=new THREE.MeshStandardMaterial({color:0x181818,roughness:.55});
for(let i=0;i<10;i++){
  const p=trackPoint(-5.4+i*1.2,finishZ,.06);
  const {forward}=trackFrame(finishZ),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),forward);
  addStaticBox({x:p.x,y:p.y,z:p.z,w:1.18,h:.08,d:1.3,mat:i%2?stripeMat:darkStripe,quat:q,cast:false});
}
addBarrierBetween({offset:-5.7,z:-124},{offset:5.7,z:-124},wood,1.8,.55);

// Starting gate.
const gate=addBarrierBetween({offset:-5.65,z:36},{offset:5.65,z:36},steel,1.5,.42);
let gateActive=true;

const marbleDefs=[
  ['青岚',0x20c4c9,'glass'],['紫罗',0x9d4bd2,'glass'],['星渊',0x342277,'stars'],['银河',0x4779cf,'galaxy'],
  ['烈焰',0xe44324,'fire'],['甜旋',0xff4f91,'candy'],['金辉',0xe5b51d,'metal'],['翠羽',0x38b97c,'glass']
];
const marbles=[];
const finishOrder=[];

function makePatternTexture(style){
  const c=document.createElement('canvas'); c.width=768; c.height=384; const x=c.getContext('2d');
  if(style==='candy'){
    x.fillStyle='#fff7e8';x.fillRect(0,0,c.width,c.height);
    x.strokeStyle='#ef377d';x.lineWidth=58;
    for(let n=-5;n<12;n++){x.beginPath();for(let px=0;px<=768;px+=8){const py=n*86+px*.55+Math.sin(px*.018)*22;px?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}
  }else{
    const g=x.createLinearGradient(0,0,768,384);
    if(style==='fire'){g.addColorStop(0,'#220300');g.addColorStop(.38,'#a50e00');g.addColorStop(.72,'#ff7200');g.addColorStop(1,'#ffe36a');}
    else if(style==='galaxy'){g.addColorStop(0,'#030414');g.addColorStop(.38,'#2a1670');g.addColorStop(.62,'#b637a6');g.addColorStop(1,'#136bc6');}
    else{g.addColorStop(0,'#01020b');g.addColorStop(.52,'#171340');g.addColorStop(1,'#04030f');}
    x.fillStyle=g;x.fillRect(0,0,768,384);
    let seed=style==='fire'?407:913;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    if(style==='fire'){
      for(let i=0;i<75;i++){const px=rnd()*768,base=380+rnd()*35,h=45+rnd()*180;x.beginPath();x.moveTo(px-18,base);x.quadraticCurveTo(px-35,base-h*.55,px,base-h);x.quadraticCurveTo(px+35,base-h*.45,px+18,base);x.fillStyle=`rgba(255,${80+rnd()*150},0,${.24+rnd()*.5})`;x.fill();}
    }else{
      for(let i=0;i<300;i++){const r=rnd()<.04?2.2:0.5+rnd();x.beginPath();x.arc(rnd()*768,rnd()*384,r,0,Math.PI*2);x.fillStyle=`rgba(${190+rnd()*65},${205+rnd()*50},255,${.45+rnd()*.55})`;x.fill();}
      if(style==='galaxy'){x.strokeStyle='rgba(190,170,255,.38)';x.lineWidth=36;x.beginPath();x.moveTo(-30,330);x.bezierCurveTo(190,20,520,370,800,30);x.stroke();}
    }
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;
}

function makeMarbleMaterial(color,style){
  if(style==='glass')return new THREE.MeshPhysicalMaterial({color,metalness:0,roughness:.07,transmission:.72,transparent:true,opacity:.88,thickness:1.1,ior:1.48,clearcoat:1,envMapIntensity:1.7});
  if(style==='metal')return new THREE.MeshPhysicalMaterial({color,metalness:.82,roughness:.12,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.8});
  return new THREE.MeshPhysicalMaterial({color:0xffffff,map:makePatternTexture(style),metalness:style==='stars'?.34:.12,roughness:.12,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.65});
}

function createMarble([name,color,style],i){
  const mat=makeMarbleMaterial(color,style);
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.55,48,32),mat); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:.09,material:marblePhysicsMaterial,shape:new CANNON.Sphere(.55),linearDamping:.006,angularDamping:.012,allowSleep:false});
  body.ccdSpeedThreshold=.35;
  body.ccdIterations=20;
  body.addEventListener('collide',event=>playImpact(event.contact.getImpactVelocityAlongNormal()));
  world.addBody(body);
  const m={name,color,mesh,body,index:i,finished:false,finishTime:null}; marbles.push(m); return m;
}
marbleDefs.forEach(createMarble);

const initialOrder=[-4.15,-2.95,-1.75,-.55,.65,1.85,3.05,4.25];
function resetMarbles(){
  marbles.forEach((m,i)=>{ const z=40+(i%2)*1.25,p=trackPoint(initialOrder[i],z,.82); m.body.position.set(p.x,p.y,p.z); m.body.velocity.setZero(); m.body.angularVelocity.setZero(); m.body.quaternion.set(0,0,0,1); m.body.wakeUp(); m.finished=false; m.finishTime=null; });
  finishOrder.length=0;
}
resetMarbles();

const rankList=document.querySelector('#rankList');
const focusSelect=document.querySelector('#focusSelect');
marbles.forEach((m,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=m.name; focusSelect.append(o); });
let focusIndex=0;
focusSelect.value='0';
function cssColor(n){ return `#${n.toString(16).padStart(6,'0')}`; }

let raceState='ready', raceStart=0, elapsed=0, pauseAt=0, countdownTimer=null;
const startBtn=document.querySelector('#startBtn'), pauseBtn=document.querySelector('#pauseBtn');
const resetBtn=document.querySelector('#resetBtn'), countdown=document.querySelector('#countdown');
const finishCard=document.querySelector('#finishCard');

function removeGate(){
  if(!gateActive)return;
  world.removeBody(gate.body); gate.mesh.visible=false; gateActive=false;
  marbles.forEach((m,i)=>{
    const forward=trackFrame(m.body.position.z).forward;
    m.body.velocity.set(forward.x*.3,forward.y*.3,forward.z*.3);
    m.body.angularVelocity.set(0,0,0);
    m.body.wakeUp();
  });
}
function restoreGate(){ if(gateActive)return; world.addBody(gate.body); gate.mesh.visible=true; gateActive=true; }

function beginRace(){
  if(raceState==='racing')return;
  if(raceState==='finished') resetRace();
  raceState='countdown'; finishCard.hidden=true; startBtn.disabled=true; pauseBtn.disabled=true;
  let n=3; countdown.textContent=n;
  clearInterval(countdownTimer);
  countdownTimer=setInterval(()=>{ n--; if(n>0){countdown.textContent=n;} else if(n===0){countdown.textContent='出发';} else { clearInterval(countdownTimer); countdown.textContent=''; removeGate(); raceState='racing'; raceStart=performance.now(); pauseBtn.disabled=false; startBtn.textContent='比赛中'; } },700);
}
function resetRace(){
  clearInterval(countdownTimer); restoreGate(); resetMarbles(); raceState='ready'; elapsed=0; startBtn.disabled=false; startBtn.textContent='开始比赛'; pauseBtn.disabled=true; pauseBtn.textContent='暂停'; countdown.textContent=''; finishCard.hidden=true;
}
function togglePause(){
  if(raceState==='racing'){ raceState='paused'; pauseAt=performance.now(); pauseBtn.textContent='继续'; }
  else if(raceState==='paused'){ raceStart+=performance.now()-pauseAt; raceState='racing'; pauseBtn.textContent='暂停'; }
}
startBtn.addEventListener('click',beginRace); resetBtn.addEventListener('click',resetRace); pauseBtn.addEventListener('click',togglePause);
document.querySelector('#raceAgainBtn').addEventListener('click',()=>{resetRace();beginRace();});
focusSelect.addEventListener('change',()=>{focusIndex=Number(focusSelect.value);updateFocusUI();});
addEventListener('keydown',e=>{ const n=Number(e.key); if(n>=1&&n<=8){focusIndex=n-1;focusSelect.value=String(focusIndex);updateFocusUI();} if(e.code==='Space'){e.preventDefault(); raceState==='ready'?beginRace():togglePause();} });

let soundOn=true; document.querySelector('#audioBtn').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.textContent=`声音：${soundOn?'开':'关'}`;});

let audioContext=null, lastImpactAt=0;
function ensureAudio(){
  if(!audioContext) audioContext=new AudioContext();
  if(audioContext.state==='suspended') audioContext.resume();
}
function playImpact(velocity){
  if(!soundOn || Math.abs(velocity)<.65 || performance.now()-lastImpactAt<34) return;
  ensureAudio(); lastImpactAt=performance.now();
  const now=audioContext.currentTime, gain=audioContext.createGain(), osc=audioContext.createOscillator();
  const strength=Math.min(Math.abs(velocity)/7,1);
  osc.type='sine'; osc.frequency.setValueAtTime(520+strength*430,now); osc.frequency.exponentialRampToValueAtTime(260,now+.055);
  gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(.025+strength*.07,now+.004); gain.gain.exponentialRampToValueAtTime(.0001,now+.075);
  osc.connect(gain).connect(audioContext.destination); osc.start(now); osc.stop(now+.08);
}
startBtn.addEventListener('pointerdown',ensureAudio,{once:true});

function getProgress(m){ return trackStartZ-m.body.position.z; }
function ordered(){
  return [...marbles].sort((a,b)=>{
    if(a.finished&&b.finished)return a.finishTime-b.finishTime;
    if(a.finished)return -1;
    if(b.finished)return 1;
    return getProgress(b)-getProgress(a);
  });
}
function updateFocusUI(){ const m=marbles[focusIndex]; document.querySelector('#focusName').textContent=m.name; document.querySelector('#focusDot').style.background=cssColor(m.color); }
updateFocusUI();

function updateHUD(){
  const order=ordered(); rankList.innerHTML=''; const leaderP=getProgress(order[0]), leaderFinished=order[0].finished;
  order.slice(0,5).forEach((m,i)=>{
    const li=document.createElement('li'); if(m.index===focusIndex)li.className='focused';
    let status='领先';
    if(leaderFinished) status=m.finished?`${(m.finishTime/1000).toFixed(2)}s`:'比赛中';
    else if(i) status=`−${Math.max(0,leaderP-getProgress(m)).toFixed(1)}m`;
    li.innerHTML=`<span class="rank-num">${i+1}</span><span class="rank-ball" style="background:${cssColor(m.color)}"></span><span>${m.name}</span><span class="rank-gap">${status}</span>`; rankList.append(li);
  });
  const f=marbles[focusIndex]; document.querySelector('#speedText').textContent=f.body.velocity.length().toFixed(1);
  const t=Math.max(0,elapsed); const min=Math.floor(t/60000),sec=Math.floor(t/1000)%60,ms=Math.floor(t%1000); document.querySelector('#raceClock').textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  const z=order[0].body.position.z;
  document.querySelector('#stageText').textContent=z>17?'双球漏斗':z>-18?'木钉迷阵':z>-60?'交错挡板':z>-102?'曲折回廊':'终点冲刺';
}

function checkFinish(){
  if(raceState!=='racing')return;
  for(const m of marbles){ if(!m.finished && m.body.position.z<finishZ){ m.finished=true; m.finishTime=elapsed; finishOrder.push(m); } }
  if(finishOrder.length && (finishOrder.length===marbles.length || elapsed>90000)){
    raceState='finished'; pauseBtn.disabled=true; startBtn.textContent='比赛结束';
    const w=finishOrder[0]; document.querySelector('#winnerName').textContent=w.name; document.querySelector('#winnerName').style.color=cssColor(w.color); document.querySelector('#finishTime').textContent=`用时 ${(w.finishTime/1000).toFixed(3)} 秒`; finishCard.hidden=false;
  }
}

const cameraMode=document.querySelector('#cameraMode');
const camPos=new THREE.Vector3(), camTarget=new THREE.Vector3();
let programmaticCamera=false;
function enterFreeCamera(){
  if(programmaticCamera || cameraMode.value==='free') return;
  cameraMode.value='free';
}
canvas.addEventListener('pointerdown',enterFreeCamera);
canvas.addEventListener('wheel',enterFreeCamera,{passive:true});
cameraMode.addEventListener('change',()=>{ orbit.target.copy(camTarget); });
function updateCamera(dt){
  const mode=cameraMode.value, focus=marbles[focusIndex], leader=ordered()[0];
  if(mode==='free'){ orbit.update(); return; }
  programmaticCamera=true;
  if(mode==='follow'){
    const m=focus.finished?leader:focus,{right}=trackFrame(m.body.position.z);
    camPos.set(m.body.position.x+right.x*4.2,m.body.position.y+6.1,m.body.position.z+9+right.z*4.2);
    camTarget.set(trackX(m.body.position.z-5),surfaceY(m.body.position.z-5),m.body.position.z-5);
  } else if(mode==='overhead'){
    camPos.set(trackX(leader.body.position.z),32,leader.body.position.z+5); camTarget.set(trackX(leader.body.position.z-9),surfaceY(leader.body.position.z-9),leader.body.position.z-9);
  } else {
    camPos.set(trackX(leader.body.position.z+10),19,leader.body.position.z+14); camTarget.set(trackX(leader.body.position.z-8),surfaceY(leader.body.position.z-8),leader.body.position.z-8);
  }
  const k=1-Math.exp(-dt*(mode==='follow'?2.8:1.5)); camera.position.lerp(camPos,k); orbit.target.lerp(camTarget,k); orbit.update();
  programmaticCamera=false;
}

let last=performance.now(), accumulator=0;
function animate(now){
  requestAnimationFrame(animate); const dt=Math.min((now-last)/1000,.05); last=now;
  if(raceState==='racing'){
    accumulator+=dt; while(accumulator>=1/180){world.step(1/180);accumulator-=1/180;}
    elapsed=now-raceStart;
  }
  for(const m of marbles){m.mesh.position.copy(m.body.position);m.mesh.quaternion.copy(m.body.quaternion);}
  checkFinish(); updateHUD(); updateCamera(dt); renderer.render(scene,camera);
}
requestAnimationFrame(animate);

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));});
