import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS,activeEvents,eliminationXpMultiplier} from '../dist/events.js';
import {awardRound} from '../dist/progression.js';

test('event window doubles only verified public elimination XP, using match completion time',()=>{
 const event=EVENTS[0],base={completed:true,kills:4,headshots:0,win:false};
 assert.equal(activeEvents(event.startsAt-1).length,0);assert.equal(eliminationXpMultiplier(event.startsAt),2);
 assert.equal(eliminationXpMultiplier(event.endsAt-1),2);assert.equal(eliminationXpMultiplier(event.endsAt),1);
 const p={};let result=awardRound(p,{...base,roundId:'before',finishedAt:event.startsAt-1},true);assert.equal(result.xp,400);assert.equal(result.coins,100);
 result=awardRound(p,{...base,roundId:'during',finishedAt:event.startsAt},true);assert.equal(result.xp,800);assert.equal(result.coins,100);
 assert.equal(awardRound(p,{...base,roundId:'during',finishedAt:event.startsAt},true).applied,false);
 result=awardRound(p,{...base,roundId:'after',finishedAt:event.endsAt},true);assert.equal(result.xp,400);
 assert.equal(awardRound(p,{...base,roundId:'private',finishedAt:event.startsAt},false).applied,false);
 assert.equal(awardRound(p,{...base,roundId:'practice',practice:true,finishedAt:event.startsAt},true).applied,false);
});

test('delayed archived match claims retain the event bonus and cannot be claimed twice',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{pathToFileURL}=await import('node:url');
 const {localProfileStore}=await import('./local-profile-store.mjs'),{profileApi}=await import('./profiles.mjs'),{newRoom}=await import('./rooms.mjs');
 const path=await mkdtemp(tmpdir()+'/rush-event-'),store=await localProfileStore(pathToFileURL(path+'/')),event=EVENTS[0],now=event.endsAt+86400000,api=profileApi(store.store,()=>now,store.rooms);
 const call=async(data,cookie)=>{const r=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));return {status:r.status,cookie:r.headers.get('set-cookie'),...await r.json()};};
 try{const guest=await call({type:'open'}),cookie=guest.cookie.split(';')[0],room=newRoom('EVNTQA',true);
 room.completedRewards=[{profileId:guest.profile.id,result:{roundId:'event-round',finishedAt:event.startsAt,completed:true,practice:false,kills:3}}];assert.ok(await store.rooms.write(room.code,null,room,event.startsAt));
 const claim=await call({type:'claimrewards',version:1},cookie);assert.equal(claim.status,200);assert.equal(claim.result.xp,600);assert.equal(claim.profile.coins,75);
 const again=await call({type:'claimrewards',version:claim.version},cookie);assert.equal(again.result.rounds,0);assert.equal(again.profile.xp,600);
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});

test('event labels follow the same half-open server-time window as rewards',async()=>{
 const {eventStatus}=await import('../dist/events.js'),event=EVENTS[0];
 assert.equal(eventStatus(event,event.startsAt-1),'UPCOMING');assert.equal(eventStatus(event,event.startsAt),'LIVE');
 assert.equal(eventStatus(event,event.endsAt-1),'LIVE');assert.equal(eventStatus(event,event.endsAt),'ENDED');
});
