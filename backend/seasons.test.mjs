import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {awardRound} from '../dist/progression.js';
import {SEASONS,seasonAt,seasonProgress,SEASON_CLAIM_GRACE} from '../dist/seasons.js';

test('verified round credits season XP once and old receipts remain in their original season',()=>{
 const s=SEASONS[0],p={};const receipt={roundId:'r1',completed:true,practice:false,finishedAt:s.startsAt,kills:10,win:true};
 assert.equal(awardRound(p,receipt,true).applied,true);assert.equal(seasonProgress(p,s).xp,600);
 assert.equal(awardRound(p,receipt,true).applied,false);assert.equal(seasonProgress(p,s).xp,600);
 awardRound(p,{...receipt,roundId:'practice',practice:true},true);awardRound(p,{...receipt,roundId:'private'},false);assert.equal(seasonProgress(p,s).xp,600);
 awardRound(p,{...receipt,roundId:'after',finishedAt:s.endsAt},true);assert.equal(seasonAt(s.endsAt),null);assert.equal(seasonProgress(p,s).xp,600);
});

test('season rewards use server time and reject locked, duplicate and concurrent claims',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-season-'),store=await localProfileStore(pathToFileURL(path+'/'));let now=SEASONS[0].startsAt+1000;
 const api=profileApi(store.store,()=>now);
 const call=async(data,cookie)=>{const r=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));return {status:r.status,cookie:r.headers.get('set-cookie'),...await r.json()};};
 try {
  const first=await call({type:'open',name:'Season QA'});const cookie=first.cookie.split(';')[0];
  assert.equal((await call({type:'seasonclaim',season:SEASONS[0].id,tier:0,version:1},cookie)).status,409);
  const row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.seasons={[SEASONS[0].id]:{xp:500,claimed:[]}};assert.equal(await store.store.write(row.key,row,row.profile),true);
  const calls=await Promise.all([0,1].map(()=>call({type:'seasonclaim',season:SEASONS[0].id,tier:0,version:2},cookie)));
  assert.deepEqual(calls.map(x=>x.status).sort(),[200,409]);let current=await call({type:'refresh'},cookie);assert.equal(current.profile.coins,500);assert.deepEqual(current.profile.seasons[SEASONS[0].id].claimed,[0]);
  assert.equal((await call({type:'seasonclaim',season:SEASONS[0].id,tier:0,version:current.version},cookie)).status,409);
  now=SEASONS[0].endsAt;assert.equal((await call({type:'seasonclaim',season:SEASONS[0].id,tier:1,version:current.version,now:SEASONS[0].startsAt},cookie)).status,409);
 } finally {store.close();await rm(path,{recursive:true,force:true});}
});

test('season missions count verified results once and claims survive tier claims',async()=>{
 const {claimSeasonMission,claimSeasonTier}=await import('../dist/seasons.js');const s=SEASONS[0],p={};
 const r={roundId:'mission-round',completed:true,finishedAt:s.startsAt+1,kills:50,headshots:22,win:true};
 awardRound(p,r,true);awardRound(p,r,true);
 let v=seasonProgress(p,s);assert.equal(v.kills,50);assert.equal(v.headshots,22);assert.equal(v.wins,1);
 assert.equal(claimSeasonMission(p,s.id,'wins',s.startsAt+2),false);
 assert.equal(claimSeasonMission(p,s.id,'kills',s.startsAt+2).xp,500);
 assert.equal(claimSeasonMission(p,s.id,'kills',s.startsAt+2),false);
 assert.ok(claimSeasonTier(p,s.id,0,s.startsAt+2));
 v=seasonProgress(p,s);assert.deepEqual(v.missionClaims,['kills']);assert.equal(v.kills,50);
 assert.equal(claimSeasonMission(p,s.id,'headshots',s.endsAt+SEASON_CLAIM_GRACE),false);
});

test('concurrent season mission claims award XP only once',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-mission-'),store=await localProfileStore(pathToFileURL(path+'/'));const now=SEASONS[0].startsAt+1000,api=profileApi(store.store,()=>now);
 const call=async(data,cookie)=>{const r=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));return {status:r.status,cookie:r.headers.get('set-cookie'),...await r.json()};};
 try{const first=await call({type:'open'}),cookie=first.cookie.split(';')[0];const row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.seasons={[SEASONS[0].id]:{xp:0,kills:50,claimed:[]}};assert.equal(await store.store.write(row.key,row,row.profile),true);
 const claims=await Promise.all([0,1].map(()=>call({type:'seasonmission',season:SEASONS[0].id,mission:'kills',version:2},cookie)));assert.deepEqual(claims.map(x=>x.status).sort(),[200,409]);const current=await call({type:'refresh'},cookie);assert.equal(current.profile.seasons[SEASONS[0].id].xp,500);assert.deepEqual(current.profile.seasons[SEASONS[0].id].missionClaims,['kills']);
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});

