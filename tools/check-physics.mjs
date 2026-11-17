import fs from 'node:fs';
import * as THREE from 'three';
import * as CANNON from '../src/rapier-adapter.js';
import {raceRandom,startVariation} from '../src/race-variation.js';

// Execute the actual geometry builders used by the game, without a DOM or GPU.
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('const slope ='),source.indexOf('const marbleDefs='));
const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
world.broadphase=new CANNON.SAPBroadphase(world);
const trackMaterial=new CANNON.Material('track'), ballMaterial=new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(trackMaterial,ballMaterial,{friction:.08,restitution:.12,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
const mat=new THREE.MeshStandardMaterial();
globalThis.__trackSeed=Number(process.argv[3]??process.argv[2]??1);
const build=new Function('THREE','CANNON','world','scene','trackMaterial','wood','mdf','steel','yellow','bowlWoodMap','raceRandom',setup+';return {gate,bowl,secondBowl,movingObstacles,layoutSeed,trackPoint,trackFrame,routeParameter,surfaceY,trackX,snakeLane,serpentineWidthScale,finishZ,finishReceiver};');
const scene=new THREE.Scene();
const track=build(THREE,CANNON,world,scene,trackMaterial,mat,mat,mat,mat,null,raceRandom);
world.removeBody(track.gate.body);
const seed=Number(process.argv[2] ?? 1);world.raceRandom=raceRandom(seed);
const offsets=[-4.15,-2.95,-1.75,-.55,.65,1.85,3.05,4.25];
const balls=offsets.map((offset,i)=>{
  const variation=startVariation(world.raceRandom);
  const p=track.trackPoint(offset+variation.lateral,40,.82);
  const body=new CANNON.Body({mass:.09,material:ballMaterial,shape:new CANNON.Sphere(.55),linearDamping:.006,angularDamping:.012,allowSleep:false});
  body.raceVariation=true;body.position.set(p.x,p.y,p.z);world.addBody(body);return body;
});
const finish=new Map(), mazeExit=new Set(),drop=new Set(),secondDrop=new Set(),channelHops=new Set(),inletSeen=new Set(),inletCaptured=new Set();let failures=[];
for(const mesh of scene.children.filter(m=>m.name==='triangle-guide')){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  if(!uv || [...uv.array,...n.array].some(v=>!Number.isFinite(v)))failures.push('invalid-guide-attributes');
  if(g.index || p.count!==21)failures.push('guide-bottom-not-removed');
  for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    if(b.sub(a).cross(c.sub(a)).length()<1e-6)failures.push('degenerate-guide-face');
  }
}
const obstacleMotion=track.movingObstacles.map(()=>0);
const machineHits=track.movingObstacles.map(()=>0);
track.movingObstacles.forEach((obstacle,i)=>{if(obstacle.driven)obstacle.body.addEventListener('collide',event=>{if(event.body.mass===.09)machineHits[i]++;});});
if(new Set(balls.map(b=>b.position.z)).size!==1)failures.push('unequal-start-line');
for(let step=0;step<360*720;step++){
  world.step(1/360);
  track.movingObstacles.forEach((obstacle,i)=>{obstacleMotion[i]=Math.max(obstacleMotion[i],Math.abs(obstacle.body.quaternion.y));});
  for(let i=0;i<balls.length;i++){
    const p=balls[i].position;
    const parameter=track.routeParameter(p),center=track.trackPoint(0,parameter),right=track.trackFrame(parameter).right;
    const offset=p.clone().sub(center).dot(right);
    if(parameter<-491 && parameter>-498 && !inletSeen.has(i)){inletSeen.add(i);if(Math.abs(offset-track.snakeLane(offset<0?-1:1,parameter))<1.35*track.serpentineWidthScale)inletCaptured.add(i);}
    if(parameter<-490 && parameter>-558){
      if(Math.abs(offset-track.snakeLane(0,parameter))>1.15*track.serpentineWidthScale)channelHops.add(i);
    }
    const floorY=track.surfaceY(parameter,offset)-((parameter<=-236 && parameter>-246)||(parameter<=-344 && parameter>-354)?8:0);
    if(p.y<floorY-.85 && !failures.includes(`below-floor-${i}`)){failures.push(`below-floor-${i}`);console.error(JSON.stringify({below:i,time:world.time,position:p,velocity:balls[i].velocity,parameter,offset,floorY}));}
    if(parameter < track.finishReceiver.end-1 && !failures.includes(`past-catch-${i}`)){failures.push(`past-catch-${i}`);console.error(JSON.stringify({escape:i,time:world.time,position:p,velocity:balls[i].velocity,parameter}));}
    if(Math.abs(p.z-track.bowl.z)<12 && p.y<track.bowl.rimY-4.6 && p.y>track.bowl.rimY-6){
      if(Math.hypot(p.x-track.bowl.x,p.z-track.bowl.z)>track.bowl.hole+.08 && !failures.includes(`bowl-bypass-${i}`))failures.push(`bowl-bypass-${i}`);
      drop.add(i);
    }
    if(Math.abs(p.z-track.secondBowl.z)<12 && p.y<track.secondBowl.rimY-4.6 && p.y>track.secondBowl.rimY-6){
      if(Math.hypot(p.x-track.secondBowl.x,p.z-track.secondBowl.z)>track.secondBowl.hole+.08 && !failures.includes(`second-bowl-bypass-${i}`))failures.push(`second-bowl-bypass-${i}`);
      secondDrop.add(i);
    }
    if(finish.has(i))continue;
    if(parameter<17.5 && parameter>16.5)mazeExit.add(i);
    if(parameter<track.finishZ && !finish.has(i))finish.set(i,+(world.time).toFixed(3));
  }
  if(finish.size===8)break;
}
const unfinished=balls.map((body,index)=>({index,parameter:track.routeParameter(body.position),position:body.position,velocity:body.velocity,
  nearbyPegs:world.bodies.filter(other=>other.mass===0&&other.shape instanceof CANNON.Cylinder&&other.position.distanceTo(body.position)<4).map(other=>other.position)
})).filter(({index})=>!finish.has(index));
console.log(JSON.stringify({seed,layoutSeed:track.layoutSeed,finished:finish.size,finishSeconds:Object.fromEntries(finish),unfinished,channelHops:[...channelHops],inletCaptured:inletCaptured.size,passedMaze:mazeExit.size,passedHole:drop.size,passedSecondHole:secondDrop.size,obstacleMotion,machineHits,failures},null,2));
if(failures.length || finish.size<8 || mazeExit.size<8 || drop.size<8 || secondDrop.size<8)process.exitCode=1;



