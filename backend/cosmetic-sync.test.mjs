import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi} from './api.mjs';
import {command} from './rooms.mjs';
import {unpackSnapshot} from '../dist/snapshot-wire.js';
import * as T from '../dist/vendor/three.module.js';
import {operator,setOperatorWeapon} from '../dist/arena.js';
import {createDeathEffects} from '../dist/death-animation.js';

test('verified Gold/name/badge reach compact opponent/results snapshots, while wardrobe changes wait for respawn',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-gold-'),saved=await localProfileStore(pathToFileURL(path+'/'));let time=1000000;
  const profiles=profileApi(saved.store,()=>time),rooms=roomApi(saved.rooms,()=>time,req=>resolveGuestProfile(saved.store,req));
  const call=async(handler,data,cookie,player)=>{const reply=await handler(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',cookie,...(player?{Authorization:'Bearer '+player.token}:{})},body:JSON.stringify({...data,...(player?{code:player.code}:{}),wire:1})}));const result=await reply.json();assert.equal(reply.status,200,result.error);if(result.state)result.state=unpackSnapshot(result.state);return {...result,cookie:reply.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const a=await call(profiles,{type:'open',name:'Gold pilot'},''),b=await call(profiles,{type:'open',name:'Observer'},'');
    const cookie=a.cookie,peerCookie=b.cookie;
    const player=await call(rooms,{type:'create',finish:'gold'},cookie);assert.equal(player.state.players[0].finish,'field','unearned join finish ignored');
    const peer=await call(rooms,{type:'join',code:player.code},peerCookie);
    async function editProfile(edit){const row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));edit(row.profile);assert.equal(await saved.store.write(row.key,row,row.profile),true);}
    await editProfile(p=>{p.name='Verified Gold';p.owned.push('ember','prism');p.equipped.clothing='ember';p.equipped.finishes.sunbolt='gold';p.mastery={sunbolt:{kills:500,headshots:100,xp:50000}};p.kills=500;p.headshots=300;p.deaths=200;p.badge='deadeye';});
    await call(rooms,{type:'ready',ready:true},cookie,player);await call(rooms,{type:'ready',ready:true},peerCookie,peer);await call(rooms,{type:'start'},cookie,player);
    let observed=(await call(rooms,{type:'refresh'},peerCookie,peer)).state.players.find(p=>p.id===player.id);
    // Profile holder's next request synchronizes the newly spawned wardrobe and current metadata.
    await call(rooms,{type:'refresh'},cookie,player);observed=(await call(rooms,{type:'refresh'},peerCookie,peer)).state.players.find(p=>p.id===player.id);
    assert.equal(observed.finish,'gold');assert.equal(observed.name,'Verified Gold');assert.equal(observed.badge,'deadeye');assert.equal(observed.gear.clothing,'ember');
    await call(rooms,{type:'rename',name:'Forged rename'},cookie,player);assert.equal((await call(rooms,{type:'refresh'},peerCookie,peer)).state.players.find(p=>p.id===player.id).name,'Verified Gold');
    const changed=await call(rooms,{type:'loadout',weapon:'prism'},cookie,player);assert.equal(changed.state.players.find(p=>p.id===player.id).finish,'field');
    await editProfile(p=>{p.equipped.finishes.prism='gold';});assert.equal((await call(rooms,{type:'refresh'},cookie,player)).state.players.find(p=>p.id===player.id).finish,'field','Gold remains per-rifle mastery gated');
    await call(rooms,{type:'loadout',weapon:'sunbolt'},cookie,player);
    let row=await saved.rooms.read(player.code);row.room.phase='live';row.room.endsAt=time+600000;
    const target=row.room.players.find(p=>p.id===player.id),shooter=row.room.players.find(p=>p.id===peer.id);
    Object.assign(target,{x:24,y:0,z:18,shieldUntil:0,history:[]});Object.assign(shooter,{x:24,y:0,z:20,shieldUntil:0,history:[]});
    command(row.room,peer.token,{type:'shoot',seq:1,yaw:0,pitch:0},time);assert.equal(target.alive,false);const death=row.room.events.find(e=>e.type==='kill');assert.equal(death.victimPose.finish,'gold');
    await saved.rooms.write(player.code,row,row.room,time);
    await editProfile(p=>{p.equipped.clothing='cobalt';p.equipped.finishes.sunbolt='field';});
    const dead=(await call(rooms,{type:'refresh'},cookie,player)).state.players.find(p=>p.id===player.id);assert.equal(dead.gear.clothing,'ember','dead actor wardrobe remains frozen');
    time+=2000;const respawned=await call(rooms,{type:'refresh'},cookie,player);const fresh=respawned.state.players.find(p=>p.id===player.id);assert.equal(fresh.gear.clothing,'cobalt');assert.equal(fresh.finish,'field');assert.equal(respawned.state.events.find(e=>e.type==='kill').victimPose.finish,'gold');
    row=await saved.rooms.read(player.code);row.room.phase='results';row.room.finishedAt=time;await saved.rooms.write(player.code,row,row.room,time);
    const results=(await call(rooms,{type:'refresh'},peerCookie,peer)).state;assert.ok(results.players.every(p=>['field','gold'].includes(p.finish)));assert.equal(JSON.stringify(results).includes('appearanceLife'),false);
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});

test('remote rifle finish updates without replacing geometry; corpse retains recorded Gold after living rifle changes',()=>{
  const scene=new T.Scene(),model=operator(scene),gun=model.userData.gun;let released=0;gun.traverse(n=>n.geometry?.addEventListener('dispose',()=>released++));
  const stock=[];gun.traverse(n=>{if(n.material?.name==='rifle-stock')stock.push(n.material);});const field=stock[0].color.getHex();
  setOperatorWeapon(model,'sunbolt','gold');assert.equal(model.userData.gun,gun);assert.notEqual(stock[0].color.getHex(),field);assert.equal(released,0);
  setOperatorWeapon(model,'sunbolt','field');assert.equal(stock[0].color.getHex(),field);assert.equal(released,0);
  const fx=createDeathEffects(scene,{boxes:[]},()=>0);fx.add(model,0,{x:0,y:0,z:0,weapon:'sunbolt',finish:'gold'});
  const corpse=scene.children.find(n=>n!==model),corpseGun=corpse.children[1];assert.equal(corpseGun.userData.finish,'gold');
  setOperatorWeapon(model,'prism','field');assert.ok(released>0);assert.equal(corpseGun.userData.finish,'gold');assert.doesNotThrow(()=>model.clone());
  fx.update(1500);assert.equal(scene.children.length,1);fx.dispose();
});
