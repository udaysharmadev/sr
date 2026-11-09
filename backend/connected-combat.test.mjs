import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HEALTH, KNIFE_DAMAGE, blastDamage, damagePlayer } from '../dist/equipment.js';
import { createBlastFeedback } from '../dist/blast-feedback.js';
import { newRoom, addPlayer, command, advance, snapshot } from './rooms.mjs';
import * as T from '../dist/vendor/three.module.js';
import { createEquipmentEffects } from '../dist/equipment-models.js';
const at=1000000;
function setup(){
  const r=newRoom('WOUNDA',false),a=addPlayer(r,{name:'Thrower'},at),b=addPlayer(r,{name:'Survivor'},at);
  r.phase='live';r.endsAt=at+600000;
  const [p,q]=r.players;
  for(const [i,v] of [p,q].entries())Object.assign(v,{x:24,y:0,z:20-i*2,eyeHeight:1.62,yaw:0,lean:0,alive:true,shieldUntil:0,history:[]});
  return {r,a,b,p,q};
}
function blast(r,p,id='test',z=12){r.grenades.push({id,owner:p.id,x:24,y:.12,z,vx:0,vy:0,vz:0,age:0,createdAt:at,updatedAt:at});}
test('blast falloff is lethal nearby, wounds throughout the outer band and leaves a one-knife finish',()=>{
  assert.equal(blastDamage(0),100);assert.equal(blastDamage(4.5),100);
  let previous=100;
  for(let d=4.501;d<=8;d+=.01){const amount=blastDamage(d);assert.ok(amount>=50&&amount<100&&amount<=previous);previous=amount;
    const p={health:MAX_HEALTH};damagePlayer(p,amount);assert.ok(p.health>0&&p.health<=KNIFE_DAMAGE);damagePlayer(p,KNIFE_DAMAGE);assert.equal(p.health,0);}
  assert.equal(blastDamage(8),50);for(const d of [8.001,-1,NaN,Infinity])assert.equal(blastDamage(d),0);
});
test('authoritative outer blast damage survives polling and one landed knife finishes it, then respawn fully resets',()=>{
  const {r,a,p,q}=setup();blast(r,p);advance(r,at+1800);
  assert.equal(q.alive,true);assert.ok(q.health>0&&q.health<=50);assert.equal(q.knifeHits,0);assert.equal(p.health,100);
  assert.equal(snapshot(r,at+1800).players.find(v=>v.id===q.id).health,q.health);
  const wounded=q.health;advance(r,at+1801);assert.equal(q.health,wounded,'polling never re-applies the explosion');
  const hit=r.events.find(e=>e.type==='grenadehit');assert.equal(hit.victim,q.id);assert.equal(hit.health,wounded);assert.equal(hit.grenadeId,'test');assert.equal(r.events.find(e=>e.type==='explosion').grenadeId,'test');
  command(r,a.token,{type:'equip',equipment:'knife'},at+1801);command(r,a.token,{type:'melee',seq:1,yaw:0,pitch:0},at+1801);
  assert.equal(q.alive,false);assert.equal(q.health,0);assert.equal(q.knifeHits,1);assert.equal(p.kills,1);assert.equal(p.hits,0);
  command(r,a.token,{type:'melee',seq:1,yaw:0,pitch:0},at+1802);assert.equal(q.deaths,1,'retried melee cannot score twice');
  advance(r,at+3801);assert.equal(q.alive,true);assert.equal(q.health,100);assert.equal(q.knifeHits,0);assert.equal(q.grenades,1);
});
test('fresh players still need two knives; damage belongs to the victim and any attacker can finish the wound',()=>{
  const {r,a,p,q}=setup();command(r,a.token,{type:'equip',equipment:'knife'},at);command(r,a.token,{type:'melee',seq:1,yaw:0,pitch:0},at);
  assert.equal(q.alive,true);assert.equal(q.health,50);
  p.x=22; // Move the first attacker out of the finisher's ray.
  const c=addPlayer(r,{name:'Finisher'},at);const finisher=r.players.find(v=>v.token===c.token);Object.assign(finisher,{x:24,y:0,z:20,shieldUntil:0,eyeHeight:1.62});
  command(r,c.token,{type:'equip',equipment:'knife'},at+580);command(r,c.token,{type:'melee',seq:1,yaw:0,pitch:0},at+580);
  assert.equal(q.alive,false);assert.equal(finisher.kills,1);assert.equal(p.kills,0);assert.equal(r.events.at(-1).attacker,finisher.id);
});
test('outer blasts accumulate, near blast stays lethal and a wounded target still dies to one sniper hit',()=>{
  for(const method of ['second blast','rifle','inner blast']){
    const {r,a,p,q}=setup();blast(r,p);advance(r,at+1800);assert.equal(q.alive,true);
    if(method==='rifle')command(r,a.token,{type:'shoot',seq:1,yaw:0,pitch:0},at+1801);
    else{blast(r,p,'second',method==='inner blast'?16:12);r.grenades[0].createdAt=r.grenades[0].updatedAt=at+1801;advance(r,at+3601);}
    assert.equal(q.alive,false,method);assert.equal(q.health,0);assert.equal(p.kills,1,method);
  }
});
test('hard cover, spawn protection and teammates prevent health loss, not just elimination',()=>{
  for(const reason of ['cover','shield','team']){
    const {r,p,q}=setup();Object.assign(q,{x:-8.5,z:9.5});const pos=reason==='cover'?{x:-11.5,z:9.5}:{x:-7.2,z:9.5};
    if(reason==='shield')q.shieldUntil=at+4000;if(reason==='team'){p.team=q.team='blue';r.settings.mode='tdm';}
    blast(r,p);Object.assign(r.grenades[0],pos);advance(r,at+1800);assert.equal(q.health,100,reason);assert.equal(q.alive,true,reason);
  }
});
test('fuse prediction and later server confirmation play one synchronized blast; stale reconnects do not play delayed sound',()=>{
  let time=0;const calls=[],present=createBlastFeedback((...args)=>calls.push(args),()=>time),point={x:0,y:0,z:0};
  assert.equal(present('a',point,0),true);time=100;assert.equal(present('a',point,100),false);assert.equal(calls.length,1);assert.equal(calls[0][2],true);
  assert.equal(present('b',point,650),true);assert.equal(calls[1][2],false);assert.equal(calls[1][1],650);
  assert.equal(present('c',point,4000),false);assert.equal(present('d',point,NaN),false);
  time=12000;assert.equal(present('a',point,12000),false);assert.equal(calls.length,2);
  assert.equal(present('new-round',point,0),true);
});

