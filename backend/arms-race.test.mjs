import test from 'node:test';import assert from 'node:assert/strict';
import {newRoom,addPlayer,command,advance,snapshot} from './rooms.mjs';
import {armsStage,ARMS_FINAL_KILLS} from '../dist/arms-race.js';
import {WEAPONS,canChangeWeapon} from '../dist/weapons.js';

test('private Arms Race advances rifles on earned kills and ends on final knife elimination',()=>{
 let t=1000000;const room=newRoom('ARMSQA',false),a=addPlayer(room,{name:'Alpha'},t),b=addPlayer(room,{name:'Bravo'},t);
 command(room,a.token,{type:'settings',settings:{mode:'arms'}},t);assert.equal(room.settings.mode,'arms');
 command(room,a.token,{type:'ready',ready:true},t);command(room,b.token,{type:'ready',ready:true},t);command(room,a.token,{type:'start'},t);assert.equal(room.phase,'warmup');
 t=room.endsAt;advance(room,t);assert.equal(room.phase,'live');const [p,q]=room.players;assert.equal(p.weapon,WEAPONS[0].id);assert.equal(canChangeWeapon('warmup',true,false,'arms'),false);
 const place=()=>{Object.assign(p,{x:24,y:0,z:20,yaw:0,lean:0,eyeHeight:1.62,shieldUntil:0,alive:true});Object.assign(q,{x:24,y:0,z:18,shieldUntil:0,alive:true,health:100,history:[],spawnedAt:t-1});};
 place();command(room,a.token,{type:'shoot',seq:1,yaw:0,pitch:0},t+1);assert.equal(p.armsKills,1);assert.equal(p.weapon,WEAPONS[0].id);
 t+=1501;advance(room,t);place();command(room,a.token,{type:'shoot',seq:2,yaw:0,pitch:0},t+1);assert.equal(p.armsKills,2);assert.equal(p.weapon,WEAPONS[1].id);assert.equal(snapshot(room,t+1).players[0].id,p.id);
 p.armsKills=ARMS_FINAL_KILLS-1;p.weapon=armsStage(p.armsKills).weapon;p.ammo=1;p.reloadUntil=0;p.lastShot=0;t+=2000;place();command(room,a.token,{type:'shoot',seq:3,yaw:0,pitch:0},t);assert.equal(p.armsKills,ARMS_FINAL_KILLS);assert.equal(p.equipment,'knife');
 assert.throws(()=>command(room,a.token,{type:'equip',equipment:'rifle'},t+1),/Final stage/);
 t+=1000;place();q.z=19;command(room,a.token,{type:'melee',seq:1,yaw:0,pitch:0},t);assert.equal(q.alive,true);
 t+=1000;command(room,a.token,{type:'melee',seq:2,yaw:0,pitch:0},t);assert.equal(q.alive,false);assert.equal(p.armsKills,ARMS_FINAL_KILLS+1);assert.equal(room.phase,'results');
});
