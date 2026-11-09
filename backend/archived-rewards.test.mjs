import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi} from './api.mjs';
import {advance,newRoom} from './rooms.mjs';
import {DatabaseSync} from 'node:sqlite';

test('archived results survive missed screens, room deletion and server reopen; concurrent claims award once',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-archive-'),directory=pathToFileURL(path+'/');let saved=await localProfileStore(directory),time=1794000000000;
  const call=async(handler,data,cookie,token)=>{
    const res=await handler(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));return {status:res.status,cookie:res.headers.get('set-cookie'),...await res.json()};
  };
  let profiles=profileApi(saved.store,()=>time,saved.rooms),rooms=roomApi(saved.rooms,()=>time,req=>resolveGuestProfile(saved.store,req));
  try{
    const guest=await call(profiles,{type:'open',name:'Archive pilot'}),cookie=guest.cookie.split(';')[0];
    const other=await call(profiles,{type:'open',name:'Other pilot'}),otherCookie=other.cookie.split(';')[0];
    const joined=await call(rooms,{type:'public'},cookie);let row=await saved.rooms.read(joined.code);
    Object.assign(row.room,{phase:'live',startedAt:time-600000,endsAt:time+1});
    Object.assign(row.room.players[0],{kills:7,deaths:3,bestStreak:5,shots:10,hits:7,headshots:4,weaponStats:{sunbolt:{kills:7,shots:10,hits:7,headshots:4}}});
    await saved.rooms.write(joined.code,row,row.room,time);
    time+=20000;const refresh=await call(rooms,{type:'refresh',code:joined.code},cookie,joined.token);assert.equal(refresh.status,200);assert.equal(refresh.state.phase,'waiting','results screen was skipped');
    const proof=(await saved.store.unclaimed(guest.profile))[0];assert.equal(proof.kills,7);assert.equal(proof.finishedAt,time-19999);
    assert.equal(JSON.stringify(proof).includes(joined.token),false);assert.equal((await saved.store.unclaimed(other.profile)).length,0);
    // A later room write clears its transient archive payload; sweep removes the room entirely.
    await call(rooms,{type:'refresh',code:joined.code},cookie,joined.token);await saved.rooms.sweep(time+700000);
    assert.equal(await saved.rooms.read(joined.code),undefined);
    saved.close();saved=await localProfileStore(directory);profiles=profileApi(saved.store,()=>time,saved.rooms);
    const claims=await Promise.all([call(profiles,{type:'claimrewards',version:1},cookie),call(profiles,{type:'claimrewards',version:1},cookie)]);
    assert.deepEqual(claims.map(x=>x.status).sort(),[200,409]);let current=await call(profiles,{type:'refresh'},cookie);
    assert.equal(current.profile.coins,175);assert.equal(current.profile.xp,700);assert.equal(current.profile.kills,7);assert.equal(current.profile.rounds,1);
    const replay=await call(profiles,{type:'claimrewards',version:current.version},cookie);assert.equal(replay.result.rounds,0);assert.equal(replay.version,current.version);
    const foreign=await call(profiles,{type:'claimrewards',version:1,profileId:guest.profile.id},otherCookie);assert.equal(foreign.status,409);
    assert.equal((await call(profiles,{type:'claimrewards',version:1},otherCookie)).result.rounds,0);
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});

test('receipt triggers only run on successful room CAS writes and public nonspectator results',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-cas-'),saved=await localProfileStore(pathToFileURL(path+'/'));
  try{
    const r=newRoom('CASREC',true);const receipt={profileId:'proof-owner',result:{roundId:r.id+':1',finishedAt:1000,completed:true,kills:2}};
    r.completedRewards=[];assert.equal(await saved.rooms.write(r.code,null,r,1000),true);
    const stale=await saved.rooms.read(r.code),winner=await saved.rooms.read(r.code);
    winner.room.completedRewards=[receipt];assert.equal(await saved.rooms.write(r.code,winner,winner.room,1001),true);
    stale.room.completedRewards=[{...receipt,result:{...receipt.result,roundId:'fabricated-stale',kills:999}}];
    assert.equal(await saved.rooms.write(r.code,stale,stale.room,1002),false);
    const archived=await saved.store.unclaimed({id:'proof-owner'});assert.equal(archived.length,1);assert.equal(archived[0].kills,2);
    for(const isPublic of [false,true]){
      const room=newRoom(isPublic?'SPECQA':'PRIVQA',isPublic);room.phase='live';room.endsAt=1001;
      room.players=[{id:'viewer',guestProfileId:'excluded',spectator:isPublic,seen:1000,kills:20,weaponStats:{}}];
      advance(room,1002);assert.equal((room.completedRewards||[]).length,0);
    }
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});

