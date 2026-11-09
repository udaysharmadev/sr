import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {MemoryStore,D1Store,roomApi} from './api.mjs';
import {newRoom,addPlayer,command,advance,snapshot} from './rooms.mjs';
const at=1000000;
function arena(count=2){
  const r=newRoom('MULTIQ',false);r.settings.capacity=15;
  const clients=Array.from({length:count},(_,i)=>addPlayer(r,{name:'Pilot '+i,device:'device'+i},at));
  r.phase='live';r.endsAt=at+600000;for(const p of r.players)Object.assign(p,{shieldUntil:0,history:[]});
  return {r,clients};
}
test('15-player fire/melee burst retains a bounded replay window and explicit cursor gaps',()=>{
  const {r,clients}=arena(15);
  for(let round=0;round<14;round++){
    const time=at+round*580;advance(r,time);
    for(const c of clients){
      command(r,c.token,{type:'equip',equipment:'rifle'},time);
      command(r,c.token,{type:'shoot',seq:round+1,yaw:0,pitch:1.45},time);
      command(r,c.token,{type:'equip',equipment:'knife'},time);
      command(r,c.token,{type:'melee',seq:round+1,yaw:0,pitch:1.45},time);
    }
  }
  assert.ok(r.players.every(p=>p.alive));assert.equal(r.eventId,285);
  const all=snapshot(r,at+7540,0);assert.equal(all.events.length,256);assert.equal(all.eventGap,true);assert.equal(all.events[0].id,30);
  const resumed=snapshot(r,at+7540,250);assert.equal(resumed.events.length,35);assert.equal(resumed.eventGap,false);
  assert.equal(new Set(resumed.events.map(e=>e.id)).size,35);assert.deepEqual(snapshot(r,at+7540,285).events,[]);
  assert.equal(snapshot(r,at+7540).events.length,256,'old clients still receive a bounded full window');
  assert.equal(snapshot(r,at+7540,999999).events.length,256,'forged future cursor cannot move authority forward');
  advance(r,at+15541);assert.equal(r.events.length,0);assert.equal(snapshot(r,at+15541,0).eventGap,true);assert.equal(snapshot(r,at+15541,285).eventGap,false);
});

