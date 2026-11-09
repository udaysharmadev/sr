import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi} from './api.mjs';
import {RIFLE_SKINS} from '../dist/rifle-skins.js';
import {finishOffer} from '../dist/armory-offer.js';
import {WEAPONS} from '../dist/weapons.js';
test('all40 skins enforce rifle-specific purchases/equip and canonical room finish propagation',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush40-'),saved=await localProfileStore(pathToFileURL(path+'/')),profiles=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,r=>resolveGuestProfile(saved.store,r));let cookie;
 const post=async(handler,data,token)=>{const response=await handler(new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;return {status:response.status,...await response.json()};};
 try{
  let current=await post(profiles,{type:'open'});const locked=RIFLE_SKINS.find(s=>s.weapon==='glacier');assert.equal((await post(profiles,{type:'buy',version:1,category:'wraps',item:'wrap-'+locked.id})).status,409);
  const row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.coins=10000000;row.profile.owned.push(...WEAPONS.map(w=>w.id));await saved.store.write(row.key,row,row.profile);current=await post(profiles,{type:'refresh'});
  let spent=0;
  for(const skin of RIFLE_SKINS){
   assert.equal(finishOffer(current.profile,skin.weapon,skin.id).action,'buy');
   const buy=await post(profiles,{type:'buy',version:current.version,category:'wraps',item:'wrap-'+skin.id,price:0});assert.equal(buy.status,200);spent+=skin.price;assert.equal(buy.profile.coins,10000000-spent);
   const wrong=skin.weapon==='sunbolt'?'glacier':'sunbolt';assert.equal(finishOffer(buy.profile,wrong,skin.id).action,'invalid');
   assert.equal((await post(profiles,{type:'finish',version:buy.version,weapon:wrong,finish:skin.id})).status,409);
   const finish=await post(profiles,{type:'finish',version:buy.version,weapon:skin.weapon,finish:skin.id});assert.equal(finish.status,200);
   current=await post(profiles,{type:'equip',version:finish.version,category:'skins',item:skin.weapon});assert.equal(current.status,200);
   const room=await post(rooms,{type:'create'});assert.equal(room.status,200);assert.equal(room.state.players[0].finish,skin.id);assert.equal(room.state.players[0].weapon,skin.weapon);await post(rooms,{type:'leave',code:room.code},room.token);
  }
 }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
