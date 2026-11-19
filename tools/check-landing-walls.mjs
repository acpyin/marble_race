import fs from 'node:fs';
import * as THREE from 'three';
import * as CANNON from '../src/rapier-adapter.js';
import {raceRandom} from '../src/race-variation.js';

// Drop marbles hard out of both funnel holes from several directions and make
// sure the invisible walls keep them inside the deck.
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('const slope ='),source.indexOf('const marbleDefs='));
const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
world.broadphase=new CANNON.SAPBroadphase(world);
const trackMaterial=new CANNON.Material('track'),ballMaterial=new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(trackMaterial,ballMaterial,{friction:.08,restitution:.12,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
const mat=new THREE.MeshStandardMaterial();
globalThis.__trackSeed=1;
const build=new Function('THREE','CANNON','world','scene','trackMaterial','wood','mdf','steel','yellow','bowlWoodMap','raceRandom',setup+';return {trackPoint,routeCenter,bowl,secondBowl,surfaceY};');
const scene=new THREE.Scene();
const track=build(THREE,CANNON,world,scene,trackMaterial,mat,mat,mat,mat,null,raceRandom);

const walls=scene.children.filter(mesh=>mesh.name==='landing-air-wall');
const failures=[];
if(walls.length<18)failures.push(`too-few-air-walls:${walls.length}`);

const sideOffset=(p,z)=>{
  const center=track.routeCenter(z);
  const dx=p.x-center.x, dz=p.z-center.z;
  return Math.hypot(dx,dz);
};

const cases=[];
for(const bowl of [track.bowl,track.secondBowl]){
  for(const [vx,vz] of [[6,0],[-6,0],[0,6],[0,-6],[4.5,4.5],[-4.5,4.5]]){
    cases.push({bowl,vx,vz});
  }
}
const results=[];
for(const {bowl,vx,vz} of cases){
  const floorY=track.surfaceY(bowl.z-2);
  const body=new CANNON.Body({mass:.09,material:ballMaterial,shape:new CANNON.Sphere(.55),linearDamping:.006,angularDamping:.012,allowSleep:false});
  // Release just under the hole, the way a marble actually leaves the bowl.
  body.position.set(bowl.x,floorY+2.6,bowl.z);
  body.velocity.set(vx,0,vz);
  world.addBody(body);
  let maxSide=0,escaped=false;
  for(let i=0;i<420;i++){
    world.step(1/120);
    const p=body.position;
    const z=p.z;
    const lateral=sideOffset(p,z);
    maxSide=Math.max(maxSide,lateral);
    const onDeck=z>=-360&&z<=-230;
    if(onDeck&&lateral>6.6)escaped=true;
  }
  results.push({bowl:bowl.z,vx,vz,maxSide:+maxSide.toFixed(2),escaped});
  world.removeBody(body);
  if(escaped)failures.push(`escaped:${bowl.z}:${vx},${vz}:${maxSide.toFixed(2)}`);
}

console.log(JSON.stringify({walls:walls.length,results,failures},null,2));
process.exit(failures.length?1:0);
