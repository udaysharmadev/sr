import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer} from '../dist/movement.js';
import {grenadeLaunch,stepGrenade,knifeSwing,KNIFE_MS} from '../dist/equipment.js';
import {approachAngle,landingCompression} from '../dist/presentation.js';
import * as T from '../dist/vendor/three.module.js';
import {createEquipmentEffects} from '../dist/equipment-models.js';
const arena={half:100,boxes:[]};
const player=()=>({x:0,y:0,z:0,yaw:0,grounded:true,eyeHeight:1.62});
test('movement acceleration is vector-limited, with matching cardinal and diagonal travel across frame rates',()=>{
 for(const hz of [20,30,60,144]){
  const straight=player(),diagonal=player();
  for(let i=0;i<hz;i++){movePlayer(straight,{forward:1},1/hz,arena);movePlayer(diagonal,{forward:1,strafe:1},1/hz,arena);}
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-Math.abs(straight.z))<1e-7);
  assert.ok(Math.hypot(diagonal.vx,diagonal.vz)<=7.000001);
 }
 const samples=[30,60,144].map(hz=>{const p=player();for(let i=0;i<hz;i++)movePlayer(p,{forward:1},1/hz,arena);return p.z;});
 assert.ok(Math.max(...samples)-Math.min(...samples)<.015);
});
test('shared movement jump/slide edges fire once per input and collide with thin roofs and boundaries',()=>{
 const p=player();movePlayer(p,{jump:true},.05,arena);assert.ok(p.y>0&&p.vy<7.22);assert.equal(p.jumpBuffer,0);
 const roof={half:10,boxes:[{x:0,z:0,w:5,d:5,y:2.2,h:.05}]};
 for(let i=0;i<120;i++)movePlayer(p,{jump:i===0},1/120,roof);
 assert.ok(p.y+1.85<=2.20001);assert.equal(p.grounded,true);
 const edge=player();edge.x=9.5;for(let i=0;i<120;i++)movePlayer(edge,{strafe:1},1/60,roof);assert.ok(edge.x<=9.64);
});
test('grenade sweep stops at thin cover at high speed and fixed contact integration converges exactly',()=>{
 const map={half:100,boxes:[{x:0,z:-.4,w:10,d:.015,h:4}]};
 const g={x:0,y:1,z:0,vx:0,vy:0,vz:-100,age:0};stepGrenade(g,map,1/60);assert.ok(g.z>-.2725);assert.ok(g.vz>0);
 const samples=[30,60,144].map(hz=>{const p=grenadeLaunch({...player(),pitch:0},1);for(let i=0;i<hz*2;i++)stepGrenade(p,arena,1/hz);return p;});
 for(const p of samples){assert.ok(Math.abs(p.z-samples[0].z)<1e-7);assert.ok(Math.abs(p.y-samples[0].y)<1e-7);assert.ok(p.y>=.12);}
});
test('knife pose is continuous at windup/contact/recovery and landing motion stays bounded',()=>{
 for(const t of [KNIFE_MS*.18,KNIFE_MS*.43]){const a=knifeSwing(t-.001),b=knifeSwing(t+.001);for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<.0001,key);}
 assert.equal(landingCompression(150,12,true),0);assert.equal(landingCompression(400,12),0);
 for(let t=0;t<=360;t++)assert.ok(landingCompression(t,100)>=0&&landingCompression(t,100)<=.13);
 const a=Math.PI-.02,b=-Math.PI+.02,next=approachAngle(a,b,1/60);assert.ok(next>a&&next-a<.04,'turn through the short wrap, not the whole circle');
});
test('falling grenade rests on a thin elevated ledge and hits an overhead slab without crossing it',()=>{
 const map={half:20,boxes:[{x:0,z:0,w:4,d:4,y:1,h:.05}]};
 const falling={x:0,y:4,z:0,vx:0,vy:-15,vz:0,age:0};
 for(let i=0;i<240;i++)stepGrenade(falling,map,1/120);
 assert.ok(Math.abs(falling.y-1.17)<.0001);assert.equal(falling.vy,0);
 const rising={x:0,y:.4,z:0,vx:0,vy:100,vz:0,age:0};stepGrenade(rising,map,1/120);assert.ok(rising.y<.88);assert.ok(rising.vy<0);
});
test('resting grenade visuals stop rotating and blast ring/effects clean up',()=>{
 const scene=new T.Scene(),effects=createEquipmentEffects(scene);const g={id:'g',x:0,y:.12,z:0,age:1};effects.sync([g]);const model=scene.children[0],before=model.rotation.toArray();effects.sync([{...g,age:1.2}]);assert.deepEqual(model.rotation.toArray(),before);
 effects.sync([{...g,z:.12}]);assert.notDeepEqual(model.rotation.toArray(),before);effects.sync([]);
 effects.blast(new T.Vector3(0,2,0),0);const ring=scene.children[0].children.find(node=>node.geometry?.type==='RingGeometry');assert.ok(ring);effects.update(200);assert.ok(ring.scale.x>1);assert.equal(ring.visible,true);effects.update(700);assert.equal(ring.visible,false);effects.update(4001);assert.equal(scene.children.length,0);effects.dispose();
});
