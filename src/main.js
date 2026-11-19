import * as THREE from 'three';
import * as CANNON from './rapier-adapter.js';
import { raceRandom, startVariation } from './race-variation.js';
import { glassImpact,impactMaterialFor } from './impact-audio.js';
import {newAccount,placeBet,settleBet,abandonBet,claimDaily,DAILY_BONUS,STAKE_PER_PICK,championReward} from './betting.js';
import {RaceCommentary} from './race-commentary.js';
import {DanmakuOverlay} from './race-danmaku.js';
import {bowlPosition,rankingParameter,straightDistance,crossingTime} from './race-position.js';
import {VoiceCommentary} from './voice-commentary.js';
import {loadVoiceSettings,setupVoiceSettings} from './voice-settings.js';
import {directorCue,stageRacer} from './director-camera.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyDomI18n, getLocale, initLocale, moduleLabel, onLocaleChange, racerName, resolveAutoLocale, selectLanguage, setLocale, stageLabel, storedPreference, t, woodName } from './i18n/index.js';
import './style.css';

// Pick a starting language before anything renders, then localize the static markup.
const localeBoot = initLocale();
applyDomI18n();

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const displayPixelRatio=()=>Math.min(devicePixelRatio,matchMedia('(max-width: 760px)').matches?1.5:2);
renderer.setPixelRatio(displayPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .88;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbbb5a9);
scene.fog = new THREE.FogExp2(0xb9b3a8, 0.011);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.06, 260);
camera.position.set(14, 11, 33);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.target.set(0, 2.6, 26);
orbit.maxDistance = 220;
orbit.minDistance = 3;
orbit.maxPolarAngle = Math.PI * 0.49;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 1.05;

scene.add(new THREE.HemisphereLight(0xe9f1ff, 0x554630, .82));
const sun = new THREE.DirectionalLight(0xfff1de, 3.1);
sun.position.set(-14, 24, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.00015;
sun.shadow.normalBias=.035;
sun.shadow.camera.near=.5;sun.shadow.camera.far=120;
scene.add(sun);
scene.add(sun.target);
// Broad, cool window fill keeps clear glass readable against the warm workshop.
const windowFill=new THREE.DirectionalLight(0xdceaff,.72);
windowFill.position.set(12,16,-18);
scene.add(windowFill);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.24;
world.defaultContactMaterial.restitution = 0.18;

const trackMaterial = new CANNON.Material('track');
const marblePhysicsMaterial = new CANNON.Material('marble');
world.addContactMaterial(new CANNON.ContactMaterial(trackMaterial, marblePhysicsMaterial, {
  friction: 0.08, restitution: 0.12, contactEquationStiffness: 1e7, contactEquationRelaxation: 4
}));

const visualRaceSeed=typeof window==='undefined'?(globalThis.__trackSeed??1):crypto.getRandomValues(new Uint32Array(1))[0];
const woodSpecies=[
  {name:'浅色枫木',colors:['#b89462','#e4c999','#a9794d'],grain:[92,55,27],lines:300,wave:4,knots:1},
  {name:'蜂蜜橡木',colors:['#a66b39','#d9a667','#98602f'],grain:[75,41,20],lines:230,wave:12,knots:4},
  {name:'樱桃木',colors:['#96533d','#c8835a','#81432e'],grain:[69,29,18],lines:190,wave:7,knots:2},
  {name:'胡桃木',colors:['#63442f','#96704d','#533723'],grain:[43,26,17],lines:260,wave:15,knots:5}
];
const selectedWood=woodSpecies[visualRaceSeed%woodSpecies.length];
function makeWoodTexture(size = 512,species=selectedWood) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0,0,size,0); g.addColorStop(0,species.colors[0]); g.addColorStop(.42,species.colors[1]); g.addColorStop(1,species.colors[2]);
  x.fillStyle = g; x.fillRect(0,0,size,size);
  let seed = 1847+woodSpecies.indexOf(species)*7301; const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<species.lines;i++){
    const y=rnd()*size, amp=1+rnd()*species.wave, freq=.006+rnd()*.018;
    x.beginPath();
    for(let px=0;px<=size;px+=7){ const py=y+Math.sin(px*freq+rnd()*.3)*amp; px?x.lineTo(px,py):x.moveTo(px,py); }
    x.strokeStyle=`rgba(${species.grain[0]+rnd()*25},${species.grain[1]+rnd()*19},${species.grain[2]+rnd()*13},${.025+rnd()*.08})`; x.lineWidth=.5+rnd()*2.5; x.stroke();
  }
  for(let i=0;i<species.knots;i++){
    x.beginPath();x.ellipse(rnd()*size,rnd()*size,8+rnd()*13,2+rnd()*4,rnd()*.25,0,Math.PI*2);
    x.strokeStyle=`rgba(${species.grain.join(',')},.1)`;x.lineWidth=1+rnd()*2;x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.2,7); t.anisotropy=8; return t;
}

function makeMdfTexture() {
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d'); x.fillStyle='#806047'; x.fillRect(0,0,512,512);
  let seed=91; const rnd=()=>((seed=Math.imul(seed,1103515245)+12345|0)>>>0)/4294967296;
  for(let i=0;i<4200;i++){ const v=45+rnd()*60; x.fillStyle=`rgba(${v},${v*.72},${v*.48},${.05+rnd()*.12})`; x.fillRect(rnd()*512,rnd()*512,1+rnd()*2,1+rnd()*2); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,12); t.anisotropy=8; return t;
}

const woodMap=makeWoodTexture();
const bowlWoodMap=woodMap.clone();bowlWoodMap.repeat.set(1,1);bowlWoodMap.needsUpdate=true;
const wood = new THREE.MeshStandardMaterial({map:woodMap,roughness:.78,metalness:0,color:0xffffff});
const mdf = wood.clone();
const steel = new THREE.MeshPhysicalMaterial({color:0xdce1e2,metalness:1,roughness:.23,anisotropy:.52,anisotropyRotation:Math.PI/2});
const yellow = new THREE.MeshStandardMaterial({ color:0xe7ad16, roughness:.38 });

