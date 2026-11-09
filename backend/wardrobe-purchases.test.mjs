import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {tmpdir} from 'node:os';
import {localProfileStore} from './local-profile-store.mjs';import {profileApi,resolveGuestProfile} from './profiles.mjs';import {roomApi} from './api.mjs';import {WARDROBE} from '../dist/wardrobe.js';
test('all24 wardrobe purchases/equips use canonical categories/prices and authenticated room appearance',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-wardrobe-'),saved=await localProfileStore(pathToFileURL(path+'/')),profiles=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,r=>resolveGuestProfile(saved.store,r));let cookie;
 const post=async(handler,data,token)=>{const response=await handler(new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;return {status:response.status,...await response.json()};};
 try{let current=await post(profiles,{type:'open'});const row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.coins=200000;await saved.store.write(row.key,row,row.profile);current=await post(profiles,{type:'refresh'});let spent=0;
 for(const item of WARDROBE){
  assert.equal((await post(profiles,{type:'equip',category:item.category,item:item.id,version:current.version})).status,409);
  const wrong=item.category==='clothing'?'accessories':'clothing';assert.equal((await post(profiles,{type:'buy',category:wrong,item:item.id,version:current.version})).status,400);
  const buy=await post(profiles,{type:'buy',category:item.category,item:item.id,price:0,version:current.version});assert.equal(buy.status,200);spent+=item.price;assert.equal(buy.profile.coins,200000-spent);
  assert.equal((await post(profiles,{type:'buy',category:item.category,item:item.id,version:buy.version})).status,409);
  current=await post(profiles,{type:'equip',category:item.category,item:item.id,version:buy.version});assert.equal(current.status,200);
  const room=await post(rooms,{type:'create',gear:{clothing:'forged'}});assert.equal(room.status,200);assert.equal(room.state.players[0].gear[item.category],item.id);await post(rooms,{type:'leave',code:room.code},room.token);
 }
 }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
