import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from '../src/rapier-adapter.js';
import {raceRandom} from '../src/race-variation.js';

const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('const slope ='),source.indexOf('const marbleDefs='));
const material=new THREE.MeshStandardMaterial();
for(const seed of [1,2,3,4]){
  globalThis.__trackSeed=seed;
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)}),scene=new THREE.Scene();
  const build=new Function('THREE','CANNON','world','scene','trackMaterial','wood','mdf','steel','yellow','raceRandom',
    setup+';return {extensionModules,serpentineCenter,surfaceY,trackPoint,trackFrame};');
  const track=build(THREE,CANNON,world,scene,new CANNON.Material('track'),material,material,material,material,raceRandom);
  const blocks=scene.children.filter(mesh=>mesh.name==='irregular-geometric-obstacle');
  assert.equal(blocks.length,18,'six staggered rows of three obstacles');
  for(const block of blocks){
    block.geometry.computeBoundingBox();
    assert.ok(block.geometry.boundingBox.max.y-block.geometry.boundingBox.min.y>2.2,'block must exceed two marble diameters');
  }
  assert.ok(scene.children.filter(mesh=>mesh.name==='long-tube-rail').length>=60,'three glass/metal funnel pairs');
  const start=track.extensionModules.find(module=>module.id==='serpentineGrooves').start-42;
  const radius=4.2,halfArc=radius*Math.sin(80*Math.PI/180),epsilon=.0001;
  const heading=progress=>Math.atan2(track.serpentineCenter(start-progress-epsilon,start)-track.serpentineCenter(start-progress+epsilon,start),2*epsilon);
  const swing=Math.abs((heading(3*halfArc-.001)-heading(halfArc+.001))*180/Math.PI);
  assert.ok(swing>=159,`S bend only turns ${swing.toFixed(1)} degrees`);
  const z=start-20,center=track.serpentineCenter(z,start);
  assert.ok(track.surfaceY(z,center+1.2)-track.surfaceY(z,center)>.55,'plank shoulders must stand above the aligned groove floor');
  const rotorArms=scene.children.filter(mesh=>mesh.name==='rotating-rod-array-arm');
  assert.equal(rotorArms.length,24,'three 2-column x 4-row rotor grids');
  console.log(JSON.stringify({seed,blocks:blocks.length,tubeSegments:scene.children.filter(mesh=>mesh.name==='long-tube-rail').length,rotorArms:rotorArms.length,swingDegrees:+swing.toFixed(1)}));
}