const slope = 0.18;
const racePhysicsRate=2;
const layoutSeed=typeof window==='undefined'?(globalThis.__trackSeed??1):visualRaceSeed;
const layoutRandom=raceRandom(layoutSeed);
const curveAmplitude=1.5+layoutRandom()*.25,curveFrequency=1.1+layoutRandom()*.1;
const firstWedgeSide=layoutRandom()<.5?-1:1;
const randomDeckOrder=[1,2,3,4,5];
for(let i=randomDeckOrder.length-1;i>0;i--){const j=Math.floor(layoutRandom()*(i+1));[randomDeckOrder[i],randomDeckOrder[j]]=[randomDeckOrder[j],randomDeckOrder[i]];}
const trackCenterZ = -38;
const trackCenterY = 6;
const trackStartZ = 46;
const extensionStart=-958;
const trackEndZ = -2106;
const trackWidth = 12;
const extensionShape=layoutRandom()<.5?'wide':'long';
const extensionShapeLabel=extensionShape==='wide'?'宽幅长直回环':'加长直道回环';
const extensionModuleIds=['trianglePins','rotorSlalom','serpentineGrooves','splitterWaves'];
for(let i=extensionModuleIds.length-1;i>0;i--){const j=Math.floor(layoutRandom()*(i+1));[extensionModuleIds[i],extensionModuleIds[j]]=[extensionModuleIds[j],extensionModuleIds[i]];}
const extensionModules=extensionModuleIds.map((id,i)=>({id,start:-990-i*260,end:-1210-i*260}));
const openingVariants=['slalom','island','open'];
const openingVariant=openingVariants[layoutSeed%openingVariants.length];
const openingLabels={slalom:'错位导流门',island:'木质分流岛',open:'加速空廊'};
const midRotorStart=layoutRandom()<.5?-588:-807;
function sectionEnvelope(z,start,end){
  if(z>start || z<end)return 0;
  return Math.sin(Math.PI*(start-z)/(start-end))**2;
}
const serpentineLeadIn=14,serpentinePlankHeight=1.695,serpentineWidthScale=1.3;
function serpentineCenter(z,start){
  // A straight carved inlet captures the ball before the continuous 160-degree bends.
  // The alternating circular arcs meet tangentially without a fork or jump.
  const radius=4.2,angle=80*Math.PI/180,halfArc=radius*Math.sin(angle);
  const progress=Math.max(0,start-z-serpentineLeadIn);
  if(progress<=halfArc)return radius*(Math.sqrt(Math.max(0,1-(progress/radius)**2))-Math.cos(angle));
  const remainder=progress-halfArc,index=Math.floor(remainder/(2*halfArc));
  const local=remainder-index*2*halfArc,side=index%2===0?-1:1;
  const sine=Math.sin(angle)-local/radius;
  return side*radius*(Math.sqrt(Math.max(0,1-sine*sine))-Math.cos(angle));
}
function snakeLane(_side,z){return serpentineCenter(z,-482);}
function serpentineDistance(offset,z,start){
  // Measure across the groove's actual curved centerline. A fixed X-width
  // pinches shut where the path turns nearly sideways through the board.
  let nearest=Infinity;
  for(let i=-2;i<2;i++){
    const za=z+i,zb=za+1,xa=serpentineCenter(za,start),xb=serpentineCenter(zb,start);
    const dx=xb-xa,dz=zb-za;
    const t=THREE.MathUtils.clamp(((offset-xa)*dx+(z-za)*dz)/(dx*dx+dz*dz),0,1);
    const distanceX=offset-xa-t*dx,distanceZ=z-za-t*dz;
    nearest=Math.min(nearest,distanceX*distanceX+distanceZ*distanceZ);
  }
  return Math.sqrt(nearest);
}
function serpentineDescent(z,start,end){
  const progress=THREE.MathUtils.clamp(start-z,0,start-end);
  // A single planar grade: S bends are carved sideways into the board,
  // not assembled from individually lowered curved pieces.
  return .04*progress;
}
function raisedSerpentinePlank(z,offset,start,end,height){
  if(z>start+14||z<end)return 0;
  const entry=THREE.MathUtils.smoothstep(start+14-z,0,14);
  const exit=THREE.MathUtils.smoothstep(z-end,0,12);
  const center=z>start?serpentineCenter(start,start)*entry:serpentineCenter(z,start);
  const halfWidth=z>start?THREE.MathUtils.lerp(2.4*serpentineWidthScale,1.02*serpentineWidthScale,entry):1.02*serpentineWidthScale;
  const distance=z>start?Math.abs(offset-center):serpentineDistance(offset,z,start);
  const recess=distance>=halfWidth?0:Math.pow(1-(distance/halfWidth)**2,1.25);
  // The full plank rises; only the smoothly carved center remains at the
  // incoming track's floor level. Entry and exit taper into adjacent boards.
  return height*entry*exit*(1-recess);
}
function surfaceY(z,offset=0){
  let y=trackCenterY+slope*(z-trackCenterZ);
  // Extra gravitational drop on unobstructed runways; smooth ends preserve contact.
  for(const [start,end,baseDrop] of [[46,33,1.5],[-12,-22,1],[-258,-277,2.4],[-1230,-1290,9],[-1710,-1770,9],[-2048,-2075,2]]){
    const t=THREE.MathUtils.clamp((start-z)/(start-end),0,1);
    y-=baseDrop*t*t*(3-2*t);
  }
  // Banked sweep, broad waves and a separate carved serpentine lane.
  // Raise both outer shoulders gently so the opening cannot collect balls
  // against a side rail behind the alternating slalom gates.
  y+=.035*sectionEnvelope(z,14,-15)*offset*offset;
  y+=sectionEnvelope(z,-18,-48)*.035*offset*offset;
  y+=sectionEnvelope(z,-102,-146)*(offset<0
    ?.26*Math.sin((z+102)*.65)
    :.09*(offset-(2.8+Math.sin((z+102)*.3)*1.1))**2);
  // Smoothly descending terraces, with no vertical edge to snag a sphere.
  if(z<-192)y-=.22*(1+Math.tanh((-z-198)*1.2))
    +.22*(1+Math.tanh((-z-207)*1.2))+.22*(1+Math.tanh((-z-216)*1.2));
  // The lower deck is physically below the bowl; balls fall through its real hole.
  if(z<=-246)y-=8;
  if(z<=-354)y-=8;
  y-=serpentineDescent(z,-482,-566);
  y+=raisedSerpentinePlank(z,offset,-482,-566,serpentinePlankHeight);
  y+=sectionEnvelope(z,-680,-726)*.18*Math.sin((-z-680)*.45);
  for(const module of extensionModules){
    if(module.id==='serpentineGrooves'){
      y-=serpentineDescent(z,module.start-42,module.start-190);
      y+=raisedSerpentinePlank(z,offset,module.start-42,module.start-190,serpentinePlankHeight);
    }
    if(module.id==='splitterWaves')y+=sectionEnvelope(z,module.start-35,module.start-190)*.22*Math.sin((module.start-z)*.3);
  }
  // Finish receiver is carved below the board, with a smooth entry and one-ball width.
  if(z<-2078){
    const width=z>-2090?.85+5.5*(z+2090)/12:.85;
    const entry=THREE.MathUtils.smoothstep(-z,2078,2084);
    if(Math.abs(offset)<width)y-=.65*entry*Math.sqrt(Math.max(0,1-(offset/width)**2));
  }
  return y;
}
function trackX(z){
  if(z>18)return 0;
  if(z<-340)return trackX(-340);
  const t=THREE.MathUtils.clamp((18-z)/302,0,1);
  return Math.sin(t*Math.PI*curveFrequency)*curveAmplitude;
}
const extensionOrigin=new THREE.Vector3(trackX(-372)+16,0,-372+(958-394));
const loopReach=extensionShape==='wide'?780:920,loopWidth=extensionShape==='wide'?100:85;
const extensionCurvePoints=[
  new THREE.Vector3(extensionOrigin.x,0,extensionOrigin.z),
  new THREE.Vector3(extensionOrigin.x,0,extensionOrigin.z+270),
  new THREE.Vector3(extensionOrigin.x,0,extensionOrigin.z+loopReach-95),
  new THREE.Vector3(extensionOrigin.x+loopWidth*.22,0,extensionOrigin.z+loopReach),
  new THREE.Vector3(extensionOrigin.x+loopWidth*.78,0,extensionOrigin.z+loopReach),
  new THREE.Vector3(extensionOrigin.x+loopWidth,0,extensionOrigin.z+loopReach-95),
  new THREE.Vector3(extensionOrigin.x+loopWidth,0,extensionOrigin.z+loopReach-420),
  new THREE.Vector3(extensionOrigin.x+loopWidth,0,extensionOrigin.z+loopReach-950)
];
const extensionCurve=new THREE.CatmullRomCurve3(extensionCurvePoints,false,'centripetal');
function routeCenterRaw(z){
  const base=trackX(-372);
  if(z<extensionStart){
    const t=THREE.MathUtils.clamp((extensionStart-z)/(extensionStart-trackEndZ),0,1);
    const p=extensionCurve.getPointAt(t);p.y=surfaceY(z);return p;
  }
  if(z>=-372)return new THREE.Vector3(trackX(z),surfaceY(z),z);
  if(z>=-394){
    const angle=(-z-372)/22*Math.PI;
    return new THREE.Vector3(base+8*(1-Math.cos(angle)),surfaceY(z),-372-8*Math.sin(angle));
  }
  let x=base+16;
  return new THREE.Vector3(x,surfaceY(z),-372+(-z-394));
}
// Mesh generation samples the same stations many times across each board.
// Cache the centerline and hand callers a copy because some vector operations mutate.
const routeCenterCache=new Map();
function routeCenter(z){
  let point=routeCenterCache.get(z);
  if(!point){point=routeCenterRaw(z);routeCenterCache.set(z,point);}
  return point.clone();
}
const extensionSamples=[],extensionBuckets=new Map(),extensionBucketSize=24;
for(let z=extensionStart;z>=trackEndZ;z-=2){
  const p=routeCenter(z),sample={z,p},index=extensionSamples.push(sample)-1;
  const key=`${Math.floor(p.x/extensionBucketSize)},${Math.floor(p.z/extensionBucketSize)}`;
  if(!extensionBuckets.has(key))extensionBuckets.set(key,[]);
  extensionBuckets.get(key).push(index);
}
function extensionParameter(p){
  const cellX=Math.floor(p.x/extensionBucketSize),cellZ=Math.floor(p.z/extensionBucketSize);
  let best=-1,distance=Infinity;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of extensionBuckets.get(`${cellX+dx},${cellZ+dz}`)||[]){
    const q=extensionSamples[i].p,d=(q.x-p.x)**2+(q.y-p.y)**2+(q.z-p.z)**2;
    if(d<distance){distance=d;best=i;}
  }
  if(best<0)return extensionStart;
  let result=extensionSamples[best].z;
  for(const neighbor of [best-1,best+1]){
    if(neighbor<0||neighbor>=extensionSamples.length)continue;
    const a=extensionSamples[Math.min(best,neighbor)],b=extensionSamples[Math.max(best,neighbor)];
    const segment=b.p.clone().sub(a.p),t=THREE.MathUtils.clamp(p.clone().sub(a.p).dot(segment)/segment.lengthSq(),0,1);
    const q=a.p.clone().addScaledVector(segment,t),d=q.distanceToSquared(p);
    if(d<distance){distance=d;result=THREE.MathUtils.lerp(a.z,b.z,t);}
  }
  return result;
}
function tailParameter(p){
  let z=-394-(p.z+372);
  for(let i=0;i<3;i++){
    const center=routeCenter(z),derivative=routeCenter(z+.05).sub(routeCenter(z-.05)).multiplyScalar(10);
    derivative.y=0;
    z+=((p.x-center.x)*derivative.x+(p.z-center.z)*derivative.z)/derivative.lengthSq();
  }
  return z;
}
function routeParameter(p){
  const base=trackX(-372);
  if(p.z>extensionOrigin.z+1||p.x>extensionOrigin.x+13||p.y<surfaceY(extensionStart)-1.5)return extensionParameter(p);
  if(p.y<surfaceY(-410)+1.2)return tailParameter(p);
  if(p.y>surfaceY(-372)+1.2)return p.z;
  if(p.x>base+8 && p.z>=-372)return tailParameter(p);
  if(p.z<=-372){
    const angle=Math.max(0,Math.min(Math.PI,Math.atan2(-p.z-372,base+8-p.x)));
    return -372-angle/Math.PI*22;
  }
  return p.z;
}
const trackFrameCache=new Map();
function trackFrame(z){
  const cached=trackFrameCache.get(z);
  if(cached)return cached;
  const dz=.1;
  const forward=routeCenter(z-dz).sub(routeCenter(z+dz)).normalize();
  const right=new THREE.Vector3(-forward.z,0,forward.x).normalize();
  const frame={forward,right};trackFrameCache.set(z,frame);return frame;
}
function trackPoint(offset,z,lift=0){
  const {right}=trackFrame(z);
  const center=routeCenter(z),actualZ=center.z+right.z*offset;
  // The deck breaks at the bowls must use one common station across its width.
  // Sampling the skewed world Z made part of the lower landing jump up into
  // the bowl as a triangular wooden plate.
  const bowlJoin=(z<=-234&&z>=-260)||(z<=-342&&z>=-368);
  return new THREE.Vector3(center.x+right.x*offset,surfaceY(z<-370||bowlJoin?z:actualZ,offset)+lift,actualZ);
}

function trackQuaternion(z){
  const {right,forward}=trackFrame(z);
  const backward=forward.clone().negate();
  const up=new THREE.Vector3().crossVectors(backward,right).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,backward));
}

function addStaticBox({x=0,y=0,z=0,w,h,d,mat=wood,rx=0,ry=0,rz=0,quat=null,cast=true,impactSound=true}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z);
  if(quat)mesh.quaternion.copy(quat);else mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=cast; mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))}); body.position.set(x,y,z);
  if(quat)body.quaternion.set(quat.x,quat.y,quat.z,quat.w);else body.quaternion.setFromEuler(rx,ry,rz);
  body.soundMaterial=mat.userData.soundMaterial||(mat===steel?'metal':mat===yellow?'plastic':mat===wood?'wood':'mdf');
  body.impactSound=impactSound;
  world.addBody(body); return {mesh,body};
}

function railTop(z){
  const legacy=Math.max(3*sectionEnvelope(z,-478,-570),6.15*THREE.MathUtils.smoothstep(-z,555,575));
  if(z>=extensionStart)return Math.max(5.6,2.35+legacy);
  const a=routeCenter(Math.min(extensionStart,z+2)),b=routeCenter(z),c=routeCenter(Math.max(trackEndZ,z-2));
  const before=new THREE.Vector2(b.x-a.x,b.z-a.z),after=new THREE.Vector2(c.x-b.x,c.z-b.z);
  const turn=Math.abs(Math.atan2(before.x*after.y-before.y*after.x,before.dot(after)));
  return 8.5+Math.min(1,turn/.24);
}
function railVisualTop(){return 2.35;}
const railColliderVertices=[],railColliderIndices=[];
function addTrackSegment(z1,z2){
  for(const side of [-1,1]){
    const base=railColliderVertices.length/3;
    for(const z of [z1,z2]){
      for(const [offset,lift] of [
        [side*5.85,-1.65],[side*5.85,railTop(z)],
        [side*6.31,railTop(z)],[side*6.31,-1.65]
      ]){
        const p=trackPoint(offset,z,lift);
        railColliderVertices.push(p.x,p.y,p.z);
      }
    }
    // Closed four-sided segment; adjacent segments share their edge positions.
    // Combining them in one static collider avoids thousands of startup bodies.
    for(const [a,b,c,d] of [[0,4,1,5],[1,5,2,6],[2,6,3,7],[3,7,0,4]]){
      railColliderIndices.push(base+a,base+b,base+c,base+c,base+b,base+d);
    }
    railColliderIndices.push(base+0,base+1,base+2,base+0,base+2,base+3,
      base+4,base+6,base+5,base+4,base+7,base+6);
  }
}
for(let z=trackStartZ;z>trackEndZ;z-=4){
  const next=Math.max(trackEndZ,z-4);
  if((z>-246&&next<-236)||(z>-354&&next<-344))continue;
  addTrackSegment(z,next);
}
const railCollider=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Trimesh(railColliderVertices,railColliderIndices)});
railCollider.soundMaterial='wood';railCollider.impactSound=false;world.addBody(railCollider);

