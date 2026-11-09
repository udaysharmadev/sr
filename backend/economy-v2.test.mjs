import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile,migrateRifleEconomy} from './profiles.mjs';
import {roomApi} from './api.mjs';
import {spinWheel,collectWheelPrize,EXTRA_SPIN_GEMS,wheelStatus} from '../dist/economy.js';
import {awardRound,weeklyProgress,weekKey,WEEKLY_CHALLENGES} from '../dist/progression.js';
import {CATALOG} from '../dist/catalog.js';

test('rifle migration preserves active rifle, deliberate purchases, career and wardrobe, and runs once',()=>{
 const p={owned:[...CATALOG.skins.map(x=>x[0]),'ember'],equipped:{skins:'prism'},purchasedRifles:['ivory'],coins:12345,kills:45};
 assert.equal(migrateRifleEconomy(p),true);assert.deepEqual(p.owned,['sunbolt','prism','ivory','ember']);assert.equal(p.coins,12345);assert.equal(p.kills,45);assert.equal(migrateRifleEconomy(p),false);
});
test('paid coin spin explicitly consumes gems, preserves free eligibility, and cannot reroll pending rewards or pay for gems',()=>{
 const at=Date.UTC(2026,10,9),p={gems:75};
 const prize=spinWheel(p,'daily',at,()=>.999,true);assert.equal(prize.cost,EXTRA_SPIN_GEMS);assert.equal(prize.amount,10000);assert.equal(p.gems,50);assert.equal(p.coins,10000);
 assert.equal(spinWheel(p,'daily',at,()=>0,true),null);assert.equal(p.gems,50);collectWheelPrize(p);assert.equal(wheelStatus(p,'daily',at).ready,true);
 assert.equal(spinWheel(p,'golden',at,()=>0,true),null);assert.equal(p.gems,50);
 assert.ok(spinWheel(p,'daily',at,()=>0));collectWheelPrize(p);assert.equal(wheelStatus(p,'daily',at).ready,false);assert.ok(spinWheel(p,'daily',at,()=>0,true));assert.equal(p.gems,25);
 collectWheelPrize(p);p.gems=24;assert.equal(spinWheel(p,'daily',at,()=>0,true),null);assert.equal(p.gems,24);
});
test('weekly rewards count verified public receipts once, reset on Monday and ignore older weeks',()=>{
 const at=Date.UTC(2026,10,9,12),p={};assert.equal(weekKey(at),'2026-11-09');assert.equal(weekKey(at+6*86400000),'2026-11-09');
 for(let i=0;i<5;i++)assert.ok(awardRound(p,{roundId:'w:'+i,completed:true,kills:30,headshots:10,win:true,finishedAt:at+i*1000},true).applied);
 assert.deepEqual(weeklyProgress(p,at).claimed,WEEKLY_CHALLENGES.map(x=>x.id));const coins=p.coins,gems=p.gems;
 assert.equal(awardRound(p,{roundId:'w:4',completed:true,kills:999,finishedAt:at},true).applied,false);assert.equal(p.coins,coins);assert.equal(p.gems,gems);
 awardRound(p,{roundId:'next',completed:true,kills:1,finishedAt:at+7*86400000},true);const next=structuredClone(p.weekly);assert.equal(next.kills,1);
 awardRound(p,{roundId:'old',completed:true,kills:150,headshots:50,finishedAt:at},true);assert.deepEqual(p.weekly,next);
 const blank={};awardRound(blank,{roundId:'private',completed:true,kills:200,finishedAt:at},false);assert.equal(blank.weekly,undefined);
});
test('authenticated rifle purchases charge canonical prices once and deny forged locked loadouts',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-economy2-'),saved=await localProfileStore(pathToFileURL(path+'/'));
 const api=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,r=>resolveGuestProfile(saved.store,r));
 const call=async(handler,data,cookie,token)=>{const response=await handler(new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));return {status:response.status,cookie:response.headers.get('set-cookie'),...await response.json()};};
 try{
  const opened=await call(api,{type:'open',weapon:'ivory',coins:999999});const cookie=opened.cookie.split(';')[0];assert.deepEqual(opened.profile.owned,['sunbolt','cobalt','sky','runner']);assert.equal(opened.profile.equipped.skins,'sunbolt');
  let row=await resolveGuestProfile(saved.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.coins=10000;assert.ok(await saved.store.write(row.key,row,row.profile));
  const created=await call(rooms,{type:'create'},cookie);assert.equal(created.status,200);
  const other=await call(api,{type:'open'}),joined=await call(rooms,{type:'join',code:created.code},other.cookie.split(';')[0]);assert.equal(joined.status,200);
  await call(rooms,{type:'ready',code:created.code,ready:true},cookie,created.token);await call(rooms,{type:'ready',code:created.code,ready:true},other.cookie.split(';')[0],joined.token);await call(rooms,{type:'start',code:created.code},cookie,created.token);
  assert.equal((await call(rooms,{type:'loadout',code:created.code,weapon:'glacier'},cookie,created.token)).status,409);
  const attempts=await Promise.all([call(api,{type:'buy',version:2,category:'skins',item:'glacier',price:0},cookie),call(api,{type:'buy',version:2,category:'skins',item:'glacier',price:0},cookie)]);assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
  const current=await call(api,{type:'refresh'},cookie);assert.equal(current.profile.coins,0);assert.equal(current.profile.purchasedRifles[0],'glacier');assert.equal((await call(rooms,{type:'loadout',code:created.code,weapon:'glacier'},cookie,created.token)).status,200);
  assert.equal((await call(api,{type:'equip',version:current.version,category:'skins',item:'ivory'},cookie)).status,409);
 }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