test('a profile request can claim at most50 pending rounds without skipping remaining receipts',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-batch-'),saved=await localProfileStore(pathToFileURL(path+'/'));
  try{
    const room=newRoom('BATCHQ',true);room.completedRewards=Array.from({length:55},(_,i)=>({profileId:'batch-owner',result:{roundId:'round'+i,finishedAt:1000+i,completed:true,kills:1,practice:false}}));
    assert.equal(await saved.rooms.write(room.code,null,room,1000),true);
    const profile={id:'batch-owner',awardedRounds:[]};const first=await saved.store.unclaimed(profile);assert.equal(first.length,50);
    profile.awardedRounds=first.map(r=>r.roundId);const next=await saved.store.unclaimed(profile);assert.equal(next.length,5);assert.ok(next.every(r=>!profile.awardedRounds.includes(r.roundId)));
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});

test('archive storage failure rolls back the room write instead of committing an unclaimable result',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-archive-fault-'),saved=await localProfileStore(pathToFileURL(path+'/')),db=new DatabaseSync(path+'/profiles.sqlite');
  try{
    const room=newRoom('FAULTQ',true);assert.equal(await saved.rooms.write(room.code,null,room,1000),true);
    db.exec("CREATE TRIGGER qa_archive_fail BEFORE INSERT ON rush_match_results BEGIN SELECT RAISE(ABORT,'archive fault'); END");
    const before=await saved.rooms.read(room.code);const changed=structuredClone(before.room);
    changed.phase='results';changed.completedRewards=[{profileId:'fault-owner',result:{roundId:'fault-round',finishedAt:1001,kills:2}}];
    await assert.rejects(saved.rooms.write(room.code,before,changed,1001),/archive fault/);
    const after=await saved.rooms.read(room.code);assert.equal(after.version,before.version);assert.equal(after.room.phase,before.room.phase);assert.equal((await saved.store.unclaimed({id:'fault-owner'})).length,0);
    db.exec('DROP TRIGGER qa_archive_fail');assert.equal(await saved.rooms.write(room.code,before,changed,1001),true);assert.equal((await saved.store.unclaimed({id:'fault-owner'})).length,1);
  }finally{db.close();saved.close();await rm(path,{recursive:true,force:true});}
});

test('entirely idle rounds settle on profile claim or before expiry sweep, without another gameplay request',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-idle-'),saved=await localProfileStore(pathToFileURL(path+'/'));let time=1794000000000;
  const api=profileApi(saved.store,()=>time,saved.rooms);
  const call=async(data,cookie)=>{const reply=await api(new Request('http://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}));assert.equal(reply.status,200);return {cookie:reply.headers.get('set-cookie'),...await reply.json()};};
  try{
    const guest=await call({type:'open',name:'Idle finisher'}),cookie=guest.cookie.split(';')[0];
    for(const [index,mode]of ['claim','sweep'].entries()){
      const room=newRoom('IDLEQ'+index,true);room.phase='live';room.endsAt=time+1000;room.startedAt=time-599000;
      room.players=[{id:'idle-player',guestProfileId:guest.profile.id,token:'test-only',seen:time,spectator:false,kills:2,deaths:1,bestStreak:2,shots:3,hits:2,scoreAt:time,weaponStats:{}}];
      assert.equal(await saved.rooms.write(room.code,null,room,time),true);time+=700000;
      if(mode==='sweep'){await saved.rooms.sweep(time);assert.equal(await saved.rooms.read(room.code),undefined);}
      const current=await call({type:'refresh'},cookie);const claimed=await call({type:'claimrewards',version:current.version},cookie);assert.equal(claimed.result.rounds,1);assert.equal(claimed.profile.coins,index===0?50:500,'second public win also grants400 challenge coins');
    }
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