// One continuous sphere-compatible collision ribbon removes overlapping floor contacts.
const floorVertices=[],floorIndices=[],trackUV=[];
// Denser stations only at the recessed S bends preserve their tight shape
// without quadrupling the mesh for the full two-kilometre course.
const across=30,zStations=[];
for(let z=trackStartZ;z>=trackEndZ;z--){
  zStations.push(z);
  if((z<=-482&&z>-566)||extensionModules.some(m=>m.id==='serpentineGrooves'&&z<=m.start-42&&z>m.start-190)){
    for(let tenth=1;tenth<10;tenth++)zStations.push(z-tenth/10);
  }
}
const along=zStations.length-1;
for(let row=0;row<=along;row++){
  const z=zStations[row];
  for(let col=0;col<=across;col++){
    const p=trackPoint(-trackWidth/2+trackWidth*col/across,z);
    if(z<=-236 && z>-246)p.y-=8;
    if(z<=-344 && z>-354)p.y-=8;
    floorVertices.push(p.x,p.y,p.z);trackUV.push(col/across,row/56);
  }
}
for(let row=0;row<along;row++)for(let col=0;col<across;col++){
  const z=zStations[row];
  // Do not join the upper floor to the lower floor across the drop.
  if(z===-234 || z===-235 || z===-342 || z===-343)continue;
  const i=row*(across+1)+col,j=i+across+1;
  floorIndices.push(i,i+1,j,i+1,j+1,j);
}
const trackGeometry=new THREE.BufferGeometry();
trackGeometry.setAttribute('position',new THREE.Float32BufferAttribute(floorVertices,3));
trackGeometry.setIndex(floorIndices);
trackGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(trackUV,2));trackGeometry.computeVertexNormals();
const ceramic=wood.clone(),rubber=wood.clone(),composite=wood.clone();
const brushed=steel.clone();brushed.roughness=.36;brushed.anisotropy=.72;
brushed.userData.soundMaterial='metal';
for(const material of [ceramic,rubber,composite])material.userData.soundMaterial='wood';
const deckMaterials=[wood,wood,wood,wood,wood,wood];
function deckMaterialIndex(z){
  if(z<-2078)return 1;
  if(z<extensionStart){
    const module=extensionModules.find(m=>z<=m.start&&z>=m.end);
    if(module)return {trianglePins:1,rotorSlalom:4,serpentineGrooves:1,splitterWaves:3}[module.id];
    return 2;
  }
  if(z<-482&&z>-566)return 1;if(z<-610&&z>-674)return 4;
  return z>17?0:z>-48?randomDeckOrder[0]:z>-102?randomDeckOrder[1]:z>-166?randomDeckOrder[2]:z>-232?randomDeckOrder[3]:z>-268?1:z>-303?4:randomDeckOrder[4];
}
let face=0,groupStart=0,groupMaterial=-1;
for(let row=0;row<along;row++){
  const z=zStations[row];
  if(z===-234 || z===-235 || z===-342 || z===-343)continue;
  const material=deckMaterialIndex(z);
  if(material!==groupMaterial){
    if(groupMaterial>=0)trackGeometry.addGroup(groupStart,face-groupStart,groupMaterial);
    groupStart=face;groupMaterial=material;
  }
  face+=across*6;
}
trackGeometry.addGroup(groupStart,face-groupStart,groupMaterial);
const railAlong=Math.round((trackStartZ-trackEndZ)*2);
for(const side of [-1,1]){
  const vertices=[],indices=[],uv=[];
  for(let row=0;row<=railAlong;row++){
    const z=trackStartZ-row*.5;
    for(const lift of [-1.65,railVisualTop(z)])for(const edge of [-.23,.23]){
      const p=trackPoint(side*6.08+edge,z,lift);vertices.push(p.x,p.y,p.z);uv.push(edge+.23,row/40);
    }
  }
  for(let row=0;row<railAlong;row++){
    const z=trackStartZ-row*.5;
    if((z<=-236 && z>-246)||(z<=-344 && z>-354)||z===-234||z===-234.5||z===-235||z===-235.5||z===-342||z===-342.5||z===-343||z===-343.5)continue;
    const a=row*4,b=a+4;
    for(const [i,j,k,l] of [[a,a+2,b,b+2],[a+1,b+1,a+3,b+3],[a+2,a+3,b+2,b+3],[a,b,a+1,b+1]])indices.push(i,j,k,j,l,k);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=wood.clone();material.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='continuous-rail';mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
}
// Every course segment gets the same pale translucent upper safety wall.
// The two bowls remain open at the center, with separate side connectors below.
const fogWallMaterial=new THREE.MeshBasicMaterial({color:0xf7fbff,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide});
function bowlRailBreak(z){return (z<=-234&&z>-246)||(z<=-342&&z>-354);}
for(const side of [-1,1]){
  const vertices=[],indices=[],rows=Math.round((trackStartZ-trackEndZ)*2);
  for(let row=0;row<=rows;row++){
    const z=trackStartZ-row*.5;
    for(const lift of [2.35,railTop(z)]){
      const p=trackPoint(side*5.85,z,lift);vertices.push(p.x,p.y,p.z);
    }
    if(row&&!bowlRailBreak(z)&&!bowlRailBreak(z+.5)){
      const a=(row-1)*2,b=row*2;indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,fogWallMaterial);
  mesh.name='clear-safety-guard';mesh.renderOrder=2;scene.add(mesh);
}
const continuousFloor=new THREE.Mesh(trackGeometry,deckMaterials);continuousFloor.receiveShadow=true;scene.add(continuousFloor);
continuousFloor.name='race-deck';
const floorBody=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Trimesh(floorVertices,floorIndices)});
floorBody.soundMaterial='wood';floorBody.impactSound=false;world.addBody(floorBody);

// Workshop envelope. The elevated decks are self-supporting in the scene:
// no columns rise from a lower course into an upper lane.
const wallMat=new THREE.MeshStandardMaterial({color:0xc9c6bf,roughness:.94});
const roomBottom=-460;
const wall=new THREE.Mesh(new THREE.PlaneGeometry(2600,700),wallMat); wall.position.set(-300,-155,400); wall.rotation.y=Math.PI/2; wall.receiveShadow=true; scene.add(wall);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(800,2400),new THREE.MeshStandardMaterial({color:0x9a7653,roughness:.82})); floor.rotation.x=-Math.PI/2; floor.position.set(0,roomBottom,400); floor.receiveShadow=true; scene.add(floor);

function addPeg(offset,z,r=.28,h=1.6,material=wood){
  const p=trackPoint(offset,z,h/2+.08);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),material); mesh.position.copy(p); mesh.castShadow=mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Cylinder(r,r,h,16)}); body.soundMaterial=material.userData.soundMaterial||'wood';body.impactSound=true;body.position.set(p.x,p.y,p.z); world.addBody(body);
}

function addBarrierBetween(a,b,mat=steel,height=.72,thickness=.34,baseLift=.08){
  const pa=trackPoint(a.offset,a.z,height/2+baseLift), pb=trackPoint(b.offset,b.z,height/2+baseLift);
  const mid=pa.clone().add(pb).multiplyScalar(.5), dir=pb.clone().sub(pa), len=dir.length();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),dir.clone().normalize());
  return addStaticBox({x:mid.x,y:mid.y,z:mid.z,w:len,h:height,d:thickness,mat,quat:q});
}

// Stage 2: a fixed staggered wooden peg maze replaces the former two-ball funnel.
for(let row=0;row<5;row++){
  const z=31-row*3.1,shift=(row%2?1.25:0)+(layoutRandom()-.5)*.12;
  for(let offset=-4.2+shift;offset<=4.3;offset+=2.7)addPeg(offset,z,.23,1.5);
}

// The next opening varies between three clear, physically passable modules.
if(openingVariant==='slalom'){
  for(const [z,side] of [[8,-1],[-1,1],[-9,-1]]){
    addBarrierBetween({offset:side*6.3,z},{offset:side*2.35,z:z-3.5},steel,1.2,.32);
  }
}else if(openingVariant==='island'){
  addPeg(0,5,.75,1.55,ceramic);
  addPeg(-3.15,-5,.38,1.3,ceramic);addPeg(3.15,-5,.38,1.3,ceramic);
}