async function storage(kind){
  if(kind==='memory')return {store:new MemoryStore(),close(){}};
  const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0000_rooms.sql',import.meta.url),'utf8'));
  const binding={prepare(sql){return {bind(...args){return {async first(){await Promise.resolve();return db.prepare(sql).get(...args);},async all(){return {results:db.prepare(sql).all(...args)};},async run(){await Promise.resolve();return {meta:db.prepare(sql).run(...args)};}};}};}};
  return {store:new D1Store(binding),close:()=>db.close()};
}
for(const kind of ['memory','sqlite/D1'])test('15-client concurrent authority, duplicate packets, expiry and late joins on '+kind,async()=>{
  const backend=await storage(kind);let time=at;const api=roomApi(backend.store,()=>time),clients=[];
  const post=async(type,data={},c)=>{const res=await api(new Request('http://local.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(c?{Authorization:'Bearer '+c.token}:{})},body:JSON.stringify({...data,type,...(c?{code:c.code}:{})})}));return {status:res.status,...await res.json()};};
  const send=(c,type,data={})=>post(type,data,c);
  try{
    clients.push(...await Promise.all(Array.from({length:15},(_,i)=>post('public',{name:'Pilot '+i,device:kind+i}))));
    assert.ok(clients.every(c=>c.status===200));assert.equal(new Set(clients.map(c=>c.code)).size,1);
    const overflow=await post('public',{name:'Overflow'});assert.equal(overflow.status,200);assert.notEqual(overflow.code,clients[0].code);
    await send(overflow,'leave');
    const votes=await Promise.all(clients.map(c=>send(c,'vote',{map:'foundry'})));assert.ok(votes.every(v=>v.status===200));
    time+=12000;let views=await Promise.all(clients.map(c=>send(c,'refresh')));assert.ok(views.every(v=>v.status===200&&v.state.phase==='warmup'&&v.state.map==='foundry'));
    time+=10000;views=await Promise.all(clients.map(c=>send(c,'refresh')));assert.ok(views.every(v=>v.status===200&&v.state.phase==='live'));
    const end=views[0].state.endsAt;
    const packets=clients.flatMap(c=>[c,c].map(c=>({c,data:{seq:1,life:views[0].state.players.find(p=>p.id===c.id).life,yaw:0,pitch:1.45}})));
    const replies=await Promise.all(packets.map(p=>send(p.c,'shoot',p.data)));
    assert.ok(replies.every(v=>[200,503].includes(v.status)),'contention fails explicitly, never corrupts state');
    // Explicit identical-sequence retry is safe; the client transport never replays an uncertain mutation itself.
    for(const [i,reply] of replies.entries())if(reply.status===503)assert.equal((await send(packets[i].c,'shoot',packets[i].data)).status,200);
    const authoritative=(await send(clients[0],'refresh')).state;
    assert.equal(authoritative.players.length,15);assert.ok(authoritative.players.every(p=>p.shots===1));assert.equal(authoritative.events.filter(e=>e.type==='shot').length,15);
    assert.equal(authoritative.players.reduce((n,p)=>n+p.kills,0),0);assert.equal(authoritative.endsAt,end);
    for(const c of clients)assert.equal(JSON.stringify(authoritative).includes(c.token),false);
    const cursor=authoritative.eventId;const quiet=await Promise.all(clients.map(c=>send(c,'refresh',{eventAfter:cursor})));
    assert.ok(quiet.every(v=>v.status===200&&v.state.events.length===0&&v.state.eventGap===false));
    time+=30000;await Promise.all(clients.slice(2).map(c=>send(c,'refresh')));
    time+=16000;const survivor=await send(clients[2],'refresh');assert.equal(survivor.state.players.length,13);
    assert.equal((await send(clients[0],'refresh')).status,403);assert.equal((await send(clients[1],'refresh')).status,403);
    const late=await post('public',{name:'Late arrival'});assert.equal(late.status,200);clients.push(late);
    assert.notEqual(late.code,clients[2].code);assert.equal(late.state.phase,'waiting');assert.equal(late.state.endsAt,0);assert.equal(late.state.players.length,1);
    const me=late.state.players.find(p=>p.id===late.id);assert.equal(me.kills,0);assert.equal(me.health,100);assert.equal(me.grenades,1);assert.ok(me.shieldUntil>time);
  }finally{for(const c of clients)if(c.token)await send(c,'leave');backend.close();}
});
test('simultaneous opposed shots resolve one authoritative death and retries cannot double-score',async()=>{
  const store=new MemoryStore();let time=at;const api=roomApi(store,()=>time);
  const post=async(type,data={},c)=>{const reply=await api(new Request('http://local.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(c?{Authorization:'Bearer '+c.token}:{})},body:JSON.stringify({...data,type,...(c?{code:c.code}:{})})}));assert.equal(reply.status,200);return reply.json();};
  const a=await post('create',{name:'Alpha'}),b=await post('join',{name:'Bravo',code:a.code});const row=await store.read(a.code);
  row.room.phase='live';row.room.endsAt=time+600000;
  row.room.players.forEach((p,i)=>Object.assign(p,{x:24,y:0,z:20-i*2,eyeHeight:1.62,lean:0,shieldUntil:0,history:[]}));
  await store.write(a.code,row,row.room,time);
  const packets=[[a,{seq:1,yaw:0,pitch:0}],[b,{seq:1,yaw:Math.PI,pitch:0}]];
  await Promise.all(packets.map(([c,d])=>post('shoot',d,c)));
  await Promise.all(packets.map(([c,d])=>post('shoot',d,c)));
  for(const c of [a,b]){const {state}=await post('refresh',{},c);assert.equal(state.players.reduce((n,p)=>n+p.kills,0),1);assert.equal(state.players.reduce((n,p)=>n+p.deaths,0),1);assert.equal(state.events.filter(e=>e.type==='kill').length,1);}
  time+=2000;const state=(await post('refresh',{},a)).state;assert.ok(state.players.every(p=>p.alive&&p.health===100));
  await post('leave',{},a);await post('leave',{},b);
});
test('a thrown grenade still damages enemies after its owner leaves, preserving identity without a session token',()=>{
  for(const teamMode of [false,true]){
    const {r,clients}=arena(teamMode?4:2),owner=r.players[0];if(teamMode){r.settings.mode='tdm';r.players.forEach((p,i)=>p.team=i<2?'blue':'orange');}
    r.players.forEach((p,i)=>Object.assign(p,{x:24,y:0,z:20-i,eyeHeight:1.62,lean:0,shieldUntil:0}));
    command(r,clients[0].token,{type:'equip',equipment:'grenade'},at);command(r,clients[0].token,{type:'prime'},at);
    command(r,clients[0].token,{type:'throw',seq:1,yaw:0,pitch:0,holdMs:0},at);
    const g=r.grenades[0];assert.equal(g.ownerName,owner.name);assert.equal(JSON.stringify(g).includes(owner.token),false);
    Object.assign(g,{x:24,y:.12,z:18,vx:0,vy:0,vz:0});command(r,clients[0].token,{type:'leave'},at+1);advance(r,at+1800);
    const kills=r.events.filter(e=>e.type==='kill');assert.equal(kills.length,teamMode?2:1);assert.ok(kills.every(e=>e.attacker===owner.id&&e.attackerName===owner.name));
    if(teamMode){assert.equal(r.players.find(p=>p.team==='blue').health,100);assert.equal(r.scores.blue,2);}
    advance(r,at+1801);assert.equal(r.events.filter(e=>e.type==='kill').length,kills.length,'blast cannot apply twice');
  }
});
test('late active manual-team joins fill the available side; spectators never become host or consume a team slot',()=>{
  const r=newRoom('TEAMQA',false),host=addPlayer(r,{name:'Host'},at);
  command(r,host.token,{type:'settings',settings:{mode:'tdm',capacity:4,autoAssign:false,spectators:true}},at);
  const clients=[host,...Array.from({length:3},(_,i)=>addPlayer(r,{name:'Team '+i},at))];
  clients.forEach((c,i)=>{command(r,c.token,{type:'team',team:i<2?'blue':'orange'},at);command(r,c.token,{type:'ready',ready:true},at);});
  const spectator=addPlayer(r,{name:'Observer',spectator:true},at);command(r,host.token,{type:'start'},at);
  command(r,host.token,{type:'leave'},at+10);assert.notEqual(r.host,spectator.id);
  const late=addPlayer(r,{name:'Late teammate'},at+20),p=r.players.find(p=>p.id===late.id);assert.equal(p.team,'blue');assert.equal(p.alive,true);
  assert.equal(r.players.filter(p=>p.team==='blue'&&!p.spectator).length,2);assert.equal(r.players.filter(p=>p.team==='orange'&&!p.spectator).length,2);
  const viewer=r.players.find(p=>p.id===spectator.id);assert.equal(viewer.team,null);assert.equal(viewer.alive,false);assert.equal(viewer.x,undefined);
  const x=p.x;command(r,spectator.token,{type:'input',seq:1,frames:[{strafe:1,dt:.05}]},at+21);assert.equal(p.x,x);
});
