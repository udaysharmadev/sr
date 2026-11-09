import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi,MemoryStore} from './api.mjs';
test('persistent guest economy uses server time, private cookie and CAS against duplicate/concurrent rewards',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-profile-'),directory=pathToFileURL(path+'/');let saved=await localProfileStore(directory),time=1794000000000,api=profileApi(saved.store,()=>time);
  const send=async(data,cookie,extra={})=>{
    const response=await api(new Request('https://arena.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...extra},body:JSON.stringify(data)}));
    return {status:response.status,cookie:response.headers.get('set-cookie'),...await response.json()};
  };
  try{
    const opened=await send({type:'open',name:'Saved sniper',coins:999999,gems:999999,xp:999999});
    assert.equal(opened.status,200);assert.equal(opened.profile.coins,0);assert.equal(opened.profile.gems,0);assert.equal(opened.profile.xp,0);
    assert.match(opened.cookie,/HttpOnly/);assert.match(opened.cookie,/SameSite=Strict/);assert.match(opened.cookie,/Secure/);const cookie=opened.cookie.split(';')[0];
    assert.equal(JSON.stringify(opened.profile).includes(cookie.split('=')[1]),false);
    const duplicates=await Promise.all([send({type:'dailycoins',version:1,at:time+864000000},cookie),send({type:'dailycoins',version:1},cookie)]);
    assert.deepEqual(duplicates.map(r=>r.status).sort(),[200,409]);let current=await send({type:'refresh'},cookie);assert.equal(current.profile.coins,200);assert.equal(current.version,2);
    assert.equal((await send({type:'dailycoins',version:2,at:time+86400000},cookie)).status,409,'client cannot advance reward day');
    const spin=await send({type:'spin',kind:'golden',version:2,index:5,amount:99999},cookie);assert.equal(spin.status,200);assert.ok([5,10,15,20,30,50,25].includes(spin.result.amount));
    assert.equal(spin.profile.gems,spin.result.amount);current=spin;
    assert.equal((await send({type:'spin',kind:'golden',version:2},cookie)).status,409,'lost-ack replay rejected');
    const restored=await send({type:'open'},cookie);assert.deepEqual(restored.profile.wheels.pending,spin.result);assert.equal(restored.cookie,null);
    const collect=await send({type:'collect',version:current.version},cookie);assert.equal(collect.status,200);assert.equal(collect.profile.gems,spin.result.amount);
    assert.equal((await send({type:'exchange',pack:'vault',version:collect.version,gems:9999},cookie)).status,409);
    assert.equal((await send({type:'refresh'},'sr_guest=forged')).status,401);
    assert.equal((await send({type:'refresh'},cookie,{origin:'https://other.test'})).status,403);
    saved.close();saved=await localProfileStore(directory);api=profileApi(saved.store,()=>time);
    current=await send({type:'refresh'},cookie);assert.equal(current.profile.id,opened.profile.id);assert.equal(current.profile.coins,200);assert.equal(current.profile.gems,spin.result.amount);
    time+=86400000;const next=await send({type:'dailycoins',version:current.version},cookie);assert.equal(next.status,200);assert.equal(next.profile.coins,400);
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});

test('public rewards use authenticated room membership and authoritative stats once, excluding other guests/private/spectators',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-reward-'),saved=await localProfileStore(pathToFileURL(path+'/')),rooms=new MemoryStore();
  const time=1794000000000,profiles=profileApi(saved.store,()=>time,rooms),matches=roomApi(rooms,()=>time,request=>resolveGuestProfile(saved.store,request));
  const send=async(handler,data,cookie,token)=>{
    const response=await handler(new Request('https://arena.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));return {status:response.status,cookie:response.headers.get('set-cookie'),...await response.json()};
  };
  try{
    const a=await send(profiles,{type:'open',name:'Alpha'}),b=await send(profiles,{type:'open',name:'Bravo'}),ca=a.cookie.split(';')[0],cb=b.cookie.split(';')[0];
    const joined=await send(matches,{type:'public',name:'Alpha',guestProfileId:b.profile.id},ca);assert.equal(joined.status,200);
    let row=await rooms.read(joined.code);assert.equal(row.room.players[0].guestProfileId,a.profile.id,'forged profile binding ignored');assert.equal(JSON.stringify(joined.state).includes('guestProfileId'),false);
    row.room.phase='results';row.room.finishedAt=time;Object.assign(row.room.players[0],{kills:4,deaths:2,bestStreak:3,shots:8,hits:4,headshots:2,weaponStats:{sunbolt:{shots:8,hits:4,kills:4,headshots:2}}});await rooms.write(joined.code,row,row.room,time);
    const request={type:'reward',version:1,code:joined.code,roomToken:joined.token,kills:9999,coins:999999};
    assert.equal((await send(profiles,request,cb)).status,409,'other guest cannot claim even with leaked room token');
    const attempts=await Promise.all([send(profiles,request,ca),send(profiles,request,ca)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
    let current=await send(profiles,{type:'refresh'},ca);assert.equal(current.profile.kills,4);assert.equal(current.profile.coins,100);assert.equal(current.profile.xp,400);assert.equal(current.profile.rounds,1);assert.equal(current.profile.mastery.sunbolt.kills,4);
    assert.equal((await send(profiles,{...request,version:current.version},ca)).status,409,'new-version replay still cannot duplicate match receipt');
    row=await rooms.read(joined.code);row.room.round++;row.room.public=false;await rooms.write(joined.code,row,row.room,time);
    assert.equal((await send(profiles,{...request,version:current.version},ca)).status,409);
    row=await rooms.read(joined.code);row.room.public=true;row.room.players[0].spectator=true;await rooms.write(joined.code,row,row.room,time);
    assert.equal((await send(profiles,{...request,version:current.version},ca)).status,409);
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});

test('server wardrobe enforces catalog prices, owned categories, earned badges/finishes and authenticated room appearance',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-wardrobe-'),saved=await localProfileStore(pathToFileURL(path+'/'));
  const profiles=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,req=>resolveGuestProfile(saved.store,req));
  const send=async(handler,data,cookie)=>{const request=new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});const response=await handler(request);return {status:response.status,cookie:response.headers.get('set-cookie'),...await response.json()};};
  try{
    const opened=await send(profiles,{type:'open',name:'Verified pilot'}),cookie=opened.cookie.split(';')[0];
    const request=new Request('http://qa.test/api/profile',{headers:{cookie}});let row=await resolveGuestProfile(saved.store,request);
    row.profile.coins=2000;assert.equal(await saved.store.write(row.key,row,row.profile),true);let version=2;
    const purchase={type:'buy',category:'clothing',item:'ember',price:0,version};
    const bought=await Promise.all([send(profiles,purchase,cookie),send(profiles,purchase,cookie)]);assert.deepEqual(bought.map(x=>x.status).sort(),[200,409]);
    let current=await send(profiles,{type:'refresh'},cookie);assert.equal(current.profile.coins,800);assert.equal(current.profile.owned.filter(x=>x==='ember').length,1);version=current.version;
    assert.equal((await send(profiles,{type:'equip',category:'shoes',item:'ember',version},cookie)).status,400);
    assert.equal((await send(profiles,{type:'equip',category:'clothing',item:'shadow',version},cookie)).status,409);
    assert.equal((await send(profiles,{type:'buy',category:'clothing',item:'shadow',coins:999999,version},cookie)).status,409);
    assert.equal((await send(profiles,{type:'badge',badge:'weapon-master',version},cookie)).status,409);
    assert.equal((await send(profiles,{type:'finish',weapon:'sunbolt',finish:'gold',mastery:{kills:9999},version},cookie)).status,409);
    const equip=await send(profiles,{type:'equip',category:'clothing',item:'ember',version},cookie);assert.equal(equip.status,200);
    const joined=await send(rooms,{type:'create',name:'Forged name',badge:'weapon-master',gear:{clothing:'shadow'},weapon:'prism'},cookie);assert.equal(joined.status,200);
    const p=joined.state.players[0];assert.equal(p.name,'Verified pilot');assert.equal(p.gear.clothing,'ember');assert.equal(p.badge,null);assert.equal(p.weapon,'sunbolt');
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
