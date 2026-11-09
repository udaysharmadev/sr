import test from 'node:test';import assert from 'node:assert/strict';
import {newRoom,addPlayer,advance,command,snapshot} from './rooms.mjs';
import {MAPS,TRAINING_MAP,clearPosition} from '../dist/maps.js';
const t=1000000;
test('full public room votes for a playable map, trains separately for ten seconds, then starts with clean live state',()=>{
 const room=newRoom('P00000',true),players=Array.from({length:15},(_,i)=>addPlayer(room,{name:'Pilot '+i},t));
 assert.equal(room.phase,'vote');assert.ok(!MAPS.some(m=>m.id===TRAINING_MAP.id));
 assert.throws(()=>command(room,players[0].token,{type:'vote',map:TRAINING_MAP.id},t+1),/Voting is closed/);
 command(room,players[0].token,{type:'vote',map:'foundry'},t+1);advance(room,t+10000);
 let state=snapshot(room,t+10000);assert.equal(state.phase,'warmup');assert.equal(state.map,'foundry');assert.equal(state.arena,TRAINING_MAP.id);assert.equal(state.endsAt,t+20000);
 for(const player of room.players)assert.ok(clearPosition(TRAINING_MAP,player.x,player.z,player.y));
 const shooter=room.players.find(p=>p.id===players[0].id);Object.assign(shooter,{x:0,y:0,z:0,yaw:0,eyeHeight:1.62,lean:0,alive:true,ammo:1,reloadUntil:0,lastShot:0,shieldUntil:0,history:[]});
 command(room,players[0].token,{type:'shoot',seq:1,yaw:0,pitch:0},t+10001);assert.ok(room.events.some(e=>e.type==='practice-hit'&&e.attacker===shooter.id));assert.equal(shooter.kills,0);assert.equal(shooter.shots,1);
 const oldCursor=0;assert.ok(room.eventId>oldCursor);
 advance(room,t+20000);state=snapshot(room,t+20000,oldCursor);assert.equal(state.phase,'live');assert.equal(state.map,'foundry');assert.equal(state.arena,'foundry');assert.equal(state.endsAt,t+620000);assert.ok(state.players.every(p=>p.kills===0&&p.shots===0));assert.equal(state.events.length,0);assert.equal(state.eventGap,false,'discarded warmup events are not lost live events');
 const resetId=room.eventId;room.events=Array.from({length:256},(_,i)=>({id:resetId+i+2,at:t+20001,type:'shot'}));room.eventId=resetId+257;
 assert.equal(snapshot(room,t+20001,oldCursor).eventGap,true,'live events lost after the reset still report a gap');
});

test('fifteen independent API sessions observe the same training and battle arena boundaries',async()=>{
 const {MemoryStore,roomApi}=await import('./api.mjs');let now=t;const store=new MemoryStore(),api=roomApi(store,()=>now);
 const post=async(data,c)=>{const response=await api(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(c?{Authorization:'Bearer '+c.token}:{})},body:JSON.stringify({...data,...(c?{code:c.code}:{})})}));assert.equal(response.status,200);return response.json();};
 const clients=await Promise.all(Array.from({length:15},(_,i)=>post({type:'public',name:'Agent '+i})));
 assert.equal(new Set(clients.map(c=>c.code)).size,1);
 for(const client of clients)await post({type:'vote',map:'foundry'},client);
 now=t+10000;const warm=await Promise.all(clients.map(c=>post({type:'refresh',wire:1},c)));assert.ok(warm.every(r=>r.state.phase==='warmup'&&r.state.arena===TRAINING_MAP.id&&r.state.map==='foundry'&&r.state.endsAt===t+20000));
 now=t+20000;const live=await Promise.all(clients.map(c=>post({type:'refresh',wire:1},c)));assert.ok(live.every(r=>r.state.phase==='live'&&r.state.arena==='foundry'&&r.state.endsAt===t+620000));
 for(const client of clients)await post({type:'leave'},client);
 assert.equal((await store.read(clients[0].code)).room.players.length,0);
});

test('a majority can choose a recently repeated map and votes lock at the deadline',()=>{
 const room=newRoom('P00001',true);room.history=['foundry','foundry'];
 const players=Array.from({length:15},(_,i)=>addPlayer(room,{name:'Pilot '+i},t));
 for(const player of players.slice(0,8))command(room,player.token,{type:'vote',map:'foundry'},t+1);
 for(const player of players.slice(8))command(room,player.token,{type:'vote',map:'overlook'},t+1);
 advance(room,t+10000);assert.equal(room.map,'foundry');
 assert.throws(()=>command(room,players[0].token,{type:'vote',map:'overlook'},t+10000),/Voting is closed/);
});
