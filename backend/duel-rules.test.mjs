import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,command,advance} from './rooms.mjs';
const start=1000000;
function setup(rule){const r=newRoom('DUELQA',false),a=addPlayer(r,{name:'A'},start),b=addPlayer(r,{name:'B'},start);command(r,a.token,{type:'settings',settings:{mode:'duel',duelRule:rule,targetPoints:5,duration:3}},start);for(const c of[a,b])command(r,c.token,{type:'ready',ready:true},start);command(r,a.token,{type:'start'},start);advance(r,start+10000);return {r,a,b};}
test('point duel has no hidden clock, wins at configured target and preserves chamber',()=>{
 const {r,a}=setup('points');assert.equal(r.endsAt,0);let t=start+11000;
 for(let i=1;i<=5;i++){const [p,q]=r.players;Object.assign(p,{x:24,y:0,z:20,eyeHeight:1.62,shieldUntil:0,history:[],alive:true});Object.assign(q,{x:24,y:0,z:17,eyeHeight:1.62,shieldUntil:0,history:[],alive:true,spawnedAt:t-1000});command(r,a.token,{type:'shoot',seq:i,yaw:0,pitch:0},t);assert.equal(p.kills,i);assert.equal(r.phase,i===5?'results':'live');assert.equal(p.reloadUntil,t+1500);t+=2000;for(const p of r.players)p.seen=t;advance(r,t);}
});
test('time duel ignores point target and finishes only on the selected deadline',()=>{
 const {r}=setup('time');assert.equal(r.endsAt,start+190000);r.players[0].kills=100;for(let t=start+40000;t<r.endsAt;t+=30000){for(const p of r.players)p.seen=t;advance(r,t);assert.equal(r.phase,'live');}for(const p of r.players)p.seen=r.endsAt;advance(r,r.endsAt);assert.equal(r.phase,'results');
});
test('points duel advances grenade physics and expires absent players without a clock',()=>{
 const {r}=setup('points');r.grenades=[{id:'test',owner:r.players[0].id,x:0,y:2,z:0,vx:0,vy:0,vz:0,age:0,createdAt:start+10000,updatedAt:start+10000}];advance(r,start+12000);assert.equal(r.grenades.length,0);assert.ok(r.events.some(e=>e.type==='explosion'));advance(r,start+60000);assert.equal(r.players.length,0);
});
