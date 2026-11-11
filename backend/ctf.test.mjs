import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlags,dropFlags,updateFlags} from './ctf.mjs';
import {MAPS} from '../dist/maps.js';

test('CTF pickup, contested capture, return, scoring and death drop',()=>{
  const flags=createFlags(MAPS[0]),scores={blue:0,orange:0};
  const blue={id:'b',team:'blue',alive:true,...flags.orange.home};
  const orange={id:'o',team:'orange',alive:true,...flags.blue.home};
  let events=updateFlags(flags,[blue,orange],scores,1);
  assert.equal(events.filter(e=>e.type==='flag-pickup').length,2);
  Object.assign(blue,flags.blue.home);Object.assign(orange,flags.orange.home);
  assert.equal(updateFlags(flags,[blue,orange],scores,2).some(e=>e.type==='flag-capture'),false);
  Object.assign(orange,{x:5,z:0});dropFlags(flags,orange,3);orange.alive=false;
  assert.equal(flags.blue.droppedAt,3);
  Object.assign(blue,flags.orange.home);updateFlags(flags,[blue,orange],scores,4);
  assert.equal(flags.blue.droppedAt,3);
  Object.assign(blue,{x:5,z:0});updateFlags(flags,[blue,orange],scores,5);
  Object.assign(blue,flags.blue.home);events=updateFlags(flags,[blue,orange],scores,6);
  assert.equal(events.filter(e=>e.type==='flag-capture').length,1);assert.equal(scores.blue,1);
  assert.equal(flags.orange.carrier,null);assert.equal(flags.blue.droppedAt,null);
  assert.equal(updateFlags(flags,[blue,orange],scores,7).filter(e=>e.type==='flag-capture').length,0);
});

test('dropped flags auto-return and spectators or elevated players cannot pick them up',()=>{
  const flags=createFlags(MAPS[0]),scores={blue:0,orange:0};
  const player={id:'b',team:'blue',alive:true,...flags.orange.home};
  updateFlags(flags,[player],scores,1);dropFlags(flags,player,10);player.alive=false;
  assert.equal(updateFlags(flags,[player],scores,15009).length,0);
  assert.equal(updateFlags(flags,[player],scores,15010)[0].type,'flag-return');
  player.alive=true;player.spectator=true;updateFlags(flags,[player],scores,15011);assert.equal(flags.orange.carrier,null);
  player.spectator=false;player.y=5;updateFlags(flags,[player],scores,15012);assert.equal(flags.orange.carrier,null);
  for(const map of MAPS)assert.ok(createFlags(map).blue.home.z>0 && createFlags(map).orange.home.z<0);
});

test('private room owns CTF teams, flag lifecycle, capture score and match end',async()=>{
  const {newRoom,addPlayer,command,advance,snapshot}=await import('./rooms.mjs');
  const t=1000000,room=newRoom('FLAGQA',false);
  const host=addPlayer(room,{name:'Host'},t);
  command(room,host.token,{type:'settings',settings:{mode:'ctf',capacity:4}},t);
  const clients=[host,...Array.from({length:3},(_,i)=>addPlayer(room,{name:'Player '+i},t))];
  assert.deepEqual(room.players.map(p=>p.team),['blue','orange','blue','orange']);
  for(const c of clients)command(room,c.token,{type:'ready',ready:true},t);
  command(room,host.token,{type:'start'},t);advance(room,t+10000);
  assert.equal(room.phase,'live');assert.ok(snapshot(room,t+10000).flags);
  const blue=room.players.find(p=>p.id===host.id),orange=room.players.find(p=>p.team==='orange');
  for(const p of room.players)Object.assign(p,{x:20,z:0,y:0,shieldUntil:0});
  for(let capture=1;capture<=3;capture++){
    Object.assign(blue,room.flags.orange.home);advance(room,t+10000+capture*10);
    assert.equal(room.flags.orange.carrier,blue.id);
    Object.assign(blue,room.flags.blue.home);advance(room,t+10001+capture*10);
    assert.equal(room.scores.blue,capture);
  }
  assert.equal(room.phase,'results');assert.equal(room.scores.orange,0);
  assert.ok(room.events.some(e=>e.type==='flag-capture'));
});