// Hand-built opening, followed by shuffled groups that remain internally fixed.
const raceSections=[
  {end:32,name:'01 · 宽坡起跑'}, {end:17,name:'02 · 木钉迷阵'},
  {end:-12,name:`03 · ${openingLabels[openingVariant]}`}, {end:-48,name:'04 · 倾斜回转'},
  {end:-76,name:'05 · 三角导流'}, {end:-102,name:'06 · 双路分叉'},
  {end:-146,name:'07 · 波浪与蛇槽'}, {end:-166,name:'08 · 汇流争位'},
  {end:-192,name:'09 · 挡板圆柱'}, {end:-232,name:'10 · 落阶回廊'},
  {end:-258,name:'11 · 落孔漏斗碗'}, {end:-279,name:'12 · 下层双球窄桥'},
  {end:-303,name:'13 · 金属弯道'}, {end:-327,name:'14 · 摆门与转轮'},
  {end:-340,name:'15 · 双路汇流'}, {end:-368,name:'16 · 木质落孔碗'},
  {end:-372,name:'17 · 下层加速'}, {end:-394,name:'18 · U 形回转'},
  {end:-440,name:'19 · 折返长坡'}, {end:-482,name:'20 · 分流加速'},
  {end:-566,name:'21 · 抬板连续S形木槽'}, {end:-608,name:midRotorStart===-588?'22 · 双列旋杆阵列':'22 · 木质缓冲道'},
  {end:-674,name:'23 · 金属加速直道'}, {end:-726,name:'24 · 双路波浪坡'},
  {end:-780,name:'25 · 长直竞速'}, {end:-864,name:midRotorStart===-807?'26 · 双列旋杆阵列':'26 · 长直追逐'},
  {end:-914,name:'27 · 三连收口'}, {end:-958,name:'28 · 彩柱迷阵'},
  {end:-990,name:`29 · ${extensionShapeLabel}入口`},
  ...extensionModules.flatMap((module,i)=>[
    {end:module.start-105,name:`${30+i*2} · ${({trianglePins:'三列几何乱石阵',rotorSlalom:'双列旋杆阵列',serpentineGrooves:'抬板连续S形槽',splitterWaves:'分流波浪与交错挡板'})[module.id]}`},
    {end:module.end,name:`${31+i*2} · ${({trianglePins:'三列异形高障碍',rotorSlalom:'玻璃金属交叉漏斗',serpentineGrooves:'S槽后程争位',splitterWaves:'双道汇流争位'})[module.id]}`}
  ]),
  {end:-2078,name:'38 · 加速拨杆冲刺'}, {end:trackEndZ,name:'39 · 终点排次槽'}
];
function addTriangleWedge(z,side,material=wood){
  // Triangular wooden wedges have a sloping face and no upstream pocket.
  const points=[trackPoint(side*6.8,z,0),trackPoint(side*.6,z-8,0),trackPoint(side*6.8,z-8,0)];
  const v=[];for(const lift of [-.25,1.6])for(const p of points)v.push(p.x,p.y+lift,p.z);
  const indices=[0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5];
  const center=new THREE.Vector3();for(let i=0;i<v.length;i+=3)center.add(new THREE.Vector3(...v.slice(i,i+3)));center.multiplyScalar(1/6);
  for(let i=0;i<indices.length;i+=3){
    const a=new THREE.Vector3(...v.slice(indices[i]*3,indices[i]*3+3)),b=new THREE.Vector3(...v.slice(indices[i+1]*3,indices[i+1]*3+3)),c=new THREE.Vector3(...v.slice(indices[i+2]*3,indices[i+2]*3+3));
    if(b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(center))<0)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  }
  let geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  // The buried bottom is omitted from rendering, so it cannot fight the deck depth.
  geometry.setIndex(indices.slice(3));geometry=geometry.toNonIndexed();geometry.computeVertexNormals();
  const uv=[];const pos=geometry.attributes.position,norm=geometry.attributes.normal;
  for(let i=0;i<pos.count;i++){const n=Math.abs(norm.getY(i));uv.push((Math.abs(norm.getX(i))>Math.abs(norm.getZ(i))?pos.getZ(i):pos.getX(i))/6,(n>.5?pos.getZ(i):pos.getY(i))/6);}
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
  mesh.name='triangle-guide';
  const wedgeBody=new CANNON.Body({mass:0,shape:new CANNON.Convex(v)});wedgeBody.soundMaterial=material.userData.soundMaterial||'wood';wedgeBody.impactSound=true;world.addBody(wedgeBody);
}
function addFootprintPrism(footprint,height,material=wood,name='wood-obstacle'){
  const count=footprint.length,vertices=[];
  for(const lift of [-.18,height])for(const [offset,z] of footprint){
    const p=trackPoint(offset,z,lift);vertices.push(p.x,p.y,p.z);
  }
  const faces=[];
  for(let i=1;i<count-1;i++)faces.push(count,count+i,count+i+1);
  for(let i=0;i<count;i++){const next=(i+1)%count;faces.push(i,next,count+next,i,count+next,count+i);}
  const center=new THREE.Vector3();for(let i=0;i<vertices.length;i+=3)center.add(new THREE.Vector3(...vertices.slice(i,i+3)));center.multiplyScalar(1/(count*2));
  for(let i=0;i<faces.length;i+=3){
    const a=new THREE.Vector3(...vertices.slice(faces[i]*3,faces[i]*3+3));
    const b=new THREE.Vector3(...vertices.slice(faces[i+1]*3,faces[i+1]*3+3));
    const c=new THREE.Vector3(...vertices.slice(faces[i+2]*3,faces[i+2]*3+3));
    if(b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(center))<0)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
  }
  let geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(faces);
  geometry=geometry.toNonIndexed();geometry.computeVertexNormals();
  const uv=[],position=geometry.attributes.position;
  for(let i=0;i<position.count;i++)uv.push(position.getX(i)/5,position.getZ(i)/5);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Convex(vertices)});body.soundMaterial=material.userData.soundMaterial||'wood';body.impactSound=true;world.addBody(body);
  return mesh;
}
function addSerpentineEntrance(start){
  // Two shallow guide faces funnel into one carved mouth; the S itself is
  // uninterrupted wood, with no central divider or raised groove edges.
  const mouth=serpentineCenter(start,start),guideThickness=.28;
  const openingHalf=1.2*(2*.55)/2,railCenterHalf=openingHalf+guideThickness/2;
  addBarrierBetween({offset:-5.8,z:start+14},{offset:mouth-railCenterHalf,z:start},wood,1.05,guideThickness);
  addBarrierBetween({offset:5.8,z:start+14},{offset:mouth+railCenterHalf,z:start},wood,1.05,guideThickness);
}
for(const [z,side] of [[-51,firstWedgeSide],[-64,-firstWedgeSide],[-2048,-1]])addTriangleWedge(z,side);
// A central splitter gives two lanes; unequal peg layouts provide different routes.
for(let z=-78;z>-144;z-=2)addBarrierBetween({offset:0,z},{offset:0,z:z-2},wood,1.35,.3);
for(const [x,z] of [[-2.6,-84],[-4,-93],[2.5,-88],[4,-97]])addPeg(x+(layoutRandom()-.5)*.2,z,.38,1.4);
addBarrierBetween({offset:-6.7,z:-147},{offset:-1.8,z:-157},steel,1.5,.36);
addBarrierBetween({offset:6.7,z:-147},{offset:1.8,z:-157},steel,1.5,.36);
const orange=new THREE.MeshStandardMaterial({color:0xd95128,roughness:.48});
orange.userData.soundMaterial='plastic';
for(const [z,side] of [[-168,-1],[-179,1]]){
  addBarrierBetween({offset:side*6.7,z},{offset:side*2,z:z-5},orange,1.4,.4);
  addPeg(0,z-6,.5,1.5);
}
for(const [offset,z] of [[-3,-223],[3,-228]])addPeg(offset,z,.35,1.4);
// Funnel bowl has an actual mesh opening, a collision-lined neck and a lower landing.
const bowl={x:trackX(-246),z:-246,radius:12,hole:1.55,rimY:surfaceY(-234),inletEndZ:-233.5};
const bowlEntranceHalfWidth=5.85;
const bowlEntranceSin=Math.sqrt(1-(bowlEntranceHalfWidth/bowl.radius)**2);
function addFunnelBowl(bowl,material){
const bv=[],bi=[],buv=[],rings=32,slices=128;
for(let ring=0;ring<=rings;ring++){
  const r=bowl.hole+(bowl.radius-bowl.hole)*ring/rings;
  const y=bowl.rimY-4.5*(1-ring/rings);
  for(let j=0;j<=slices;j++){
    const angle=j/slices*Math.PI*2;
    bv.push(bowl.x+Math.cos(angle)*r,y,bowl.z+Math.sin(angle)*r);
    buv.push(.5+Math.cos(angle)*r/24,.5+Math.sin(angle)*r/24);
  }
}
for(let ring=0;ring<rings;ring++)for(let j=0;j<slices;j++){
  const a=ring*(slices+1)+j,b=a+slices+1;bi.push(a,a+1,b,a+1,b+1,b);
}
// Vertical outer wall and neck; the center stays completely open.
for(const [radius,top,bottom] of [[12,bowl.rimY+4,bowl.rimY],[bowl.hole,bowl.rimY-4.5,surfaceY(bowl.z)+1.7]]){
  const start=bv.length/3;
  for(const y of [bottom,top])for(let j=0;j<=slices;j++){
    const angle=j/slices*Math.PI*2;bv.push(bowl.x+Math.cos(angle)*radius,y,bowl.z+Math.sin(angle)*radius);buv.push(j/slices,y/10);
  }
  for(let j=0;j<slices;j++){if(radius===12 && Math.sin((j+.5)/slices*Math.PI*2)>bowlEntranceSin)continue;const a=start+j,b=a+slices+1;bi.push(a,b,a+1,b,b+1,a+1);}
}
const bowlGeo=new THREE.BufferGeometry();bowlGeo.setAttribute('position',new THREE.Float32BufferAttribute(bv,3));bowlGeo.setAttribute('uv',new THREE.Float32BufferAttribute(buv,2));bowlGeo.setIndex(bi);bowlGeo.computeVertexNormals();
const bowlMat=material.clone();bowlMat.side=THREE.DoubleSide;
const bowlTexture=material===wood?bowlWoodMap:null;if(bowlTexture){bowlMat.map=bowlTexture;bowlMat.bumpMap=bowlTexture;bowlMat.bumpScale=.012;}
const bowlMesh=new THREE.Mesh(bowlGeo,bowlMat);bowlMesh.castShadow=bowlMesh.receiveShadow=true;scene.add(bowlMesh);
bowlMesh.name=`funnel-bowl-${bowl.z}`;
  const bowlBody=new CANNON.Body({mass:0,shape:new CANNON.Trimesh(bv,bi)});bowlBody.soundMaterial=material===wood?'wood':'metal';bowlBody.impactSound=false;world.addBody(bowlBody);
}
function addBowlFogGuard(bowl){
  // The wooden bowl wall grows two short arms to meet the inlet rails; only
  // its upper mist guard remains transparent. The center stays open.
  const vertices=[],indices=[],slices=128,upper=bowl.rimY+6.2,lower=bowl.rimY+3.98;
  for(let j=0;j<slices;j++){
    const mid=(j+.5)/slices*Math.PI*2;
    if(Math.sin(mid)>bowlEntranceSin)continue;
    const a=j/slices*Math.PI*2,b=(j+1)/slices*Math.PI*2,base=vertices.length/3;
    for(const angle of [a,b])for(const y of [lower,upper])vertices.push(bowl.x+Math.cos(angle)*bowl.radius,y,bowl.z+Math.sin(angle)*bowl.radius);
    indices.push(base,base+1,base+2,base+1,base+3,base+2);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,fogWallMaterial);mesh.name='bowl-fog-guard';mesh.renderOrder=2;scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Trimesh(vertices,indices)});
  body.soundMaterial='glass';body.impactSound=false;world.addBody(body);
  const armMaterial=wood.clone();armMaterial.side=THREE.DoubleSide;
  for(const side of [-1,1]){
    const approach=trackPoint(side*2.6,bowl.inletEndZ);
    const rim=new THREE.Vector3(bowl.x+side*bowlEntranceHalfWidth,bowl.rimY,bowl.z+Math.sqrt(bowl.radius**2-bowlEntranceHalfWidth**2));
    const direction=rim.clone().sub(approach);direction.y=0;
    const cross=new THREE.Vector3(-direction.z,0,direction.x).normalize().multiplyScalar(.19);
    const woodVertices=[],woodUV=[];
    for(const [point,bottom,top] of [[approach,approach.y-1.65,approach.y+2.35],[rim,rim.y,rim.y+4]]){
      for(const flank of [-1,1])for(const [level,y] of [[0,bottom],[1,top]]){
        woodVertices.push(point.x+cross.x*flank,y,point.z+cross.z*flank);
        woodUV.push(point===approach?0:1,level);
      }
    }
    const woodIndices=[0,4,1,1,4,5,2,3,6,3,7,6,0,2,4,2,6,4,
      1,5,3,3,5,7,0,1,2,1,3,2,4,6,5,5,6,7];
    const woodGeometry=new THREE.BufferGeometry();woodGeometry.setAttribute('position',new THREE.Float32BufferAttribute(woodVertices,3));
    woodGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(woodUV,2));woodGeometry.setIndex(woodIndices);woodGeometry.computeVertexNormals();
    const woodArm=new THREE.Mesh(woodGeometry,armMaterial);woodArm.name='bowl-wood-wall-extension';woodArm.castShadow=woodArm.receiveShadow=true;scene.add(woodArm);
    const panelVertices=[approach.x,approach.y+2.35,approach.z,rim.x,rim.y+4,rim.z,
      approach.x,approach.y+5.6,approach.z,rim.x,rim.y+6.2,rim.z];
    const panelGeometry=new THREE.BufferGeometry();panelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(panelVertices,3));panelGeometry.setIndex([0,1,2,1,3,2]);panelGeometry.computeVertexNormals();
    const panel=new THREE.Mesh(panelGeometry,fogWallMaterial);panel.name='bowl-entry-fog-connector';panel.renderOrder=2;scene.add(panel);
    const midpoint=approach.clone().add(rim).multiplyScalar(.5),quat=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),direction.clone().normalize());
    const connector=addStaticBox({x:midpoint.x,y:midpoint.y+2.85,z:midpoint.z,w:direction.length()+.25,h:6.7,d:.25,quat,impactSound:false});
    connector.mesh.visible=false;
  }
}
addFunnelBowl(bowl,wood);
addBowlFogGuard(bowl);
// Carry the approach deck on columns placed before the bowl. Nothing rises
// through its basin or the central drop opening.
for(const z of [-211,-225])for(const side of [-1,1]){
  const top=trackPoint(side*5.2,z).y-.45,bottom=roomBottom+.6;
  const support=new THREE.Mesh(new THREE.BoxGeometry(.85,top-bottom,.85),wood);
  support.position.set(trackPoint(side*5.2,z).x,(top+bottom)/2,trackPoint(side*5.2,z).z);
  support.name='upstream-deck-support';support.castShadow=support.receiveShadow=true;scene.add(support);
}
const secondBowl={x:trackX(-354),z:-354,radius:12,hole:1.55,rimY:surfaceY(-342),inletEndZ:-343};
addFunnelBowl(secondBowl,wood);
addBowlFogGuard(secondBowl);
for(const side of [-1,1]){
  addBarrierBetween({offset:side*6.7,z:-334},{offset:side*2.6,z:-343},wood,2,.4);
  const p=trackPoint(side*6.05,-349);p.y-=8;
  addStaticBox({x:p.x,y:p.y+1,z:p.z,w:.45,h:3.5,d:12,mat:wood,rx:Math.atan(slope),impactSound:false});
}
const secondBack=trackPoint(0,-340.6);secondBack.y-=8;
addStaticBox({x:secondBack.x,y:secondBack.y+1.5,z:secondBack.z,w:12.6,h:4,d:.4,mat:wood,impactSound:false});
for(const side of [-1,1]){
  addBarrierBetween({offset:side*6.7,z:-226},{offset:side*2.6,z:-233.5},wood,2,.4);
  addBarrierBetween({offset:side*3,z:-261},{offset:side*1.5,z:-265},brushed,1.6,.3);
  for(let z=-265;z>-285;z-=2)addBarrierBetween({offset:side*1.5,z},{offset:side*1.5,z:z-2},brushed,1.6,.3);
}

// Lower metal chicane, then independent paths merging into the final runway.
for(const [z,side] of [[-284,-1],[-295,1]])addBarrierBetween({offset:side*6.7,z},{offset:side*1,z:z-6},brushed,1.6,.38);
for(let z=-328;z>-340;z-=2)addBarrierBetween({offset:0,z},{offset:0,z:z-2},composite,1.4,.3);
for(const [x,z] of [[-3,-331],[3,-336]])addPeg(x,z,.35,1.3);
// Passive mechanisms are moved by impacts, without motors or timed animation.
const movingObstacles=[];
function addPassiveArm(offset,z,width,material,hingedAtEnd){
  const pivot=trackPoint(offset,z,.8);
  const body=new CANNON.Body({mass:.006,shape:new CANNON.Box(new CANNON.Vec3(width/2,.65,.12)),angularDamping:.45,linearDamping:.05});
  body.position.copy(pivot);if(hingedAtEnd)body.position.x+=width/2;
  body.soundMaterial=material===wood?'wood':'plastic';body.impactSound=true;world.addBody(body);
  const anchor=new CANNON.Body({mass:0,shape:new CANNON.Sphere(.035)});anchor.position.copy(pivot);world.addBody(anchor);
  const joint=world.addRevolute(anchor,body,pivot,new CANNON.Vec3(0,1,0));
  if(hingedAtEnd)joint.setLimits(-1.35,1.35);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,1.3,.24),material);mesh.position.copy(body.position);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
  movingObstacles.push({body,mesh,start:body.position.clone()});
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.7,16),steel);axle.position.copy(pivot);axle.castShadow=true;scene.add(axle);
}
addBarrierBetween({offset:-6.7,z:-304},{offset:-3.1,z:-308},brushed,1.5,.35);
addPassiveArm(-3.8,-310,2.2,wood,true);
addBarrierBetween({offset:-6.7,z:-313},{offset:-1.8,z:-319},composite,1.5,.35);
addPassiveArm(2.2,-324,2.2,orange,false);

