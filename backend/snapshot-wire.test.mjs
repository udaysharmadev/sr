import test from 'node:test';
import assert from 'node:assert/strict';
import {packSnapshot,unpackSnapshot} from '../dist/snapshot-wire.js';
import {newRoom,addPlayer,command,snapshot} from './rooms.mjs';
import {MemoryStore,roomApi} from './api.mjs';
const at=1000000;
function fixture(){const room=newRoom('WIREQA',false);room.settings.capacity=15;const clients=Array.from({length:15},(_,i)=>addPlayer(room,{name:'Pilot '+i},at));return {room,clients};}
test('compact waiting/results snapshots preserve every player field, null and zero exactly',()=>{
  const {room,clients}=fixture();for(const phase of ['waiting','results']){room.phase=phase;const state=snapshot(room,at);assert.deepEqual(unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(state,clients[0].id)))),state);}
});
test('live payload preserves own prediction exactly and required remote pose/ranking without detailed career counters',()=>{
  const {room,clients}=fixture();room.phase='live';room.endsAt=at+600000;
  const p=room.players[0];Object.assign(p,{x:1.123456789012,yaw:-2.123456789012,lean:.15,health:50});
  const state=snapshot(room,at),wire=packSnapshot(state,p.id),decoded=unpackSnapshot(wire);
  assert.deepEqual(decoded.players.find(q=>q.id===p.id),state.players.find(q=>q.id===p.id));
  for(const other of decoded.players.filter(q=>q.id!==p.id)){
    const original=state.players.find(q=>q.id===other.id);
    for(const key of ['id','name','gear','x','y','z','yaw','pitch','life','grounded','eyeHeight','shieldUntil','equipment','kills','deaths','shots','hits','bestStreak'])assert.deepEqual(other[key],original[key],key);
    assert.equal(Object.hasOwn(other,'weaponStats'),false);assert.equal(Object.hasOwn(other,'credit'),false);
  }
  const reduction=1-JSON.stringify(wire).length/JSON.stringify(state).length;assert.ok(reduction>.5,'live snapshot must shrink by more than50%');
});
test('spectators retain absent coordinates and full results statistics return after active play',()=>{
  const {room,clients}=fixture();room.settings.spectators=true;const viewer=addPlayer(room,{spectator:true},at);
  room.phase='live';const live=unpackSnapshot(packSnapshot(snapshot(room,at),viewer.id));const spectator=live.players.find(p=>p.id===viewer.id);
  assert.equal(Object.hasOwn(spectator,'x'),false);assert.equal(spectator.team,null);assert.equal(spectator.alive,false);
  room.phase='results';room.players[0].weaponStats.sunbolt={shots:9,hits:3,kills:3,headshots:2};
  assert.deepEqual(unpackSnapshot(packSnapshot(snapshot(room,at),viewer.id)),snapshot(room,at));
});
test('API negotiated wire format authenticates own prediction and keeps legacy responses unchanged',async()=>{
  const store=new MemoryStore(),api=roomApi(store,()=>at);
  const post=async(data,c)=>{const response=await api(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(c?{Authorization:'Bearer '+c.token}:{})},body:JSON.stringify({...data,...(c?{code:c.code}:{})})}));assert.equal(response.status,200);return response.json();};
  const a=await post({type:'create',wire:1}),b=await post({type:'join',code:a.code});
  await post({type:'ready',ready:true},a);await post({type:'ready',ready:true},b);await post({type:'start'},a);
  const compact=await post({type:'refresh',wire:1,ownId:b.id},a),plain=await post({type:'refresh'},a);
  assert.equal(compact.state.wire,1);assert.equal(plain.state.wire,undefined);
  const decoded=unpackSnapshot(compact.state);assert.ok(Object.hasOwn(decoded.players.find(p=>p.id===a.id),'ammo'));assert.equal(Object.hasOwn(decoded.players.find(p=>p.id===b.id),'ammo'),false);
  for(const c of [a,b])assert.equal(JSON.stringify(compact.state).includes(c.token),false);
  assert.throws(()=>unpackSnapshot({wire:2}),/Reload/);
});