test('a disconnected CTF carrier drops the flag for its return timer',async()=>{
  const {newRoom,addPlayer,command,advance}=await import('./rooms.mjs');
  const t=2000000,r=newRoom('DROPQA',false),host=addPlayer(r,{name:'Host'},t);
  command(r,host.token,{type:'settings',settings:{mode:'ctf',capacity:4}},t);
  const clients=[host,...Array.from({length:3},(_,i)=>addPlayer(r,{name:'Player '+i},t))];
  for(const c of clients)command(r,c.token,{type:'ready',ready:true},t);
  command(r,host.token,{type:'start'},t);advance(r,t+10000);
  const player=r.players.find(p=>p.id===host.id);for(const p of r.players)Object.assign(p,{x:20,z:0,y:0});
  Object.assign(player,r.flags.orange.home);advance(r,t+10001);assert.equal(r.flags.orange.carrier,host.id);
  Object.assign(player,{x:3,z:3});command(r,host.token,{type:'leave'},t+10002);
  assert.equal(r.flags.orange.carrier,null);assert.equal(r.flags.orange.droppedAt,t+10002);
  advance(r,t+25002);assert.equal(r.flags.orange.droppedAt,null);
});

test('an authoritative sniper kill drops the carried flag without awarding capture points or retaining it on respawn',async()=>{
  const {newRoom,addPlayer,command,advance}=await import('./rooms.mjs');
  const t=3000000,r=newRoom('HITFLG',false),host=addPlayer(r,{name:'Carrier'},t);
  command(r,host.token,{type:'settings',settings:{mode:'ctf',capacity:4}},t);
  const clients=[host,...Array.from({length:3},(_,i)=>addPlayer(r,{name:'Pilot '+i},t))];
  for(const c of clients)command(r,c.token,{type:'ready',ready:true},t);
  command(r,host.token,{type:'start'},t);advance(r,t+10000);
  const carrier=r.players[0],attacker=r.players[1],time=t+10002;
  for(const p of r.players)Object.assign(p,{x:-24,z:0,y:0,history:[],shieldUntil:0});
  Object.assign(carrier,r.flags.orange.home,{shieldUntil:time+1000});
  advance(r,time);assert.equal(r.flags.orange.carrier,carrier.id);assert.equal(carrier.shieldUntil,0,'flag pickup ends protection');
  Object.assign(carrier,{x:24,z:18,eyeHeight:1.62});Object.assign(attacker,{x:24,z:20,eyeHeight:1.62});
  const shot={type:'shoot',seq:1,life:attacker.life,yaw:0,pitch:0};
  command(r,clients[1].token,shot,time+1);
  assert.equal(carrier.alive,false);assert.equal(carrier.deaths,1);assert.equal(attacker.kills,1);
  assert.deepEqual(r.scores,{blue:0,orange:0});assert.equal(r.flags.orange.carrier,null);
  assert.equal(r.flags.orange.droppedAt,time+1);assert.equal(r.flags.orange.x,24);assert.equal(r.flags.orange.z,18);
  command(r,clients[1].token,shot,time+2);assert.equal(carrier.deaths,1,'retry cannot kill twice');
  attacker.x=-24;const life=carrier.life;advance(r,time+2001);
  assert.equal(carrier.alive,true);assert.equal(carrier.life,life+1);assert.equal(carrier.health,100);
  assert.notEqual(r.flags.orange.carrier,carrier.id);assert.equal(r.scores.blue,0);
});

test('a nearby flag cannot be picked up through the actual Crosswind balcony rail',async()=>{
  const {newRoom,addPlayer,command,advance}=await import('./rooms.mjs');
  const t=4000000,r=newRoom('RAILQA',false),host=addPlayer(r,{name:'Pilot'},t);
  command(r,host.token,{type:'settings',settings:{mode:'ctf',capacity:4}},t);
  r.phase='live';r.endsAt=t+600000;r.flags=createFlags(MAPS[0]);
  const p=r.players[0];Object.assign(p,{x:1.2,y:3.2,z:4.8,shieldUntil:0});
  Object.assign(r.flags.orange,{x:2.3,y:3.2,z:4.8,droppedAt:t});
  advance(r,t+1);assert.equal(r.flags.orange.carrier,null,'rail blocks reach despite 1.1 metre distance');
  p.x=2.3;advance(r,t+2);assert.equal(r.flags.orange.carrier,p.id,'same-side reach succeeds');
});