// Finish sensor and catch box.
// Serpentine channels are carved into raised planks by surfaceY.
// A sealed outer funnel and central splitter feed both carved mouths.
addSerpentineEntrance(-482);
for(let z=-684;z>-724;z-=2)addBarrierBetween({offset:0,z},{offset:0,z:z-2},composite,1.3,.28);
function addDrivenArm(offset,z,width,rate,material,height=1.1,lift=.72){
  const body=new CANNON.Body({mass:0,kinematic:true,spinRate:rate,spinPhase:layoutRandom()*Math.PI*2,shape:new CANNON.Box(new CANNON.Vec3(width/2,height/2,.14))});
  body.position.copy(trackPoint(offset,z,lift));body.soundMaterial='metal';body.impactSound=true;world.addBody(body);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.28),material);mesh.position.copy(body.position);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
  movingObstacles.push({body,mesh,start:body.position.clone(),driven:true});
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,1.65,16),steel);axle.position.copy(body.position);scene.add(axle);
}
function addRotorGrid(startZ){
  for(let row=0;row<4;row++)for(const column of [-1,1]){
    const z=startZ-row*9;
    addDrivenArm(column*2.55,z,3.35,(row+Math.max(0,column))%2?.95:-.95,brushed,.68,.72);
    movingObstacles[movingObstacles.length-1].mesh.name='rotating-rod-array-arm';
  }
}
// One extra grid shifts between two safe positions each generated course.
addRotorGrid(midRotorStart);
for(const [z,side] of [[-876,-1],[-891,1],[-906,-1]])addBarrierBetween({offset:side*6.7,z},{offset:side*1.7,z:z-7},composite,1.5,.35);
for(let row=0;row<7;row++)for(const offset of [-3.4,0,3.4])addPeg(offset+(row%2?.75:0),-922-row*4.3,.25,1.4,[orange,ceramic,composite][row%3]);
const glassTube=new THREE.MeshPhysicalMaterial({color:0xc9e4dc,metalness:0,roughness:.11,transmission:.68,thickness:.25,transparent:true,opacity:.72,depthWrite:false});
glassTube.userData.soundMaterial='glass';
function addTubeBetween(a,b,material,radius=.17){
  const pa=trackPoint(a.offset,a.z,.66),pb=trackPoint(b.offset,b.z,.66);
  const direction=pb.clone().sub(pa),length=direction.length();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,10),material);
  mesh.position.copy(pa).add(pb).multiplyScalar(.5);mesh.quaternion.copy(q);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='long-tube-rail';scene.add(mesh);
  const body=new CANNON.Body({mass:0,material:trackMaterial,shape:new CANNON.Cylinder(radius,radius,length,10)});
  body.position.copy(mesh.position);body.quaternion.set(q.x,q.y,q.z,q.w);body.soundMaterial=material.userData.soundMaterial||'metal';body.impactSound=true;world.addBody(body);
}
function addTubeGuide(fromOffset,toOffset,fromZ,toZ,material){
  const steps=Math.max(1,Math.ceil((fromZ-toZ)/3));
  for(let i=0;i<steps;i++){
    const a=i/steps,b=(i+1)/steps;
    addTubeBetween({offset:THREE.MathUtils.lerp(fromOffset,toOffset,a),z:THREE.MathUtils.lerp(fromZ,toZ,a)},
      {offset:THREE.MathUtils.lerp(fromOffset,toOffset,b),z:THREE.MathUtils.lerp(fromZ,toZ,b)},material,.17);
  }
}
// Random order, fixed internal combinations. Open joins keep each inlet clear.
for(const module of extensionModules){
  const s=module.start;
  if(module.id==='trianglePins'){
    // Three staggered columns. Each upright block is at least two marble
    // diameters high, but every lateral gap remains wider than a marble.
    for(let row=0;row<6;row++)for(let column=0;column<3;column++){
      const z=s-35-row*27+(column-1)*4;
      const offset=[-3.65,0,3.65][column]+(layoutRandom()-.5)*.2;
      const width=.54+layoutRandom()*.1,depth=1.25+layoutRandom()*.35;
      let footprint;
      if((row+column)%3===0)footprint=[[offset,z+depth],[offset+width,z-depth],[offset-width,z-depth]];
      else if((row+column)%3===1)footprint=[[offset-width*.32,z+depth],[offset+width*.32,z+depth],[offset+width,z-depth],[offset-width,z-depth]];
      else footprint=[[offset,z+depth],[offset+width*.7,z+depth*.2],[offset+width*.55,z-depth],[offset-width*.55,z-depth],[offset-width*.7,z+depth*.2]];
      addFootprintPrism(footprint,2.24+layoutRandom()*.28,wood,'irregular-geometric-obstacle');
    }
  }else if(module.id==='rotorSlalom'){
    addRotorGrid(s-31);
    for(let funnel=0;funnel<3;funnel++){
      const entry=s-105-funnel*42;
      for(const side of [-1,1]){
        const material=(funnel+(side>0?1:0))%2?glassTube:steel;
        addTubeGuide(side*6.05,side*1.68,entry,entry-10,material);
        addTubeGuide(side*1.68,side*1.68,entry-10,entry-15,material);
        addTubeGuide(side*1.68,side*6.05,entry-15,entry-28,material);
      }
    }
  }else if(module.id==='serpentineGrooves'){
    for(const offset of [-3.4,3.4])addPeg(offset,s-19,.38,.8,wood);
    addSerpentineEntrance(s-42);
  }else{
    for(let z=s-40;z>s-145;z-=3)addBarrierBetween({offset:0,z},{offset:0,z:z-3},rubber,1.25,.28);
    for(const [offset,z] of [[-4,s-62],[4,s-88],[-4,s-115],[4,s-137]])addPeg(offset,z,.35,1.4,orange);
    addBarrierBetween({offset:-6.3,z:s-150},{offset:-1.4,z:s-170},rubber,1.25,.3);
    addBarrierBetween({offset:6.3,z:s-150},{offset:1.4,z:s-170},rubber,1.25,.3);
  }
}
// The final four rows end well upstream of the receiver's broad mouth.
addRotorGrid(-1993);
const finishZ=-2090;
const finishReceiver={start:-2078,throat:finishZ,end:-2104,halfWidth:.65,slotSpacing:1.11,firstSlot:-2103.35};
for(const side of [-1,1]){
  const funnel=addBarrierBetween({offset:side*6.35,z:finishReceiver.start},{offset:side*.9,z:finishZ},wood,3.2,.5);
  funnel.mesh.name='finish-funnel-guide';funnel.body.impactSound=false;
  const channel=addBarrierBetween({offset:side*.9,z:finishZ},{offset:side*.9,z:finishReceiver.end},wood,2.05,.5,-.8);
  channel.mesh.name='finish-ranking-channel';channel.body.impactSound=false;
  channel.body.collider.setRestitution(.03);
}
const finishStop=addBarrierBetween({offset:-6.35,z:finishReceiver.end},{offset:6.35,z:finishReceiver.end},wood,4,.65,-.8);
finishStop.mesh.name='finish-receiver-stop';finishStop.body.impactSound=false;finishStop.body.collider.setRestitution(.02);
// A continuous clear canopy starts before the funnel and descends smoothly.
// It prevents hopping over the queue without a blocking lip at the narrow mouth.
const coverVertices=[],coverIndices=[];
for(let row=0;row<=30;row++){
  const z=finishReceiver.start+4-row,width=z>=finishReceiver.start?6.35:z>=finishZ?.65+5.7*(z-finishZ)/(finishReceiver.start-finishZ):.65;
  const clearance=1.32+2.4*(1-THREE.MathUtils.smoothstep(-z,-finishReceiver.start-4,-finishZ));
  const highestFloor=Math.max(surfaceY(z,0),surfaceY(z,width),surfaceY(z,-width));
  for(const offset of [-width,width]){const p=trackPoint(offset,z);p.y=highestFloor+clearance;coverVertices.push(p.x,p.y,p.z);}
  if(row){const a=(row-1)*2,b=row*2;coverIndices.push(a,b,a+1,a+1,b,b+1);}
}
const coverGeometry=new THREE.BufferGeometry();coverGeometry.setAttribute('position',new THREE.Float32BufferAttribute(coverVertices,3));coverGeometry.setIndex(coverIndices);coverGeometry.computeVertexNormals();
const receiverCover=new THREE.Mesh(coverGeometry,new THREE.MeshPhysicalMaterial({color:0xf1fbff,transparent:true,opacity:.08,roughness:.10,metalness:0,depthWrite:false,side:THREE.DoubleSide}));
receiverCover.name='finish-receiver-clear-cover';scene.add(receiverCover);
const coverBody=new CANNON.Body({mass:0,shape:new CANNON.Trimesh(coverVertices,coverIndices)});coverBody.soundMaterial='glass';coverBody.impactSound=false;world.addBody(coverBody);coverBody.collider.setRestitution(.02);
// Scope speed-sensitive surface variation to the carved channels; outer rails stay physical.
world.channelEscapeProfile=position=>sectionEnvelope(routeParameter(position),-482,-566);
world.channelGuide=position=>{
  const z=routeParameter(position);
  const extension=extensionModules.find(module=>module.id==='serpentineGrooves'&&z<=module.start-42&&z>=module.start-190);
  const start=extension?extension.start-42:z<=-482&&z>=-566?-482:null;
  if(start===null)return null;
  const center=serpentineCenter(z,start),point=trackPoint(center,z);
  const lateral=position.clone().sub(point).dot(trackFrame(z).right);
  if(Math.abs(lateral)>1.6*serpentineWidthScale)return null;
  const ahead=trackPoint(serpentineCenter(z-.3,start),z-.3);
  const behind=trackPoint(serpentineCenter(z+.3,start),z+.3);
  const tangent=ahead.sub(behind);tangent.y=0;tangent.normalize();
  const toward=point.sub(position);toward.y=0;
  // Approximate the contact reaction of the carved wall at this mesh scale.
  return tangent.multiplyScalar(7).addScaledVector(toward,12);
};

// Starting gate.
const startMark=new THREE.Mesh(new THREE.BoxGeometry(10.8,.016,.12),new THREE.MeshStandardMaterial({color:0xeae5d4,roughness:.6}));
startMark.position.copy(trackPoint(0,40,.03));startMark.quaternion.copy(trackQuaternion(40));scene.add(startMark);
const gate=addBarrierBetween({offset:-5.65,z:36},{offset:5.65,z:36},steel,1.5,.42);
gate.body.impactSound=false;
let gateActive=true;

const marbleDefs=[
  ['青岚',0x20c4c9,'glass'],['紫罗',0x9d4bd2,'glass'],['星渊',0x342277,'stars'],['银河',0x4779cf,'galaxy'],
  ['烈焰',0xe44324,'fire'],['甜旋',0xff4f91,'candy'],['金辉',0xe5b51d,'metal'],['翠羽',0x38b97c,'glass']
];
const marbles=[];
const finishOrder=[];
// Inked numbers sit on the surrounding plank; they do not overlap the carved groove.
for(let rank=1;rank<=8;rank++){
  const labelCanvas=document.createElement('canvas');labelCanvas.width=labelCanvas.height=128;
  const ink=labelCanvas.getContext('2d');ink.fillStyle='#332820';ink.font='bold 88px Georgia';ink.textAlign='center';ink.textBaseline='middle';ink.fillText(String(rank),64,67);
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.05),new THREE.MeshStandardMaterial({map:labelTexture,transparent:true,depthWrite:false,roughness:.85,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  const z=finishReceiver.firstSlot+(rank-1)*finishReceiver.slotSpacing;
  label.position.copy(trackPoint(1.8,z,.025));label.quaternion.copy(trackQuaternion(z)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
  label.name=`finish-rank-${rank}`;scene.add(label);
}

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

function marblePreview(color,style,material){
  // Draw the same source pattern used by the 3D material onto a small shaded sphere.
  // Canvas 2D avoids an extra WebGL renderer or a GPU readback during page load.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const x=canvas.getContext('2d'),radius=43,cx=48,cy=48;
  const red=color>>16&255,green=color>>8&255,blue=color&255;
  x.save();x.beginPath();x.arc(cx,cy,radius,0,Math.PI*2);x.clip();
  if(material.map?.image){
    const source=material.map.image;
    for(let px=-radius;px<radius;px+=2){
      const longitude=Math.asin(Math.max(-1,Math.min(1,(px+1)/radius)));
      const sx=Math.max(0,Math.min(source.width-2,(0.5+longitude/(Math.PI*2))*source.width));
      x.drawImage(source,sx,0,Math.max(2,source.width/180),source.height,cx+px,cy-radius,2,radius*2);
    }
  }else{
    const base=x.createRadialGradient(29,24,4,53,55,58);
    base.addColorStop(0,`rgb(${Math.min(255,red+92)},${Math.min(255,green+92)},${Math.min(255,blue+92)})`);
    base.addColorStop(.33,`rgb(${red},${green},${blue})`);
    base.addColorStop(.76,`rgb(${Math.round(red*.65)},${Math.round(green*.65)},${Math.round(blue*.65)})`);
    base.addColorStop(1,`rgb(${Math.round(red*.25)},${Math.round(green*.25)},${Math.round(blue*.25)})`);
    x.fillStyle=base;x.fillRect(0,0,96,96);
    if(style==='glass'){
      x.strokeStyle='rgba(245,255,255,.34)';x.lineWidth=6;x.beginPath();x.arc(48,49,33,.9,2.9);x.stroke();
    }
  }
  const shade=x.createRadialGradient(34,28,5,49,50,51);
  shade.addColorStop(0,'rgba(255,255,255,.46)');shade.addColorStop(.27,'rgba(255,255,255,.06)');
  shade.addColorStop(.7,'rgba(8,10,19,.07)');shade.addColorStop(1,'rgba(3,5,12,.68)');
  x.fillStyle=shade;x.fillRect(0,0,96,96);
  x.fillStyle='rgba(255,255,255,.74)';x.beginPath();x.ellipse(32,26,12,6,-.45,0,Math.PI*2);x.fill();
  x.fillStyle='rgba(255,255,255,.28)';x.beginPath();x.ellipse(62,67,11,4,-.45,0,Math.PI*2);x.fill();
  x.restore();
  x.strokeStyle='rgba(255,255,255,.31)';x.lineWidth=1.2;x.beginPath();x.arc(cx,cy,radius-.7,0,Math.PI*2);x.stroke();
  return canvas.toDataURL('image/png');
}

function createMarble([nameKey,color,style],i){
  const name=racerName(nameKey);
  const mat=makeMarbleMaterial(color,style);
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.55,48,32),mat); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  const body=new CANNON.Body({mass:.09,material:marblePhysicsMaterial,shape:new CANNON.Sphere(.55),linearDamping:.006,angularDamping:.012,allowSleep:false});
  body.soundMaterial='glass';body.soundIndex=i;
  body.addEventListener('collide',event=>{
    const material=impactMaterialFor(event.body,i);
    if(material)playImpact(event.contact.getImpactVelocityAlongNormal(),material);
  });
  world.addBody(body);
  const m={name,nameKey,color,mesh,body,preview:marblePreview(color,style,mat),index:i,finished:false,failed:false,finishTime:null,failureReason:''}; marbles.push(m); return m;
}
marbleDefs.forEach(createMarble);

