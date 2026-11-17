import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
await RAPIER.init();

// Small compatibility layer for the existing scene builder; simulation is entirely Rapier.
export class Vec3 extends THREE.Vector3 { setZero(){return this.set(0,0,0);} }
class Quaternion extends THREE.Quaternion {
  setFromEuler(x,y,z){return super.setFromEuler(new THREE.Euler(x,y,z));}
}
export class Material { constructor(name){this.name=name;} }
export class ContactMaterial { constructor(a,b,options){Object.assign(this,options);} }
export class Box {constructor(half){this.half=half;}}
export class Sphere {constructor(radius){this.radius=radius;}}
export class Cylinder {constructor(top,bottom,height){this.radius=Math.max(top,bottom);this.height=height;}}
export class Trimesh {constructor(vertices,indices){this.vertices=vertices;this.indices=indices;}}
export class Convex {constructor(vertices){this.vertices=vertices;}}
export class SAPBroadphase {}
export class Body {
  constructor(options){
    Object.assign(this,options);this.position=new Vec3();this.quaternion=new Quaternion();
    this.velocity=new Vec3();this.angularVelocity=new Vec3();this.listeners=[];
  }
  wakeUp(){this.rigid?.wakeUp();}
  addEventListener(name,fn){if(name==='collide')this.listeners.push(fn);}
}
export class World {
  constructor({gravity}){
    this.engine=new RAPIER.World(gravity);this.events=new RAPIER.EventQueue(true);
    // Configure Rapier itself; values written to the old compatibility solver had no effect.
    this.engine.integrationParameters.numSolverIterations=6;
    this.engine.integrationParameters.maxCcdSubsteps=2;
    this.bodies=[];this.handles=new Map();this.time=0;this.defaultContactMaterial={};this.solver={};
    this.friction=.12;this.restitution=.16;
  }
  addContactMaterial(material){this.friction=material.friction;this.restitution=material.restitution;}
  addBody(body){
    const desc=body.kinematic?RAPIER.RigidBodyDesc.kinematicPositionBased():body.mass>0?RAPIER.RigidBodyDesc.dynamic():RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(body.position.x,body.position.y,body.position.z).setRotation(body.quaternion);
    if(body.mass>0){desc.setCcdEnabled(true).setCanSleep(false).setLinearDamping(body.linearDamping||0).setAngularDamping(body.angularDamping||0);}
    body.rigid=this.engine.createRigidBody(desc);
    const s=body.shape;let c;
    if(s instanceof Sphere)c=RAPIER.ColliderDesc.ball(s.radius);
    else if(s instanceof Box)c=RAPIER.ColliderDesc.cuboid(s.half.x,s.half.y,s.half.z);
    else if(s instanceof Cylinder)c=RAPIER.ColliderDesc.cylinder(s.height/2,s.radius);
    else if(s instanceof Convex)c=RAPIER.ColliderDesc.convexHull(new Float32Array(s.vertices));
    else c=RAPIER.ColliderDesc.trimesh(new Float32Array(s.vertices),new Uint32Array(s.indices));
    c.setFriction(this.friction).setRestitution(this.restitution).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    if(body.mass>0)c.setMass(body.mass);
    body.collider=this.engine.createCollider(c,body.rigid);
    this.handles.set(body.collider.handle,body);this.bodies.push(body);
  }
  removeBody(body){
    this.handles.delete(body.collider.handle);this.engine.removeRigidBody(body.rigid);
    this.bodies=this.bodies.filter(b=>b!==body);body.rigid=null;
  }
  addRevolute(anchor,body,point,axis){
    const local=point.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert());
    const fixed=point.clone().sub(anchor.position);
    const joint=this.engine.createImpulseJoint(RAPIER.JointData.revolute(fixed,local,axis),anchor.rigid,body.rigid,true);
    joint.setContactsEnabled(false);return joint;
  }
  advanceMachines(dt){
    for(const b of this.bodies){if(!b.kinematic)continue;
      b.spinAngle=(b.spinAngle??b.spinPhase??0)+dt*b.spinRate;
      b.quaternion.set(0,Math.sin(b.spinAngle/2),0,Math.cos(b.spinAngle/2));
      b.rigid.setRotation(b.quaternion,false);
    }
  }
  step(dt){
    this.engine.timestep=dt;
    for(const b of this.bodies){if(!b.kinematic)continue;
      const angle=b.spinAngle=(b.spinAngle??b.spinPhase??0)+dt*b.spinRate;
      b.rigid.setNextKinematicRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)});
    }
    for(const b of this.bodies){if(!b.mass)continue;
      if(b.raceVariation && this.brakeProfile){
        const resistance=this.brakeProfile(b.position);
        if(resistance>0){
          const factor=Math.exp(-resistance*dt);
          b.velocity.x*=factor;b.velocity.z*=factor;
        }
      }
      if(b.raceVariation && this.channelGuide){
        const speed=Math.hypot(b.velocity.x,b.velocity.z);
        if(speed<7){
          const acceleration=this.channelGuide(b.position);
          if(acceleration){
            const factor=(1-speed/7)*dt;
            b.velocity.x+=acceleration.x*factor;
            b.velocity.z+=acceleration.z*factor;
          }
        }
      }
      if(b.raceVariation && this.channelEscapeProfile){
        const channel=this.channelEscapeProfile(b.position);
        if(this.time>=(b.nextHopVariationAt??0)){
          b.hopVariation=.7+.3*(this.raceRandom?.()??.5);
          b.nextHopVariationAt=this.time+.3;
        }
        const speed=Math.hypot(b.velocity.x,b.velocity.z);
        const speedFactor=Math.min(1,Math.max(0,(speed-4)/8));
        // Passive restitution remains below one: collisions redirect existing motion,
        // rather than adding a random upward impulse or moving the ball out of its lane.
        b.collider.setRestitution(this.restitution+channel*speedFactor*.24*b.hopVariation);
      }
      b.rigid.setTranslation(b.position,false);b.rigid.setRotation(b.quaternion,false);
      b.rigid.setLinvel(b.velocity,false);b.rigid.setAngvel(b.angularVelocity,false);
    }
    this.engine.step(this.events);this.time+=dt;
    this.events.drainCollisionEvents((a,b,started)=>{
      if(!started)return;const A=this.handles.get(a),B=this.handles.get(b);if(!A||!B)return;
      const relative=A.velocity.clone().sub(B.velocity);
      let v=0;
      this.engine.contactPair(A.collider,B.collider,manifold=>{
        const normal=manifold.normal();
        v=Math.max(v,Math.abs(relative.x*normal.x+relative.y*normal.y+relative.z*normal.z));
      });
      // CCD contacts can disappear within the step; use the resulting velocity change.
      if(!v)for(const body of [A,B])if(body.mass){
        const after=body.rigid.linvel();
        v=Math.max(v,Math.hypot(body.velocity.x-after.x,body.velocity.y-after.y,body.velocity.z-after.z));
      }
      // Tiny contact-material variation; no artificial kick or extra energy.
      if(this.raceRandom && v > .65) {
        for(const body of [A,B]) {
          if(!body.mass || !body.raceVariation || this.time-(body.lastVariationAt ?? -1)<.15)continue;
          body.lastVariationAt=this.time;
          body.collider.setRestitution(this.restitution+(this.raceRandom()-.5)*.012);
          body.collider.setFriction(this.friction*(.97+this.raceRandom()*.06));
        }
      }
      A.listeners.forEach(fn=>fn({body:B,contact:{getImpactVelocityAlongNormal:()=>v}}));
      B.listeners.forEach(fn=>fn({body:A,contact:{getImpactVelocityAlongNormal:()=>v}}));
    });
    for(const b of this.bodies){if(!b.mass&&!b.kinematic)continue;
      const p=b.rigid.translation(),q=b.rigid.rotation(),v=b.rigid.linvel(),w=b.rigid.angvel();
      b.position.set(p.x,p.y,p.z);b.quaternion.set(q.x,q.y,q.z,q.w);
      b.velocity.set(v.x,v.y,v.z);b.angularVelocity.set(w.x,w.y,w.z);
    }
  }
}