test('season-exclusive Frontier Ace badge is awarded once and can be equipped only after earning it',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-badge-'),store=await localProfileStore(pathToFileURL(path+'/'));const now=SEASONS[0].startsAt+1000,api=profileApi(store.store,()=>now);
 const call=async(data,cookie)=>{const r=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));return {status:r.status,cookie:r.headers.get('set-cookie'),...await r.json()};};
 try{const first=await call({type:'open'}),cookie=first.cookie.split(';')[0];assert.equal((await call({type:'badge',badge:'frontier-ace',version:1},cookie)).status,409);
 const row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.seasons={[SEASONS[0].id]:{xp:5000,claimed:[]}};assert.equal(await store.store.write(row.key,row,row.profile),true);
 const reward=await call({type:'seasonclaim',season:SEASONS[0].id,tier:3,version:2},cookie);assert.equal(reward.status,200);assert.equal(reward.result.badge,'frontier-ace');assert.deepEqual(reward.profile.badges,['frontier-ace']);
 const equipped=await call({type:'badge',badge:'frontier-ace',version:reward.version},cookie);assert.equal(equipped.status,200);assert.equal(equipped.profile.badge,'frontier-ace');
 assert.equal((await call({type:'seasonclaim',season:SEASONS[0].id,tier:3,version:equipped.version},cookie)).status,409);
 awardRound(equipped.profile,{roundId:'post-badge',completed:true,finishedAt:now,kills:1},true);assert.ok(equipped.profile.badges.includes('frontier-ace'));
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});

test('claimed and equipped season badge reaches another authenticated player in a compact room snapshot',async()=>{
 const {roomApi}=await import('./api.mjs'),{unpackSnapshot}=await import('../dist/snapshot-wire.js');
 const path=await mkdtemp(tmpdir()+'/rush-badge-room-'),store=await localProfileStore(pathToFileURL(path+'/'));const now=SEASONS[0].startsAt+1000;
 const profiles=profileApi(store.store,()=>now),rooms=roomApi(store.rooms,()=>now,request=>resolveGuestProfile(store.store,request));
 const call=async(handler,data,cookie,token)=>{const r=await handler(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({...data,wire:1})}));const body=await r.json();assert.equal(r.status,200,body.error);if(body.state)body.state=unpackSnapshot(body.state);return {...body,cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{const a=await call(profiles,{type:'open',name:'Season winner'}),b=await call(profiles,{type:'open',name:'Observer'});const row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie:a.cookie}}));row.profile.seasons={[SEASONS[0].id]:{xp:5000,claimed:[]}};assert.ok(await store.store.write(row.key,row,row.profile));
 const reward=await call(profiles,{type:'seasonclaim',season:SEASONS[0].id,tier:3,version:2},a.cookie);await call(profiles,{type:'badge',badge:'frontier-ace',version:reward.version},a.cookie);
 const host=await call(rooms,{type:'create'},a.cookie),peer=await call(rooms,{type:'join',code:host.code},b.cookie);const observed=await call(rooms,{type:'refresh',code:host.code},b.cookie,peer.token);assert.equal(observed.state.players.find(p=>p.id===host.id).badge,'frontier-ace');
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});


test('season rollover permits earned claims for seven days without counting later matches',async()=>{
 const {claimSeasonMission,claimSeasonTier,claimableSeasons}=await import('../dist/seasons.js'),s=SEASONS[0],p={};
 const receipt={roundId:'prior',completed:true,finishedAt:s.endsAt-1,kills:50,headshots:20,win:true};
 awardRound(p,receipt,true);const before=seasonProgress(p,s);awardRound(p,{...receipt,roundId:'late',finishedAt:s.endsAt},true);
 assert.equal(seasonProgress(p,s).kills,before.kills);assert.equal(seasonAt(s.endsAt),null);
 assert.equal(claimableSeasons(s.endsAt).includes(s),true);assert.equal(claimSeasonMission(p,s.id,'kills',s.endsAt).xp,500);
 assert.ok(claimSeasonTier(p,s.id,0,s.endsAt+SEASON_CLAIM_GRACE-1));
 assert.equal(claimableSeasons(s.endsAt+SEASON_CLAIM_GRACE).includes(s),false);
 assert.equal(claimSeasonMission(p,s.id,'headshots',s.endsAt+SEASON_CLAIM_GRACE),false);
 assert.equal(claimSeasonTier(p,s.id,1,s.startsAt-1),false);
});