const initialOrder=[-4.15,-2.95,-1.75,-.55,.65,1.85,3.05,4.25];
function resetMarbles(){
  world.raceRandom=raceRandom(crypto.getRandomValues(new Uint32Array(1))[0]);
  marbles.forEach((m,i)=>{
    const variation=startVariation(world.raceRandom);
    const z=40,p=trackPoint(initialOrder[i]+variation.lateral,z,.82);
    m.body.position.set(p.x,p.y,p.z); m.body.velocity.setZero(); m.body.angularVelocity.setZero();
    m.body.quaternion.set(0,0,0,1); m.body.wakeUp(); m.finished=false;m.failed=false;m.finishTime=null;m.failureReason='';
    m.body.raceVariation=true; m.body.lastVariationAt=-1;
    m.body.collider.setFriction(world.friction); m.body.collider.setRestitution(world.restitution);
  });
  finishOrder.length=0;
  for(const obstacle of movingObstacles){
    obstacle.body.position.copy(obstacle.start);obstacle.body.quaternion.set(0,0,0,1);
    if(obstacle.driven){obstacle.body.spinAngle=obstacle.body.spinPhase;obstacle.body.quaternion.set(0,Math.sin(obstacle.body.spinPhase/2),0,Math.cos(obstacle.body.spinPhase/2));}
    obstacle.body.velocity.setZero();obstacle.body.angularVelocity.setZero();obstacle.body.wakeUp();
    obstacle.mesh.position.copy(obstacle.start);obstacle.mesh.quaternion.copy(obstacle.body.quaternion);
  }
}
resetMarbles();

const rankList=document.querySelector('#rankList');
const focusSelect=document.querySelector('#focusSelect');
const focusCard=document.querySelector('.focus-card'),focusPickerPanel=document.querySelector('#focusPickerPanel'),focusChoiceRows=new Map();
marbles.forEach((m,i)=>{
  const o=document.createElement('option');o.value=i;o.textContent=m.name;focusSelect.append(o);
  const button=document.createElement('button');button.type='button';button.className='focus-choice';button.setAttribute('role','option');button.setAttribute('aria-selected','false');
  const ball=document.createElement('span');ball.className='focus-choice-ball marble-preview';ball.style.backgroundImage=`url("${m.preview}")`;
  const name=document.createElement('strong');name.textContent=m.name;
  const speed=document.createElement('span');speed.className='focus-choice-speed';speed.textContent='0.0 m/s';
  button.append(ball,name,speed);button.addEventListener('click',event=>{event.stopPropagation();focusLocked=true;focusSelect.value=String(m.index);focusSelect.dispatchEvent(new Event('change'));cameraMode.value='follow';cameraMode.dispatchEvent(new Event('change'));});
  focusPickerPanel.append(button);focusChoiceRows.set(m.index,button);
});
let focusIndex=0,focusLocked=false;
focusSelect.value='0';
function cssColor(n){ return `#${n.toString(16).padStart(6,'0')}`; }

let raceState='ready', raceStart=0, elapsed=0, pauseAt=0, countdownTimer=null;
const startBtn=document.querySelector('#startBtn'), pauseBtn=document.querySelector('#pauseBtn');
const resetBtn=document.querySelector('#resetBtn'), countdown=document.querySelector('#countdown');
const finishCard=document.querySelector('#finishCard');
const createRaceId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const walletKey='marble-race-wallet-v2',raceId=createRaceId();
const picks=new Set(),betMessage=document.querySelector('#betMessage');
const dailyClaimBtn=document.querySelector('#dailyClaimBtn');
const localDateKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
let account=newAccount(),navigating=false;
try{const saved=JSON.parse(localStorage.getItem(walletKey));if(saved&&Number.isSafeInteger(saved.balance)&&saved.balance>=0)account=saved;}catch{}
const interrupted=!!account.active;account=abandonBet(account);
function saveAccount(){try{localStorage.setItem(walletKey,JSON.stringify(account));return true;}catch{betMessage.textContent=t('bet.saveFailed');return false;}}
saveAccount();
const moduleComboNames={trianglePins:'三列高几何障碍',rotorSlalom:'双列旋杆阵列＋玻璃金属交叉漏斗',serpentineGrooves:'抬板连续S形槽',splitterWaves:'分流波浪＋挡板'};
function updateTrackCode(){
  const node=document.querySelector('#trackCode');
  const combo=extensionModules.map(m=>moduleLabel(moduleComboNames[m.id])).join(' → ');
  node.textContent=`${stageLabel(extensionShapeLabel)} · ${woodName(selectedWood.name)} · ${String(layoutSeed).slice(-4)}`;
  node.title=t('track.title',{wood:woodName(selectedWood.name),combo});
}
updateTrackCode();
marbles.forEach((m,i)=>{
  const button=document.createElement('button');button.type='button';button.dataset.index=String(i);
  button.setAttribute('aria-pressed','false');
  button.innerHTML=`<span class="rank-ball marble-preview"></span><span>${m.name}</span>`;
  button.querySelector('.rank-ball').style.backgroundImage=`url("${m.preview}")`;
  button.addEventListener('click',()=>{
    if(raceState!=='ready')return;
    if(picks.has(i))picks.delete(i);else if(picks.size<4)picks.add(i);else{betMessage.textContent=t('bet.maxPicks',{max:4});return;}
    betMessage.textContent=picks.size?t('bet.locked'):t('bet.placeholder');updateBetUI();
  });
  document.querySelector('#betChoices').append(button);
});
function updateBetUI(){
  document.querySelector('#balance').textContent=String(account.balance);
  const cost=picks.size*STAKE_PER_PICK;
  document.querySelector('#betCaption').textContent=t('bet.caption',{stake:STAKE_PER_PICK,max:4});
  document.querySelector('#betCost').textContent=picks.size?t('bet.cost',{count:picks.size,cost}):t('bet.costEmpty',{stake:STAKE_PER_PICK,max:4});
  document.querySelector('#betRewardHint').innerHTML=t('bet.rewardHint',{reward:`<b id="betReward">${championReward(marbles.length)}</b>`});
  const claimedToday=account.lastDailyClaim===localDateKey();dailyClaimBtn.disabled=claimedToday;dailyClaimBtn.textContent=claimedToday?t('bet.claimed'):t('bet.claim',{amount:DAILY_BONUS});
  document.querySelector('.bet-panel').hidden=raceState!=='ready';
  const summary=document.querySelector('#betSummary');summary.hidden=raceState==='ready';
  document.querySelector('#myBetBalls').replaceChildren(...[...picks].map(index=>{
    const marble=marbles[index],item=document.createElement('span');item.className='my-bet-ball';
    const dot=document.createElement('span');dot.className='rank-ball marble-preview';dot.style.backgroundImage=`url("${marble.preview}")`;
    item.append(dot,document.createTextNode(marble.name));return item;
  }));
  document.querySelectorAll('#betChoices button').forEach(button=>{button.disabled=raceState!=='ready';button.setAttribute('aria-pressed',String(picks.has(Number(button.dataset.index))));});
  document.querySelector('#randomTrackBtn').disabled=raceState!=='ready'&&raceState!=='finished';
  resetBtn.textContent=t(['countdown','racing','paused'].includes(raceState)?'controls.abandon':'controls.reset');
  if(raceState==='ready'){
    startBtn.disabled=picks.size===0||account.balance<cost;
    startBtn.textContent=t('bet.start');
    if(picks.size&&account.balance<cost)betMessage.textContent=t('bet.insufficient');
  }
}
if(interrupted)betMessage.textContent=t('bet.interrupted');
updateBetUI();
dailyClaimBtn.addEventListener('click',()=>{const result=claimDaily(account,localDateKey());account=result.account;if(result.claimed){saveAccount();betMessage.textContent=t('bet.daily',{amount:DAILY_BONUS});}updateBetUI();});
document.querySelector('#randomTrackBtn').addEventListener('click',resetRace);

function removeGate(){
  if(!gateActive)return;
  world.removeBody(gate.body); gate.mesh.visible=false; gateActive=false;
  marbles.forEach((m,i)=>{
    m.body.velocity.setZero();
    m.body.angularVelocity.set(0,0,0);
    m.body.wakeUp();
  });
}
function restoreGate(){ if(gateActive)return; world.addBody(gate.body); gate.mesh.visible=true; gateActive=true; }

function beginRace(){
  if(raceState!=='ready'||navigating)return;
  try{account=placeBet(account,[...picks],marbles.length,raceId);}catch(error){betMessage.textContent=error.message;return;}
  saveAccount();
  ensureAudio();
  startRandomMusic();
  voiceCommentator.startRace();
  raceState='countdown'; finishCard.hidden=true; startBtn.disabled=true; pauseBtn.disabled=true;
  betMessage.textContent=t('bet.locked');updateBetUI();
  let n=3; countdown.textContent=n;
  clearInterval(countdownTimer);
  countdownTimer=setInterval(()=>{ n--; if(n>0){countdown.textContent=n;} else if(n===0){countdown.textContent=t('countdown.go');} else { clearInterval(countdownTimer); countdown.textContent=''; removeGate(); raceState='racing'; raceStart=performance.now(); pauseBtn.disabled=false; startBtn.textContent=t('bet.running'); } },700);
}
function resetRace(){
  if(navigating)return;navigating=true;clearInterval(countdownTimer);
  backgroundMusic.pause();
  voiceCommentator.stop();
  account=abandonBet(account);saveAccount();location.reload();
}
function togglePause(){
  if(raceState==='racing'){ raceState='paused'; pauseAt=performance.now(); pauseBtn.textContent=t('controls.resume'); backgroundMusic.pause(); }
  else if(raceState==='paused'){ raceStart+=performance.now()-pauseAt; raceState='racing'; pauseBtn.textContent=t('controls.pause'); if(musicOn)backgroundMusic.play().catch(()=>{}); }
  voiceCommentator.setPaused(raceState==='paused');
}
startBtn.addEventListener('click',beginRace); resetBtn.addEventListener('click',resetRace); pauseBtn.addEventListener('click',togglePause);
document.querySelector('#raceAgainBtn').addEventListener('click',resetRace);
function setFocusPicker(open){focusPickerPanel.hidden=!open;focusCard.setAttribute('aria-expanded',String(open));}
focusCard.addEventListener('click',event=>{if(event.target.closest('.focus-picker-panel'))return;setFocusPicker(focusPickerPanel.hidden);});
focusCard.addEventListener('keydown',event=>{if(event.target.closest('.focus-picker-panel'))return;if(event.key==='Enter'||event.key===' '){event.preventDefault();setFocusPicker(focusPickerPanel.hidden);}else if(event.key==='Escape')setFocusPicker(false);});
document.addEventListener('pointerdown',event=>{if(!focusCard.contains(event.target))setFocusPicker(false);});
focusSelect.addEventListener('change',()=>{focusIndex=Number(focusSelect.value);updateFocusUI();setFocusPicker(false);});
addEventListener('keydown',e=>{ const n=Number(e.key); if(n>=1&&n<=8){focusIndex=n-1;focusSelect.value=String(focusIndex);updateFocusUI();} if(e.code==='Space'){e.preventDefault(); raceState==='ready'?beginRace():togglePause();} });