test('blast attack, sparks and smoke have distinct lifetimes; burst cap and disposal release old effects',()=>{
  const scene=new T.Scene(),fx=createEquipmentEffects(scene);fx.blast(new T.Vector3(0,.12,0),0);fx.update(60);
  const root=scene.children[0],flash=root.children.find(n=>n.geometry?.type==='SphereGeometry'),smoke=root.children.filter(n=>n.isSprite),sparks=root.children.filter(n=>n.geometry?.type==='BoxGeometry'&&n.scale.z===7);
  assert.equal(flash.visible,true);assert.ok(flash.material.opacity>0);assert.equal(flash.material.blending,T.AdditiveBlending);
  assert.equal(smoke.length,20);assert.equal(sparks.length,12);assert.ok(sparks.every(n=>n.visible&&n.material.opacity>0));
  fx.update(300);assert.equal(flash.visible,false);assert.ok(sparks.every(n=>!n.visible));assert.ok(smoke.every(n=>n.material.opacity>0));
  let released=0;for(const n of root.children)n.material.addEventListener('dispose',()=>released++);
  for(let i=0;i<12;i++)fx.blast(new T.Vector3(i,.12,0),400);
  assert.equal(scene.children.length,12);assert.equal(released,root.children.length,'replaced burst materials disposed once');
  fx.update(4401);assert.equal(scene.children.length,0);fx.dispose();
});