test('profile service uses its own clock for the post-season claim deadline',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-grace-'),store=await localProfileStore(pathToFileURL(path+'/'));const s=SEASONS[0];let now=s.endsAt-1;const api=profileApi(store.store,()=>now);
 const call=async(data,cookie)=>{const r=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));return {status:r.status,cookie:r.headers.get('set-cookie'),...await r.json()};};
 try{const first=await call({type:'open'}),cookie=first.cookie.split(';')[0],row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.seasons={[s.id]:{xp:3500,claimed:[]}};assert.ok(await store.store.write(row.key,row,row.profile));
 now=s.endsAt;const earned=await call({type:'seasonclaim',season:s.id,tier:0,version:2},cookie);assert.equal(earned.status,200);
 now=s.endsAt+SEASON_CLAIM_GRACE;const expired=await call({type:'seasonclaim',season:s.id,tier:1,version:earned.version,now:s.startsAt},cookie);assert.equal(expired.status,409);
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});

test('Frontier Vanguard can only be earned from the season, then equipped on its rifle',async()=>{
 const {finishOffer}=await import('../dist/armory-offer.js'),{rifle,setRifleFinish,disposeRifle}=await import('../dist/rifle-models.js'),T=await import('../dist/vendor/three.module.js');
 const path=await mkdtemp(tmpdir()+'/rush-season-rifle-'),store=await localProfileStore(pathToFileURL(path+'/'));const now=SEASONS[0].startsAt+1000,api=profileApi(store.store,()=>now);
 const call=async(data,cookie)=>{const r=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));return {status:r.status,cookie:r.headers.get('set-cookie'),...await r.json()};};
 try{const first=await call({type:'open'}),cookie=first.cookie.split(';')[0],id='sunbolt-frontier-vanguard';assert.equal(finishOffer(first.profile,'sunbolt',id).action,'season');
 assert.equal((await call({type:'buy',category:'wraps',item:'wrap-'+id,version:1},cookie)).status,409);assert.equal((await call({type:'finish',weapon:'sunbolt',finish:id,version:1},cookie)).status,409);
 const row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie}}));row.profile.seasons={[SEASONS[0].id]:{xp:7500,claimed:[]}};assert.ok(await store.store.write(row.key,row,row.profile));
 const claimed=await call({type:'seasonclaim',season:SEASONS[0].id,tier:4,version:2},cookie);assert.equal(claimed.status,200);assert.equal(claimed.result.finish,id);assert.equal(finishOffer(claimed.profile,'sunbolt',id).action,'equip');
 const equipped=await call({type:'finish',weapon:'sunbolt',finish:id,version:claimed.version},cookie);assert.equal(equipped.status,200);assert.equal(equipped.profile.equipped.finishes.sunbolt,id);
 const root=rifle(new T.Group(),'sunbolt',false);setRifleFinish(root,id);assert.ok(root.getObjectByName('rifle-skin-decoration'));assert.equal(root.userData.skinEffect.finish,id);disposeRifle(root);
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});

test('season rifle finish is synchronized to other players and unowned client claims are ignored',async()=>{
 const {roomApi}=await import('./api.mjs'),{unpackSnapshot}=await import('../dist/snapshot-wire.js');
 const path=await mkdtemp(tmpdir()+'/rush-season-sync-'),store=await localProfileStore(pathToFileURL(path+'/'));const now=SEASONS[0].startsAt+1000;
 const profiles=profileApi(store.store,()=>now),rooms=roomApi(store.rooms,()=>now,request=>resolveGuestProfile(store.store,request));
 const call=async(handler,data,cookie,token)=>{const r=await handler(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({...data,wire:1})}));const result=await r.json();assert.equal(r.status,200,result.error);if(result.state)result.state=unpackSnapshot(result.state);return {...result,cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{const a=await call(profiles,{type:'open',name:'Reward owner'}),b=await call(profiles,{type:'open',name:'Observer'}),id='sunbolt-frontier-vanguard';
 const row=await resolveGuestProfile(store.store,new Request('http://qa.test',{headers:{cookie:a.cookie}}));row.profile.seasons={[SEASONS[0].id]:{xp:7500,claimed:[]}};assert.ok(await store.store.write(row.key,row,row.profile));
 const claimed=await call(profiles,{type:'seasonclaim',season:SEASONS[0].id,tier:4,version:2},a.cookie);await call(profiles,{type:'finish',weapon:'sunbolt',finish:id,version:claimed.version},a.cookie);
 const host=await call(rooms,{type:'create'},a.cookie),peer=await call(rooms,{type:'join',code:host.code,finish:id},b.cookie);
 const view=await call(rooms,{type:'refresh',code:host.code},b.cookie,peer.token);assert.equal(view.state.players.find(p=>p.id===host.id).finish,id);assert.equal(view.state.players.find(p=>p.id===peer.id).finish,'field');
 }finally{store.close();await rm(path,{recursive:true,force:true});}
});