const mediaSettingsKey='marble-race-media-settings-v1';
let mediaSettings={music:true,effects:true,voice:false,musicVolume:.35};
try{mediaSettings={...mediaSettings,...JSON.parse(localStorage.getItem(mediaSettingsKey))};}catch{}
function saveMediaSettings(){try{localStorage.setItem(mediaSettingsKey,JSON.stringify(mediaSettings));}catch{}}
let soundOn=mediaSettings.effects!==false,musicOn=mediaSettings.music!==false;
const musicSources=import.meta.glob('./static/music/*.ogg',{query:'?url',import:'default',eager:true});
const musicTracks=Object.keys(musicSources).sort((a,b)=>a.localeCompare(b)).map(path=>({name:decodeURIComponent(path.split('/').pop()),url:musicSources[path]}));
const backgroundMusic=new Audio(),savedMusicVolume=Number(mediaSettings.musicVolume);backgroundMusic.loop=true;backgroundMusic.preload='none';backgroundMusic.volume=Number.isFinite(savedMusicVolume)?Math.min(1,Math.max(0,savedMusicVolume)):.35;
backgroundMusic.addEventListener('error',()=>{if(backgroundMusic.src)setMusicStatus(t('music.missing'));});
let lastMusicIndex=-1,currentTrackLabel='';
function setMusicStatus(name=t('settings.musicIdle')){const node=document.querySelector('#musicStatus');if(node)node.textContent=name;}
function startRandomMusic(){
  if(!musicOn||!musicTracks.length)return;
  let index=Math.floor(Math.random()*musicTracks.length);if(musicTracks.length>1&&index===lastMusicIndex)index=(index+1+Math.floor(Math.random()*(musicTracks.length-1)))%musicTracks.length;
  lastMusicIndex=index;const track=musicTracks[index];currentTrackLabel=track.name.replace(/\.ogg$/i,'');backgroundMusic.src=track.url;backgroundMusic.currentTime=0;setMusicStatus(t('music.playing',{name:track.name.replace(/\.ogg$/i,'')}));backgroundMusic.play().catch(()=>setMusicStatus(t('music.pending')));
}
function setMusicEnabled(enabled){musicOn=Boolean(enabled);mediaSettings.music=musicOn;saveMediaSettings();if(!musicOn)backgroundMusic.pause();else if(['countdown','racing'].includes(raceState)){if(!backgroundMusic.src)startRandomMusic();else backgroundMusic.play().catch(()=>{});}}
function setEffectsEnabled(enabled){soundOn=Boolean(enabled);mediaSettings.effects=soundOn;saveMediaSettings();}
function setMusicVolume(value){backgroundMusic.volume=Math.min(1,Math.max(0,Number(value)||0));mediaSettings.musicVolume=backgroundMusic.volume;saveMediaSettings();}

let audioContext=null, lastImpactAt=0;
const impactTimes=new Map();
function ensureAudio(){
  if(!audioContext) audioContext=new AudioContext();
  if(audioContext.state==='suspended') audioContext.resume();
}
function playImpact(velocity,material){
  const now=performance.now();
  if(!soundOn || Math.abs(velocity)<.65 || now-lastImpactAt<12 || now-(impactTimes.get(material)||0)<38)return;
  ensureAudio();lastImpactAt=now;impactTimes.set(material,now);
  glassImpact(audioContext,material,Math.abs(velocity));
}
startBtn.addEventListener('pointerdown',ensureAudio,{once:true});

// Distance follows the course centerline, including bends and changes of level.
const courseDistances=[0];
const rankingBowls=[{...bowl,id:11,label:'11 · 落孔漏斗碗'},{...secondBowl,id:16,label:'16 · 木质落孔碗'}];
const cleanStageName=value=>String(value??'').replace(/^\s*\d+\s*[.．、·:：—-]?\s*/,'').trim();
function getBowlInfo(m){return bowlPosition(m.body.position,m.body.velocity,rankingBowls);}
function getRaceStage(m){
  const info=getBowlInfo(m);if(info)return info.label;
  const p=m.body.position;
  const landing=rankingBowls.find(b=>Math.hypot(p.x-b.x,p.z-b.z)<=b.radius+.55&&p.y<b.rimY-5.05&&routeParameter(p)>b.z-b.radius);
  if(landing)return raceSections[landing.id].name;
  return (raceSections.find(section=>routeParameter(p)>section.end)||raceSections.at(-1)).name;
}
const reasonText=reason=>reason==='掉出赛道'?t('reason.offTrack'):reason==='长时间卡住'?t('reason.stuck'):reason;
function raceSnapshot(order){return order.map(m=>({id:m.index,name:m.name,progress:getProgress(m),speed:m.body.velocity.length()*racePhysicsRate,finished:m.finished,failed:m.failed,failureReason:reasonText(m.failureReason),finishTime:m.finishTime,stage:getRaceStage(m),bowl:getBowlInfo(m),position:{x:m.body.position.x,y:m.body.position.y,z:m.body.position.z}}));}
for(let i=1;i<=Math.round((trackStartZ-trackEndZ)*2);i++){
  courseDistances.push(courseDistances[i-1]+routeCenter(trackStartZ-i*.5).distanceTo(routeCenter(trackStartZ-(i-1)*.5)));
}
function getProgress(m){
  const parameter=rankingParameter(m.body.position,routeParameter(m.body.position),rankingBowls,getBowlInfo(m));
  const sample=THREE.MathUtils.clamp((trackStartZ-parameter)*2,0,courseDistances.length-1),index=Math.floor(sample);
  return THREE.MathUtils.lerp(courseDistances[index],courseDistances[Math.min(index+1,courseDistances.length-1)],sample-index);
}
function ordered(){
  return [...marbles].sort((a,b)=>{
    if(a.failed!==b.failed)return a.failed?1:-1;
    if(a.finished&&b.finished){if(a.failed!==b.failed)return a.failed?1:-1;return (a.finishTime??Infinity)-(b.finishTime??Infinity);}
    if(a.finished)return -1;
    if(b.finished)return 1;
    return getProgress(b)-getProgress(a);
  });
}
function updateFocusUI(m=marbles[focusIndex]){
  document.querySelector('#focusName').textContent=m.name;
  const dot=document.querySelector('#focusDot');dot.classList.add('marble-preview');dot.style.backgroundImage=`url("${m.preview}")`;
  focusChoiceRows.forEach((row,index)=>{const selected=index===m.index;row.classList.toggle('selected',selected);row.setAttribute('aria-selected',String(selected));});
}
updateFocusUI();

const commentator=new RaceCommentary();
const danmaku=new DanmakuOverlay(document.querySelector('#danmakuOverlay'),null);
const rankViewport=document.querySelector('#rankViewport');
const rankRows=new Map(marbles.map(m=>{
  const row=document.createElement('li');
  row.innerHTML=`<span class="rank-num"></span><span class="rank-ball marble-preview"></span><span class="rank-name">${m.name}</span><span class="rank-speed"></span><span class="rank-gap"></span>`;
  row.querySelector('.rank-ball').style.backgroundImage=`url("${m.preview}")`;
  return [m.index,row];
}));
let rankSignature='',lastRankingUpdate=-Infinity;
function updateRankFade(){rankViewport.classList.toggle('at-bottom',rankViewport.scrollTop>=rankViewport.scrollHeight-rankViewport.clientHeight-2);rankViewport.classList.toggle('is-top',rankViewport.scrollTop<1);}
rankViewport.addEventListener('scroll',updateRankFade,{passive:true});
const voiceCommentator=new VoiceCommentary({settings:loadVoiceSettings(),onStatus:status=>{
  const toggle=document.querySelector('#voiceToggle'),label=document.querySelector('#voiceStatus');
  if(toggle){toggle.disabled=!status.supported;toggle.checked=status.enabled&&status.supported;}
  if(label)label.textContent=!status.supported?t('voice.statusUnsupported'):!status.enabled?t('voice.statusOff'):status.error?status.error:status.ready?t('voice.statusReady',{tone:status.tone,name:status.voiceName}):t('voice.statusWaiting');
}});
voiceCommentator.setEnabled(mediaSettings.voice!==false);
const settingsUi=setupVoiceSettings(voiceCommentator,{
  musicEnabled:()=>musicOn,setMusicEnabled,effectsEnabled:()=>soundOn,setEffectsEnabled,
  voiceEnabled:()=>voiceCommentator.enabled,setVoiceEnabled:enabled=>{mediaSettings.voice=Boolean(enabled);saveMediaSettings();voiceCommentator.setEnabled(Boolean(enabled));if(enabled)voiceCommentator.refresh();},
  danmakuEnabled:()=>danmaku.enabled,setDanmakuEnabled:enabled=>danmaku.setEnabled(enabled),
  danmakuCount:()=>danmaku.maxItems,setDanmakuCount:value=>danmaku.setMaxItems(value),
  danmakuSpeed:()=>danmaku.speedScale,setDanmakuSpeed:value=>danmaku.setSpeedScale(value),
  musicVolume:()=>backgroundMusic.volume,setMusicVolume
});
addEventListener('pagehide',()=>{voiceCommentator.stop();backgroundMusic.pause();});
document.addEventListener('visibilitychange',()=>{
  voiceCommentator.setPaused(document.hidden||raceState==='paused');
  if(document.hidden)backgroundMusic.pause();else if(musicOn&&['countdown','racing'].includes(raceState))backgroundMusic.play().catch(()=>{});
});
const commentaryLines=document.querySelector('#commentaryLines'),commentaryWindow=document.querySelector('#commentaryWindow');
let commentaryStarted=false;
let directorShot=null;
function updateCommentary(order){
  const stage=getRaceStage(order.find(m=>!m.finished)||order[0]);
  const generatedText=commentator.update(raceSnapshot(order),elapsed+postRaceElapsed,raceState,stage);
  if(!generatedText)return;
  // The Chinese rewrite keeps terminology consistent; other locales are already written that way.
  const text=getLocale()==='zh-CN'?generatedText.replace(/冲线/g,'入槽').replace(/越过终点|通过终点/g,'进入排次槽'):generatedText;
  directorShot=directorCue(commentator.lastKind,commentator.lastValues,text,raceSections,marbles,performance.now());
  const firstPlacePriority=!order[0].finished&&(commentator.lastKind==='openingLead'||commentator.lastKind==='leadChange'||commentator.lastKind==='gapClosing'&&commentator.lastValues.rank===2||commentator.lastKind==='gapOpening'&&commentator.lastValues.name===order[0].name);
  voiceCommentator.announce(text,{priority:commentator.lastKind==='winner'||firstPlacePriority,confirmed:commentator.lastKind==='finish'||commentator.lastKind==='lastPlace',mood:commentator.lastMood});
  if(!commentaryStarted){commentaryLines.replaceChildren();commentaryStarted=true;}
  const line=document.createElement('p');line.className='commentary-line';line.title=text;
  const words=document.createElement('span');words.textContent=text;line.append(words);
  commentaryLines.append(line);
  if(commentaryLines.children.length>3){const removedHeight=commentaryLines.firstElementChild.offsetHeight;commentaryLines.firstElementChild.remove();commentaryWindow.scrollTop=Math.max(0,commentaryWindow.scrollTop-removedHeight);}
  commentaryWindow.scrollTo({top:Math.max(0,commentaryLines.scrollHeight-commentaryWindow.clientHeight),behavior:'smooth'});
}
function updateHUD(){
  const order=ordered();
  updateCommentary(order);
  if(performance.now()-lastRankingUpdate>=100){
    lastRankingUpdate=performance.now();
    const signature=order.map(m=>m.index).join(',');
    if(signature!==rankSignature){
      const scroll=rankViewport.scrollTop;rankList.replaceChildren(...order.map(m=>rankRows.get(m.index)));rankViewport.scrollTop=scroll;rankSignature=signature;
    }
    order.forEach((m,i)=>{
    const li=rankRows.get(m.index);li.classList.toggle('focused',m.index===focusIndex);
    let status=t('rank.statusLeading');
    if(m.failed) status=t('rank.statusFailed');
    else if(m.finished) status=`${(m.finishTime/1000).toFixed(2)}s`;
    else if(i) status=`${straightDistance(order[0].body.position,m.body.position).toFixed(1)}m`;
    li.querySelector('.rank-num').textContent=String(i+1);
    li.querySelector('.rank-speed').textContent=`${(m.body.velocity.length()*racePhysicsRate).toFixed(1)} m/s`;
    focusChoiceRows.get(m.index).querySelector('.focus-choice-speed').textContent=`${(m.body.velocity.length()*racePhysicsRate).toFixed(1)} m/s`;
    li.querySelector('.rank-gap').textContent=status;
  });
    updateRankFade();
  }
  const f=!focusLocked&&cameraMode.value==='director'&&picks.size?order.find(m=>picks.has(m.index))??marbles[focusIndex]:marbles[focusIndex];
  updateFocusUI(f);
  document.querySelector('#speedText').textContent=(f.body.velocity.length()*racePhysicsRate).toFixed(1);
  const clockMs=Math.max(0,elapsed); const min=Math.floor(clockMs/60000),sec=Math.floor(clockMs/1000)%60,ms=Math.floor(clockMs%1000); document.querySelector('#raceClock').textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  document.querySelector('#stageText').textContent=stageLabel(getRaceStage(order.find(m=>!m.finished)||order[0]));
}

