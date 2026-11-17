import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from '../src/rapier-adapter.js';
import {raceRandom} from '../src/race-variation.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('const slope ='),source.indexOf('const marbleDefs='));
const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
const trackMaterial=new CANNON.Material('track'),ballMaterial=new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(trackMaterial,ballMaterial,{friction:.08,restitution:.12}));
const mat=new THREE.MeshStandardMaterial(),scene=new THREE.Scene();globalThis.__trackSeed=Number(process.argv[3]??1);
const build=new Function('THREE','CANNON','world','scene','trackMaterial','wood','mdf','steel','yellow','raceRandom',setup+';return {trackPoint,trackFrame,routeParameter,surfaceY,finishReceiver};');
const track=build(THREE,CANNON,world,scene,trackMaterial,mat,mat,mat,mat,raceRandom);
const center=track.trackPoint(0,track.finishReceiver.throat);
for(const body of [...world.bodies])if(!(body.shape instanceof CANNON.Trimesh)&&body.position.distanceTo(center)>40)world.removeBody(body);
assert.equal(scene.children.filter(m=>m.name==='finish-funnel-guide').length,2);
assert.equal(scene.children.filter(m=>m.name==='finish-ranking-channel').length,2);
assert.equal(scene.children.some(m=>m.name==='finish-line-mark'),false);
const balls=Array.from({length:8},(_,i)=>{
  const body=new CANNON.Body({mass:.09,material:ballMaterial,shape:new CANNON.Sphere(.55),linearDamping:.006,angularDamping:.012});
  body.position.copy(track.trackPoint(-4.2+i*1.2,track.finishReceiver.start+4,.59));
  const f=track.trackFrame(track.finishReceiver.start+4).forward;body.velocity.set(f.x*Number(process.argv[2]??8),f.y*Number(process.argv[2]??8),f.z*Number(process.argv[2]??8));world.addBody(body);return body;
});
const entries=[];
for(let step=0;step<360*25;step++){
  world.step(1/360);
  balls.forEach((body,i)=>{
    const z=track.routeParameter(body.position),offset=body.position.clone().sub(track.trackPoint(0,z)).dot(track.trackFrame(z).right);
    assert.ok(z>track.finishReceiver.end-1,`ball ${i} escaped receiver`);
    assert.ok(body.position.y>=track.surfaceY(z,offset)-.2,`ball ${i} passed below floor`);
    if(z<track.finishReceiver.throat-.55&&Math.abs(offset)<=.14&&!entries.includes(i))entries.push(i);
    if(entries.includes(i))assert.ok(Math.abs(offset)<.3,`ball ${i} left ranking groove: z=${z}, offset=${offset}, time=${world.time}, y=${body.position.y}`);
  });
}
if(entries.length<8)console.log(JSON.stringify({entries,balls:balls.map(b=>({z:track.routeParameter(b.position),p:b.position,v:b.velocity}))},null,2));assert.equal(entries.length,8,'all eight must enter before the race can end');
const physicalOrder=balls.map((b,i)=>({i,z:track.routeParameter(b.position)})).sort((a,b)=>a.z-b.z).map(m=>m.i);
assert.deepEqual(physicalOrder,entries,'physical single-file order matches confirmed entry order');
for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)assert.ok(balls[i].position.distanceTo(balls[j].position)>1.06,'balls must not interpenetrate');
console.log(JSON.stringify({layoutSeed:globalThis.__trackSeed,entered:entries.length,entryOrder:entries,physicalOrder,positions:balls.map(b=>Number(track.routeParameter(b.position).toFixed(2)))},null,2));




