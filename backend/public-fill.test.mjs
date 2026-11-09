import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,advance,command} from './rooms.mjs';
import {MemoryStore,roomApi} from './api.mjs';
const at=1000000;
test('public voting requires fifteen and returns to waiting on departure or expiry before match',()=>{
 const r=newRoom('P00000',true),clients=[];
 for(let i=0;i<14;i++){clients.push(addPlayer(r,{name:'Player '+i},at));assert.equal(r.phase,'waiting');}
 clients.push(addPlayer(r,{name:'Player 14'},at));assert.equal(r.phase,'vote');assert.equal(r.endsAt,at+10000);
 command(r,clients[0].token,{type:'leave'},at+1);assert.equal(r.phase,'waiting');assert.equal(r.endsAt,0);
 clients[0]=addPlayer(r,{name:'Replacement'},at+2);assert.equal(r.phase,'vote');assert.equal(r.endsAt,at+10002);
 advance(r,at+10002);assert.equal(r.phase,'warmup');assert.equal(r.endsAt,at+20002);
 command(r,clients[1].token,{type:'leave'},at+10003);assert.equal(r.phase,'waiting');advance(r,at+25000);assert.equal(r.phase,'waiting');
});
test('full or already-started public lobby routes extra joins to another waiting room',async()=>{
 const store=new MemoryStore(),api=roomApi(store,()=>at);
 const post=async data=>{const response=await api(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));assert.equal(response.status,200);return response.json();};
 const clients=await Promise.all(Array.from({length:16},(_,i)=>post({type:'public',name:'Pilot '+i})));
 const groups=Object.groupBy(clients,c=>c.code),sizes=Object.values(groups).map(a=>a.length).sort((a,b)=>a-b);assert.deepEqual(sizes,[1,15]);
 const full=Object.values(groups).find(a=>a.length===15);assert.equal((await store.read(full[0].code)).room.phase,'vote');
});
