import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {tmpdir} from 'node:os';
import {localProfileStore} from './local-profile-store.mjs';import {profileApi,resolveGuestProfile} from './profiles.mjs';import {roomApi} from './api.mjs';
import {finishOffer} from '../dist/armory-offer.js';import {hasGoldFinish} from '../dist/progression.js';
test('Gold requires an owned rifle, costs canonical75k once, and replicates only that rifle entitlement',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-gold-buy-'),saved=await localProfileStore(pathToFileURL(path+'/')),profiles=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,r=>resolveGuestProfile(saved.store,r));let cookie;
 const post=async(handler,data,token)=>{const response=await handler(new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;return {status:response.status,...await response.json()};};
 try{let current=await post(profiles,{type:'open'});assert.equal(finishOffer(current.profile,'glacier','gold').action,'rifle');
  assert.equal((await post(profiles,{type:'buy',category:'goldFinishes',item:'gold-glacier',version:1})).status,409);
  const row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.coins=200000;await saved.store.write(row.key,row,row.profile);current=await post(profiles,{type:'refresh'});
  const attempts=await Promise.all([1,2].map(()=>post(profiles,{type:'buy',category:'goldFinishes',item:'gold-sunbolt',price:0,version:current.version})));assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
  current=await post(profiles,{type:'refresh'});assert.equal(current.profile.coins,125000);assert.equal(hasGoldFinish(current.profile,'sunbolt'),true);assert.equal(hasGoldFinish(current.profile,'glacier'),false);assert.equal(finishOffer(current.profile,'sunbolt','gold').action,'equip');
  assert.equal((await post(profiles,{type:'buy',category:'goldFinishes',item:'gold-sunbolt',version:current.version})).status,409);
  current=await post(profiles,{type:'finish',weapon:'sunbolt',finish:'gold',version:current.version});assert.equal(current.status,200);
  const room=await post(rooms,{type:'create'});assert.equal(room.state.players[0].finish,'gold');await post(rooms,{type:'leave',code:room.code},room.token);
  const before=current.profile.coins;assert.equal((await post(profiles,{type:'finish',weapon:'glacier',finish:'gold',version:current.version})).status,409);current=await post(profiles,{type:'refresh'});assert.equal(current.profile.coins,before);
 }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
test('earned Gold remains free and offers equip without a purchase',()=>{
 const p={owned:['sunbolt'],equipped:{skins:'sunbolt',finishes:{}},mastery:{sunbolt:{kills:500,headshots:100,xp:50000}}};assert.equal(hasGoldFinish(p,'sunbolt'),true);assert.equal(finishOffer(p,'sunbolt','gold').action,'equip');assert.equal(hasGoldFinish(p,'glacier'),false);
});
