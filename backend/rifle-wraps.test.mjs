import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {rifle,setRifleFinish,disposeRifle} from '../dist/rifle-models.js';
import {WEAPONS} from '../dist/weapons.js';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi} from './api.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
test('every rifle supports distinct textured wraps, clone-safe materials and exact field restoration',()=>{
 for(const spec of WEAPONS){const root=rifle(new T.Group(),spec.id,false);let mat;root.traverse(o=>{if(o.material?.name==='rifle-stock'||!mat&&o.material?.name==='rifle-steel')mat=o.material;});const field=mat.map,color=mat.color.getHex(),patterns=[];
  for(const finish of ['digital','tiger','alpine']){setRifleFinish(root,finish);patterns.push(Array.from(mat.map.image.data).join(','));assert.doesNotThrow(()=>root.clone());const wrapped=mat.map;let freed=0;wrapped.addEventListener('dispose',()=>freed++);setRifleFinish(root,'field');assert.equal(freed,1);assert.equal(mat.map,field);assert.equal(mat.color.getHex(),color);}
  assert.equal(new Set(patterns).size,3);setRifleFinish(root,'digital');let freed=0;field.addEventListener('dispose',()=>freed++);disposeRifle(root);assert.equal(freed,1);
 }
});
test('wrap purchases are canonical, locked finishes denied and equipped finish reaches room snapshots',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-wrap-'),saved=await localProfileStore(pathToFileURL(path+'/')),api=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,r=>resolveGuestProfile(saved.store,r));
 let cookie;
 const call=async(handler,data,token)=>{const response=await handler(new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {status:response.status,...await response.json()};};
 try{await call(api,{type:'open'});let row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.coins=5000;await saved.store.write(row.key,row,row.profile);
 assert.equal((await call(api,{type:'finish',version:2,weapon:'sunbolt',finish:'digital'})).status,409);
 const buy=await call(api,{type:'buy',version:2,category:'wraps',item:'wrap-digital',price:0});assert.equal(buy.status,200);assert.equal(buy.profile.coins,2500);
 assert.equal((await call(api,{type:'finish',version:3,weapon:'sunbolt',finish:'digital'})).status,200);
 const room=await call(rooms,{type:'create'});assert.equal(room.state.players[0].finish,'digital');
 assert.equal((await call(api,{type:'finish',version:4,weapon:'glacier',finish:'digital'})).status,409);

 row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.coins=100000;await saved.store.write(row.key,row,row.profile);
 for(const finish of ['ember-drake','ivory-relic','carbon-circuit']){
  const current=await call(api,{type:'refresh'});
  assert.equal((await call(api,{type:'finish',version:current.version,weapon:'sunbolt',finish})).status,409);
  const purchase=await call(api,{type:'buy',version:current.version,category:'wraps',item:'wrap-'+finish});assert.equal(purchase.status,200);
  const equip=await call(api,{type:'finish',version:purchase.version,weapon:'sunbolt',finish});assert.equal(equip.status,200);
  const view=await call(rooms,{type:'refresh',code:room.code},room.token);assert.equal(view.state.players[0].finish,finish);
 }
 await call(rooms,{type:'leave',code:room.code},room.token);
 }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
