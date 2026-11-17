import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from '../src/rapier-adapter.js';
import {raceRandom} from '../src/race-variation.js';

const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('const slope ='),source.indexOf('const marbleDefs='));
const orders=new Set(),shapes=new Set(),openings=new Set();
for(const seed of [1,2,3,4]){
  globalThis.__trackSeed=seed;
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)}),scene=new THREE.Scene();
  const trackMaterial=new CANNON.Material('track'),material=new THREE.MeshStandardMaterial();
  const build=new Function('THREE','CANNON','world','scene','trackMaterial','wood','mdf','steel','yellow','raceRandom',setup+';return {trackStartZ,trackEndZ,extensionStart,extensionShape,extensionModules,openingVariant,extensionCurvePoints,routeCenter,routeParameter,trackFrame,raceSections,finishReceiver,movingObstacles};');
  const track=build(THREE,CANNON,world,scene,trackMaterial,material,material,material,material,raceRandom);
  assert.ok((track.trackStartZ-track.trackEndZ)/(track.trackStartZ-(-1008))>=1.95,'course must be nearly twice as long');
  assert.equal(track.extensionModules.length,4);
  assert.equal(new Set(track.extensionModules.map(m=>m.id)).size,4);
  assert.equal(track.raceSections.at(-1).end,track.trackEndZ);
  assert.equal(track.raceSections.at(-1).name.includes('排次槽'),true);
  assert.equal(track.finishReceiver.end,track.trackEndZ+2);
  assert.equal(track.raceSections[1].name.includes('木钉迷阵'),true);
  assert.equal(track.raceSections[2].name.includes(({slalom:'错位导流门',island:'木质分流岛',open:'加速空廊'})[track.openingVariant]),true);
  assert.ok(track.movingObstacles.filter(o=>o.driven).every(o=>track.routeParameter(o.body.position)>track.finishReceiver.start+30),'rotor must stay clear of the collector mouth');
  const samples=[];
  for(let z=track.extensionStart;z>=track.trackEndZ;z-=4){
    const p=track.routeCenter(z),recovered=track.routeParameter(p);
    assert.ok(Math.abs(recovered-z)<2.2,`seed ${seed}: inverse route mismatch ${z} -> ${recovered}`);
    samples.push({z,p});
  }
  let minimumPlanarSeparation=Infinity;
  for(let i=0;i<samples.length;i++)for(let j=i+20;j<samples.length;j++){
    const a=samples[i].p,b=samples[j].p;
    minimumPlanarSeparation=Math.min(minimumPlanarSeparation,Math.hypot(a.x-b.x,a.z-b.z));
  }
  let minimumTurnRadius=Infinity,sharpestAt=null;
  for(let i=1;i<samples.length-1;i++){
    const a=samples[i-1].p,b=samples[i].p,c=samples[i+1].p;
    const first=new THREE.Vector2(b.x-a.x,b.z-a.z),second=new THREE.Vector2(c.x-b.x,c.z-b.z);
    const angle=Math.abs(Math.atan2(first.x*second.y-first.y*second.x,first.dot(second)));
    if(angle>.001){const radius=(first.length()+second.length())/(2*angle);if(radius<minimumTurnRadius){minimumTurnRadius=radius;sharpestAt=samples[i].z;}}
  }
  assert.ok(minimumPlanarSeparation>14,`seed ${seed}: upper/lower runs overlap in plan (${minimumPlanarSeparation})`);
  assert.ok(minimumTurnRadius>12,`seed ${seed}: corner tighter than track width (${minimumTurnRadius})`);
  // Long supports would meet the workshop floor and are forbidden in the race lanes.
  assert.equal(scene.children.filter(m=>m.name==='race-deck').length,1);
  assert.equal(scene.children.filter(m=>m.geometry?.type==='BoxGeometry'&&m.geometry.parameters?.height>50&&m.geometry.parameters?.width<2).length,0);
  const shape=track.extensionShape;
  shapes.add(shape);orders.add(track.extensionModules.map(m=>m.id).join(','));openings.add(track.openingVariant);
  console.log(JSON.stringify({seed,shape,opening:track.openingVariant,order:track.extensionModules.map(m=>m.id),length:track.trackStartZ-track.trackEndZ,minimumPlanarSeparation:+minimumPlanarSeparation.toFixed(2),minimumTurnRadius:+minimumTurnRadius.toFixed(2),sharpestAt}));
}
assert.equal(shapes.size,2,'both broad straightaway plans must be generated');
assert.ok(orders.size>=2,'module order must change with seed');
assert.equal(openings.size,3,'three stage-three modules must be reachable');
