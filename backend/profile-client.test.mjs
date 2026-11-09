import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi} from './profiles.mjs';
import {createProfileClient} from '../dist/profile-client.js';
async function fixture(run){
  const path=await mkdtemp(tmpdir()+'/rush-client-'),saved=await localProfileStore(pathToFileURL(path+'/'));
  let clock=1794000000000,cookie='',failure=null;const api=profileApi(saved.store,()=>clock,saved.rooms),calls=[];
  const storageMap=new Map(),storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,String(v))};
  const fetcher=async(url,init)=>{
    const body=JSON.parse(init.body);calls.push(body);const fail=failure;failure=null;
    if(fail==='before')throw new TypeError('Offline');
    const response=await api(new Request('http://qa.test'+url,{...init,headers:{...init.headers,...(cookie?{cookie}:{})}}));
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    if(fail==='after')throw new TypeError('Response lost');return response;
  };
  try{await run({storage,storageMap,fetcher,calls,fail:kind=>failure=kind,clearCookie:()=>cookie='',advance:ms=>clock+=ms});}
  finally{saved.close();await rm(path,{recursive:true,force:true});}
}
test('profile client backs up exact legacy save once and restores server truth on reload without importing editable currency',()=>fixture(async({storage,fetcher,calls})=>{
  const old={name:'Legacy pilot',coins:999999,xp:999999,equipped:{skins:'cinder',clothing:'shadow'}};const raw=JSON.stringify(old);storage.setItem('sr.profile.v1',raw);
  let profile;const client=createProfileClient(p=>{profile=p;storage.setItem('sr.profile.v1',JSON.stringify(p));},{storage,fetcher});
  storage.setItem('sr.profile.v1','cached UI update');const opened=await client.open(old);
  assert.equal(storage.getItem('sr.profile.legacy.v1'),raw);assert.equal(opened.migrated,true);assert.equal(profile.coins,0);assert.equal(profile.xp,0);assert.equal(profile.name,old.name);assert.equal(profile.equipped.skins,'sunbolt');assert.equal(profile.equipped.clothing,'cobalt');
  await client.mutate('dailycoins');assert.equal(profile.coins,200);
  const reloaded=createProfileClient(p=>profile=p,{storage,fetcher});const restored=await reloaded.open({name:'Wrong cache'});assert.equal(restored.migrated,false);assert.equal(profile.coins,200);assert.equal(profile.name,old.name);assert.equal(storage.getItem('sr.profile.legacy.v1'),raw);assert.equal(calls.filter(c=>c.type==='open').length,2);
}));
test('lost response refreshes committed balance without replay and serialized actions spend the latest version',()=>fixture(async({storage,fetcher,calls,fail})=>{
  let profile;const client=createProfileClient(p=>profile=p,{storage,fetcher});await client.open({name:'Lost ack'});
  fail('after');await assert.rejects(client.mutate('dailycoins'),/Response lost/);assert.equal(profile.coins,200);assert.equal(calls.filter(c=>c.type==='dailycoins').length,1);
  await Promise.all([client.mutate('equip',{category:'clothing',item:'cobalt'}),client.mutate('equip',{category:'accessories',item:'sky'})]);assert.equal(profile.equipped.accessories,'sky');
  const equip=calls.filter(c=>c.type==='equip');assert.equal(equip[1].version,equip[0].version+1);
}));
test('other tab conflicts refresh the canonical save and guest-cookie expiry never silently opens another identity',()=>fixture(async({storage,fetcher,calls,clearCookie})=>{
  let pa,pb;const a=createProfileClient(p=>pa=p,{storage,fetcher}),b=createProfileClient(p=>pb=p,{storage,fetcher});await a.open({name:'Shared save'});await b.open({});
  await a.mutate('dailycoins');await assert.rejects(b.mutate('dailycoins'),e=>e.status===409);assert.equal(pb.coins,200);assert.equal(pa.id,pb.id);
  const opens=calls.filter(c=>c.type==='open').length;clearCookie();await assert.rejects(a.refresh(),e=>e.status===401);assert.equal(calls.filter(c=>c.type==='open').length,opens);
}));
test('profile UI time follows server time and pending reward claim discovery is idempotent',()=>fixture(async({storage,fetcher})=>{
  let elapsed=0,profile;const client=createProfileClient(p=>profile=p,{storage,fetcher,read:()=>elapsed});await client.open({name:'Clock save'});assert.equal(client.now(),1794000000000);elapsed+=1234;assert.equal(client.now(),1794000001234);
  assert.deepEqual(await client.claimRewards(),{rounds:0,xp:0,coins:0});assert.equal(profile.coins,0);
}));

test('known save with missing cookie requires recovery; restoring updates the cached identity without saving the key',()=>fixture(async({storage,storageMap,fetcher,clearCookie})=>{
  let profile;const client=createProfileClient(p=>profile=p,{storage,fetcher});const opened=await client.open({name:'Restore client'});await client.mutate('dailycoins');
  const generated=await client.mutate('recoverykey'),code=generated.result.recoveryCode;
  clearCookie();const reloaded=createProfileClient(p=>profile=p,{storage,fetcher});
  await assert.rejects(reloaded.open({name:'Must not replace'}),e=>e.status===401&&e.recoveryRequired===true);
  const recovered=await reloaded.recover(code);assert.equal(recovered.profile.id,opened.profile.id);assert.equal(profile.coins,200);assert.equal(storage.getItem('sr.profile.server.v1'),opened.profile.id);
  assert.equal(JSON.stringify([...storageMap.values()]).includes(code),false);assert.equal(Object.hasOwn(profile,'recoveryHash'),false);assert.equal(profile.recoveryReady,false);
  await reloaded.refresh();assert.equal(profile.name,'Restore client');
}));
