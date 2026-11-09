import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer,clampCameraEyeY} from '../dist/movement.js';
import {grenadeLaunch,eyeOrigin,FUSE_MS} from '../dist/equipment.js';
import {MAPS} from '../dist/maps.js';
import {newRoom,addPlayer,command,advance} from './rooms.mjs';
const at=1000000,open={half:40,boxes:[]};
const player=()=>({x:0,y:0,z:0,yaw:0,eyeHeight:1.62,grounded:true,lean:0});
test('crouching into a low roof keeps eye and grenade sphere below it from the first crossing frame',()=>{
  const map={half:20,boxes:[{x:0,z:0,w:4,d:4,y:1.3,h:.2}]};
  for(const hz of [20,30,60,144]){
    const p={...player(),x:-2.39,vx:7};let entered=false;
    for(let i=0;i<hz*.3;i++){
      movePlayer(p,{strafe:1,crouch:true},1/hz,map);
      if(p.x> -2.36){entered=true;assert.ok(p.y+p.eyeHeight<=1.22+1e-7,hz+' eye clipped roof');const g=grenadeLaunch(p,0,map);assert.ok(g.y+.12<1.3,hz+' grenade launched inside slab');}
      assert.equal(p.y,0);
    }
    assert.equal(entered,true);
  }
});
test('crouched lean works under a low roof, crouch-jump stays clear, and open-air eye easing is retained',()=>{
  const roof={half:20,boxes:[{x:0,z:0,w:6,d:6,y:1.3,h:.2}]},p=player();
  for(let i=0;i<24;i++)movePlayer(p,{crouch:true,lean:1,jump:i===12},1/120,roof);
  assert.ok(p.lean>.14);assert.ok(p.eyeHeight<=1.22);assert.ok(p.y+1.25<=1.3+1e-7);
  const q=player();movePlayer(q,{crouch:true},1/120,open);assert.ok(q.eyeHeight>1.5&&q.eyeHeight<1.62,'open crouch still eases');
  for(let i=0;i<50;i++)movePlayer(q,{},1/120,open);assert.equal(q.eyeHeight,1.62);
});
test('actual Foundry underpass enters crouched and exits standing across frame rates without altering foot height',()=>{
  const foundry=MAPS.find(m=>m.id==='foundry');
  for(const hz of [30,60,144]){
    const p={...player(),x:13,z:7.9,yaw:Math.PI};
    for(let i=0;i<Math.ceil(hz*.55);i++)movePlayer(p,{forward:-1,crouch:true},1/hz,foundry);
    assert.ok(p.z<7.5&&p.z>6.6,'entered beside actual center pillar at '+hz);
    for(let i=0;i<Math.ceil(hz*.2);i++)movePlayer(p,{jump:i===0},1/hz,foundry);
    assert.ok(p.eyeHeight<=1.22&&p.y+1.25<=1.3+1e-7,'roof enforces crouch');
    for(let i=0;i<hz;i++)movePlayer(p,{forward:1},1/hz,foundry);
    assert.ok(p.z>8&&p.eyeHeight>1.61,'stands once the roof is cleared at '+hz);
    assert.equal(p.y,0);assert.equal(p.grounded,true);
  }
});
test('descending-camera smoothing cannot put the rendered eye through a lower ceiling',()=>{
  const map={half:20,boxes:[{x:0,z:0,w:6,d:6,y:2,h:.1}]};
  assert.equal(clampCameraEyeY(map,{x:0,y:0,z:0},2.04),1.92);
  assert.equal(clampCameraEyeY(map,{x:0,y:0,z:0},1.62),1.62);
  assert.equal(clampCameraEyeY(map,{x:10,y:0,z:0},2.04),2.04);
  assert.equal(clampCameraEyeY(map,{x:0,y:2.1,z:0},3.72),3.72,'the floor below a player is not an overhead ceiling');
});
test('rifle/knife eye and grenade hand share lean placement without extending the knife range',()=>{
  for(const side of [-1,1]){
    const pose={...player(),x:24,z:20,lean:side*.15};assert.deepEqual(eyeOrigin(pose),[24+side*.15,1.62,20]);
    const center=grenadeLaunch({...pose,lean:0},0,open),leaned=grenadeLaunch(pose,0,open);assert.ok(Math.abs(leaned.x-center.x-side*.15)<1e-7);
    const r=newRoom('LEANQA',false),a=addPlayer(r,{name:'Knife'},at);addPlayer(r,{name:'Target'},at);r.phase='live';r.endsAt=at+600000;
    const [p,q]=r.players;Object.assign(p,pose,{shieldUntil:0});Object.assign(q,{x:24+side*.54,y:0,z:18,eyeHeight:1.62,shieldUntil:0});
    command(r,a.token,{type:'equip',equipment:'knife'},at);command(r,a.token,{type:'melee',seq:1,yaw:0,pitch:0},at);assert.equal(q.health,50,'legal leaned contact should register');
    q.z=16;command(r,a.token,{type:'melee',seq:2,yaw:0,pitch:0},at+580);assert.equal(q.health,50,'lean cannot turn into a longer reach');
  }
});
test('respawn avoids a foreseeable blast after protection expires, without mutating its live trajectory',()=>{
  const map={id:'spawn-cover-qa',half:40,spawns:[{x:0,z:0,yaw:0},{x:20,z:0,yaw:0}],boxes:[]};MAPS.push(map);
  try{
    for(const scenario of [1800,1000,999,'moving']){
      const moving=scenario==='moving',remaining=moving?1800:scenario;
      const r=newRoom('SAFEQA',false);r.map=map.id;addPlayer(r,{name:'Respawn'},at);r.phase='live';r.endsAt=at+600000;const p=r.players[0];p.alive=false;p.respawnAt=at;
      r.grenades=[{id:'hazard',owner:p.id,x:0,y:moving?1:.12,z:moving?12:0,vx:0,vy:moving?1:0,vz:moving?-8:0,age:(FUSE_MS-remaining)/1000,physicsRemainder:0,createdAt:at-FUSE_MS+remaining,updatedAt:at}];
      const before=structuredClone(r.grenades);advance(r,at);assert.equal(p.alive,true);assert.equal(p.x,remaining>=1000?20:0,'remaining fuse '+remaining);assert.deepEqual(r.grenades,before);
    }
  }finally{MAPS.pop();}
});
test('hard cover and friendly grenades do not falsely block a preferred spawn; own grenades still count',()=>{
  const map={id:'spawn-cover-qa',half:40,spawns:[{x:0,z:0,yaw:0},{x:20,z:0,yaw:0}],boxes:[]};MAPS.push(map);
  try{
    for(const reason of ['cover','friendly','self']){
      map.boxes=reason==='cover'?[{x:0,z:2,w:10,d:.3,h:4,y:0}]:[];
      const r=newRoom('SAFEQA',false);r.map=map.id;addPlayer(r,{name:'Respawn'},at);addPlayer(r,{name:'Owner'},at);r.phase='live';r.endsAt=at+600000;
      const [p,q]=r.players;Object.assign(p,{alive:false,respawnAt:at,team:'blue'});Object.assign(q,{x:35,z:30,team:'blue'});
      r.grenades=[{id:'hazard',owner:reason==='self'?p.id:q.id,x:0,y:.12,z:reason==='cover'?4:0,vx:0,vy:0,vz:0,age:0,createdAt:at,updatedAt:at}];
      advance(r,at);assert.equal(p.x,reason==='self'?20:0,reason);
    }
  }finally{MAPS.pop();}
});