const failureWatch=new Map(),failureEvidence=new Map();
function updateFailureEvidence(){
  for(const m of marbles){
    if(m.finished){failureWatch.delete(m.index);continue;}
    const speed=m.body.velocity.length()*racePhysicsRate,z=routeParameter(m.body.position),center=trackPoint(0,z);
    if(speed>300||m.body.position.distanceTo(center)>32||m.body.position.y<center.y-18){failureEvidence.set(m.index,'掉出赛道');continue;}
    const progress=getProgress(m),watch=failureWatch.get(m.index);
    if(speed<=.1){
      if(!watch||Math.abs(progress-watch.progress)>.3)failureWatch.set(m.index,{since:elapsed,progress});
      else if(elapsed-watch.since>=8000)failureEvidence.set(m.index,'长时间卡住');
    }else{failureWatch.delete(m.index);if(failureEvidence.get(m.index)==='长时间卡住')failureEvidence.delete(m.index);}
  }
}
function failAbnormalMarbles(){
  if(!finishOrder.some(m=>!m.failed))return;
  for(const m of marbles){
    const reason=failureEvidence.get(m.index);if(m.finished||!reason)continue;
    m.failed=true;m.finished=true;m.failureReason=reason;m.failureTime=elapsed;m.finishTime=Infinity;
    m.body.velocity.setZero();m.body.angularVelocity.setZero();finishOrder.push(m);
  }
}
function checkFinish(previousElapsed=elapsed){
  if(raceState!=='racing')return;
  updateFailureEvidence();
  const crossings=marbles.filter(m=>{
    if(m.finished)return false;
    const z=routeParameter(m.body.position),offset=m.body.position.clone().sub(trackPoint(0,z)).dot(trackFrame(z).right);
    return Math.abs(offset)<=finishReceiver.halfWidth-.55+.04;
  }).map(m=>({m,time:crossingTime(m.beforeFinishParameter??routeParameter(m.body.position),routeParameter(m.body.position),finishReceiver.throat-.55,previousElapsed,elapsed)})).filter(x=>x.time!==null).sort((a,b)=>a.time-b.time);
  for(const {m,time} of crossings){m.finished=true;m.finishTime=time;finishOrder.push(m);}
  failAbnormalMarbles();
  if(finishOrder.length===marbles.length){
    raceState='finished';pauseBtn.disabled=true; startBtn.textContent=t('bet.finished');
    const w=finishOrder.find(m=>!m.failed),completed=finishOrder.filter(m=>!m.failed).length,failed=finishOrder.length-completed; document.querySelector('#winnerName').textContent=w?w.name:t('finish.timeout'); document.querySelector('#winnerName').style.color=w?cssColor(w.color):'#ffffff'; document.querySelector('#finishTime').textContent=w?t(failed?'finish.timeFailed':'finish.time',{time:(w.finishTime/1000).toFixed(3),completed,failed}):t('finish.resetHint'); finishCard.hidden=false;
    account=settleBet(account,w?.index??-1,raceId);saveAccount();updateBetUI();
    betMessage.textContent=account.lastResult?.won?t('bet.won',{reward:account.lastResult.reward}):t('bet.lost');
    document.querySelector('#betResult').textContent=t('bet.resultLine',{result:betMessage.textContent,balance:account.balance});
  }
}

const cameraMode=document.querySelector('#cameraMode');
const camPos=new THREE.Vector3(), camTarget=new THREE.Vector3();
let activeDirectorSubject=null;
let programmaticCamera=false;
function enterFreeCamera(){
  if(programmaticCamera || cameraMode.value==='free') return;
  cameraMode.value='free';
}
canvas.addEventListener('pointerdown',enterFreeCamera);
canvas.addEventListener('wheel',enterFreeCamera,{passive:true});
cameraMode.addEventListener('change',()=>{ orbit.target.copy(camTarget); });
function updateCamera(dt){
  const mode=cameraMode.value, focus=marbles[focusIndex], leader=ordered().find(m=>!m.finished)||ordered()[0];
  const cameraHeightScale=matchMedia('(max-width: 960px) and (pointer: coarse)').matches?2:1;
  if(mode==='free'){ activeDirectorSubject=null;orbit.update(); return; }
  programmaticCamera=true;
  let cue=mode==='director'&&directorShot&&performance.now()<directorShot.until?directorShot:null;
  const stageSubject=stageRacer(cue,raceSections,marbles,routeParameter);
  if(cue?.type==='stage'&&!stageSubject)cue=null;
  const cueSubject=cue?.type==='stage'?stageSubject:cue?.type==='marble'?marbles[cue.marbleIndex]:leader;
  const modeSubject=mode==='follow'?(focus.finished?leader:focus):mode==='director'?cueSubject:mode==='broadcast'?leader:null;
  const bowlInfo=modeSubject?getBowlInfo(modeSubject):null;
  const frontalShot=(z,height)=>{
    const center=trackPoint(0,z),forward=trackFrame(z).forward;
    camPos.copy(center).addScaledVector(forward,-14);camPos.y=height+11*cameraHeightScale;
    camTarget.copy(center).addScaledVector(forward,8);camTarget.y=height;
  };
  const bowlShot=info=>{
    const targetBowl=rankingBowls.find(item=>item.id===info.id),forward=trackFrame(targetBowl.z).forward;
    const center=new THREE.Vector3(targetBowl.x,targetBowl.rimY-.8,targetBowl.z);
    // Use the regular track-camera angle, scaled up to frame the whole bowl.
    const scale=Math.max(1,targetBowl.radius/6);
    camPos.copy(center).addScaledVector(forward,-14*scale);camPos.y+=8.5*scale*cameraHeightScale;
    camTarget.copy(center).addScaledVector(forward,8*scale);
  };
  if(bowlInfo){
    activeDirectorSubject=mode==='director'?modeSubject:null;
    bowlShot(bowlInfo);
  }else if(cue?.type==='stage'){
    activeDirectorSubject=stageSubject;
    frontalShot(routeParameter(stageSubject.body.position),stageSubject.body.position.y);
  }else if(cue?.type==='marble'){
    const racer=marbles[cue.marbleIndex];let z=routeParameter(racer.body.position);
    activeDirectorSubject=racer;
    if(cue.rivalIndex!==undefined){
      const rival=marbles[cue.rivalIndex];
      if(racer.body.position.distanceTo(rival.body.position)<16)z=(z+routeParameter(rival.body.position))*.5;
    }
    frontalShot(z,racer.body.position.y);
  }else if(mode==='follow'){
    activeDirectorSubject=null;
    const m=focus.finished?leader:focus,z=routeParameter(m.body.position);
    frontalShot(z,m.body.position.y);
  } else if(mode==='overhead'){
    activeDirectorSubject=null;
    const z=routeParameter(leader.body.position);camPos.copy(trackPoint(0,z));camPos.y+=28*cameraHeightScale;camTarget.copy(trackPoint(0,z-9));
  } else {
    activeDirectorSubject=mode==='director'?leader:null;
    const z=routeParameter(leader.body.position);
    frontalShot(z<finishReceiver.start+12||raceState==='finished'?finishZ:z,leader.body.position.y);
  }
  const k=1-Math.exp(-dt*(bowlInfo?2.2:mode==='follow'?2.8:cue?2.1:1.5)); camera.position.lerp(camPos,k); orbit.target.lerp(camTarget,k); orbit.update();
  programmaticCamera=false;
}

function refreshRacerNames(){
  marbles.forEach(m=>{m.name=racerName(m.nameKey);});
  marbles.forEach((m,i)=>{
    const option=focusSelect.options[i];if(option)option.textContent=m.name;
    const row=focusChoiceRows.get(m.index);if(row)row.querySelector('strong').textContent=m.name;
    const betButton=document.querySelector(`#betChoices button[data-index="${i}"]`);
    const betLabel=betButton?.querySelector('span:not(.rank-ball)');if(betLabel)betLabel.textContent=m.name;
    const rankRow=rankRows.get(m.index);if(rankRow)rankRow.querySelector('.rank-name').textContent=m.name;
  });
  if(!finishCard.hidden){const champion=finishOrder.find(m=>!m.failed);if(champion)document.querySelector('#winnerName').textContent=champion.name;}
}
function resetCommentaryIdle(){
  const lines=document.querySelector('#commentaryLines');if(!lines)return;
  const line=document.createElement('p');line.className='commentary-line';line.textContent=t('commentary.idle');
  lines.replaceChildren(line);
}
const languageSelect=document.querySelector('#languageSelect');
function syncLanguageSelect(){if(languageSelect)languageSelect.value=storedPreference()==='auto'?'auto':getLocale();}
syncLanguageSelect();

// One place to re-render everything that carries static text, so a live language
// switch never leaves a half-translated screen.
function refreshLocalizedUi(){
  applyDomI18n();
  refreshRacerNames();
  updateTrackCode();
  updateBetUI();
  updateFocusUI();
  settingsUi?.sync?.();
  syncLanguageSelect();
  if(!commentaryStarted||raceState==='ready')resetCommentaryIdle();
  if(raceState==='ready'&&!picks.size)betMessage.textContent=t('bet.placeholder');
  if(currentTrackLabel&&musicOn)setMusicStatus(t('music.playing',{name:currentTrackLabel}));
  const order=ordered();
  document.querySelector('#stageText').textContent=stageLabel(getRaceStage(order.find(m=>!m.finished)||order[0]));
}
onLocaleChange(()=>{
  danmaku.clear();
  voiceCommentator.refresh();
  refreshLocalizedUi();
});
// Localize the boot state too: the markup ships Chinese as a safe fallback.
refreshLocalizedUi();
languageSelect?.addEventListener('change',async()=>{
  languageSelect.disabled=true;
  try{await selectLanguage(languageSelect.value);}finally{languageSelect.disabled=false;}
  syncLanguageSelect();
});
// Auto mode resolves in the background: the browser guess renders first, the IP
// lookup may then swap in another language without blocking start-up.
// `?settings=1` opens the dialog on load, which keeps screenshots and QA simple.
if(new URLSearchParams(location.search).has('settings'))document.querySelector('#settingsBtn')?.click();
if(localeBoot.auto){
  resolveAutoLocale().then(code=>{if(code)setLocale(code,{persist:false});}).catch(()=>{});
}
let last=performance.now(), accumulator=0,postRaceElapsed=0;
function animate(now){
  requestAnimationFrame(animate); const dt=Math.min((now-last)/1000,.05); last=now;
  const previousElapsed=elapsed;
  if(raceState==='finished'&&!document.hidden)postRaceElapsed+=dt*1000;
  if(raceState==='racing'){
    for(const m of marbles)if(!m.finished)m.beforeFinishParameter=routeParameter(m.body.position);
    accumulator+=dt*racePhysicsRate; while(accumulator>=1/360){world.step(1/360);accumulator-=1/360;}
    elapsed=world.time*1000/racePhysicsRate;
  }
  if(raceState==='finished'&&postRaceElapsed<10000){
    // Keep physical roll-in running after classification; never move balls to rank slots.
    accumulator+=dt*racePhysicsRate;while(accumulator>=1/360){world.step(1/360);accumulator-=1/360;}
  }
  if(raceState==='ready'||raceState==='countdown')world.advanceMachines(dt);
  for(const m of marbles){m.mesh.position.copy(m.body.position);m.mesh.quaternion.copy(m.body.quaternion);}
  for(const obstacle of movingObstacles){obstacle.mesh.position.copy(obstacle.body.position);obstacle.mesh.quaternion.copy(obstacle.body.quaternion);}
  const shadowFocus=marbles[focusIndex].body.position;
  sun.position.set(shadowFocus.x-14,shadowFocus.y+24,shadowFocus.z+22);sun.target.position.copy(shadowFocus);
  checkFinish(previousElapsed); updateHUD(); updateCamera(dt); renderer.render(scene,camera);
  const audienceOrder=ordered();
  danmaku.update(raceSnapshot(audienceOrder),dt,raceState,getRaceStage(audienceOrder.find(m=>!m.finished)||audienceOrder[0]),cameraMode.value==='director'&&activeDirectorSubject?{mode:'director',subjectId:activeDirectorSubject.index}:null);
}
requestAnimationFrame(animate);

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(displayPixelRatio());});

