import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {socialApi} from './social.mjs';
import {roomApi} from './api.mjs';

async function socialFixture(){
  const path=await mkdtemp(tmpdir()+'/rush-social-'),directory=pathToFileURL(path+'/');let saved=await localProfileStore(directory),time=1794000000000;
  let profiles=profileApi(saved.store,()=>time),friends=socialApi(saved.social,saved.store,()=>time);
  async function post(handler,data,cookie,headers={}){const response=await handler(new Request('https://arena.test/api/social',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...headers},body:JSON.stringify(data)}));return {status:response.status,cookie:response.headers.get('set-cookie'),...await response.json()};}
  const peers=[];for(const name of ['Alpha','Bravo','Charlie']){const opened=await post(profiles,{type:'open',name});const cookie=opened.cookie.split(';')[0];const list=await post(friends,{type:'list'},cookie);assert.equal(list.status,200);peers.push({cookie,id:list.playerId,profile:opened.profile});}
  return {peers,post:(data,peer,headers)=>post(friends,data,peer?.cookie,headers),profile:(data,peer)=>post(profiles,data,peer.cookie),step:ms=>time+=ms,
    room:(data,peer,token)=>post(roomApi(saved.rooms,()=>time,request=>resolveGuestProfile(saved.store,request)),data,peer.cookie,token?{authorization:'Bearer '+token}:{}),
    async reopen(){saved.close();saved=await localProfileStore(directory);profiles=profileApi(saved.store,()=>time);friends=socialApi(saved.social,saved.store,()=>time);},
    async close(){saved.close();await rm(path,{recursive:true,force:true});}};
}
test('numeric player IDs persist through reopen and recovery; lookup returns only public player presentation',async()=>{
  const h=await socialFixture();try{
    const [a,b]=h.peers;assert.match(a.id,/^[1-9][0-9]{8}$/);assert.notEqual(a.id,b.id);
    const found=await h.post({type:'find',playerId:b.id},a);assert.equal(found.status,200);assert.equal(found.player.name,'Bravo');assert.equal(found.player.relationship,'none');assert.equal(Object.hasOwn(found.player,'online'),false);
    for(const forbidden of ['profileId','session_hash','recoveryHash','coins','gems'])assert.equal(JSON.stringify(found).includes(forbidden),false);
    assert.equal((await h.post({type:'find',playerId:a.id},a)).player.relationship,'self');
    await h.reopen();assert.equal((await h.post({type:'list'},a)).playerId,a.id);
    const key=await h.profile({type:'recoverykey',version:1},a);assert.equal(key.status,200);
    const restored=await h.profile({type:'recover',code:key.result.recoveryCode},a);assert.equal(restored.status,200);
    const old=a.cookie;a.cookie=restored.cookie.split(';')[0];assert.equal((await h.post({type:'list'},a)).playerId,a.id);
    assert.equal((await h.post({type:'list'},{cookie:old})).status,401);
  }finally{await h.close();}
});
test('private-room invites require a current member and an accepted friend, then resolve to the real room',async()=>{
  const h=await socialFixture();try{
    const [host,guest,other]=h.peers;
    const created=await h.room({type:'create'},host);
    assert.equal(created.status,200);
    const invite={type:'roominvite',roomCode:created.code,playerId:guest.id};
    assert.equal((await h.post(invite,host)).status,409);
    assert.equal((await h.post({type:'request',playerId:guest.id},host)).status,200);
    assert.equal((await h.post({type:'accept',playerId:host.id},guest)).status,200);
    assert.equal((await h.post({...invite,playerId:host.id},guest)).status,409);
    assert.equal((await h.post(invite,host)).status,200);
    assert.equal((await h.post(invite,host)).status,200);
    assert.equal((await h.post({type:'list'},guest)).roomInvites.length,1);
    const open={type:'roominviteopen',playerId:host.id};
    assert.equal((await h.post(open,other)).status,409);
    assert.equal((await h.room({type:'settings',code:created.code,settings:{locked:true}},host,created.token)).status,200);
    assert.equal((await h.post(open,guest)).status,409);
    assert.equal((await h.room({type:'settings',code:created.code,settings:{locked:false}},host,created.token)).status,200);
    const opened=await h.post(open,guest);
    assert.deepEqual(opened.invite,{playerId:host.id,name:'Alpha',roomCode:created.code});
    assert.equal((await h.room({type:'join',code:opened.invite.roomCode},guest)).status,200);
    assert.equal((await h.post({type:'roominvitedismiss',playerId:host.id},guest)).roomInvites.length,0);
    assert.equal((await h.post(open,guest)).status,409);
    assert.equal((await h.post(invite,host)).status,200);
    await h.room({type:'leave',code:created.code},host,created.token);
    assert.equal((await h.post(open,guest)).status,409);
  }finally{await h.close();}
});
test('requests require receiver acceptance; third parties/replay cannot mutate, and removal updates both views',async()=>{
  const h=await socialFixture();try{
    const [a,b,c]=h.peers;
    const requested=await h.post({type:'request',playerId:b.id},a);assert.equal(requested.status,200);assert.deepEqual(requested.outgoing.map(p=>p.playerId),[b.id]);assert.equal(requested.friends.length,0);
    assert.deepEqual((await h.post({type:'list'},b)).incoming.map(p=>p.playerId),[a.id]);
    assert.equal((await h.post({type:'accept',playerId:b.id},a)).status,409,'sender cannot self-accept');
    assert.equal((await h.post({type:'accept',playerId:a.id},c)).status,409,'third party has no relation');
    assert.equal((await h.post({type:'cancel',playerId:a.id},b)).status,409,'receiver cannot cancel as sender');
    const accepted=await h.post({type:'accept',playerId:a.id},b);assert.equal(accepted.status,200);assert.equal(accepted.friends[0].online,true);assert.equal(accepted.incoming.length,0);
    assert.equal((await h.post({type:'find',playerId:b.id},a)).player.relationship,'friend');
    assert.equal((await h.post({type:'accept',playerId:a.id},b)).status,409,'accept replay does not add another friend');
    h.step(76000);const offline=await h.post({type:'list'},a);assert.equal(offline.friends[0].online,false);await h.post({type:'list'},b);assert.equal((await h.post({type:'list'},a)).friends[0].online,true);
    const removed=await h.post({type:'remove',playerId:b.id},a);assert.equal(removed.friends.length,0);assert.equal((await h.post({type:'list'},b)).friends.length,0);
  }finally{await h.close();}
});
test('pending decline/cancel, bounded identity validation, auth, origins and request throttle',async()=>{
  const h=await socialFixture();try{
    const [a,b,c]=h.peers;
    assert.equal((await h.post({type:'list'})).status,401);assert.equal((await h.post({type:'list'},a,{origin:'https://evil.test'})).status,403);
    assert.equal((await h.post({type:'request',playerId:a.id},a)).status,409);
    for(const id of ['1','1234567890','1e8',123456789,'12345678x'])assert.equal((await h.post({type:'find',playerId:id},a)).status,400);
    assert.equal((await h.post({type:'request',playerId:b.id},a)).status,200);
    assert.equal((await h.post({type:'request',playerId:c.id},a)).status,429);
    assert.equal((await h.post({type:'decline',playerId:a.id},b)).status,200);assert.equal((await h.post({type:'list'},a)).outgoing.length,0);
    h.step(2001);assert.equal((await h.post({type:'request',playerId:b.id},a)).status,200);
    assert.equal((await h.post({type:'decline',playerId:b.id},a)).status,409);assert.equal((await h.post({type:'cancel',playerId:b.id},a)).status,200);
    assert.equal((await h.post({type:'find',playerId:b.id},a)).player.relationship,'none');
    h.step(2001);const race=await Promise.all([h.post({type:'request',playerId:b.id},a),h.post({type:'request',playerId:b.id},a)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,429]);
    assert.equal((await h.post({type:'list'},b)).incoming.length,1);
  }finally{await h.close();}
});

test('friend lookup actions follow the authoritative relationship, including incoming requests',async()=>{
 const {friendSearchAction}=await import('../dist/friends.js');
 for(const [relationship,label] of [['self','YOU'],['friend','FRIEND'],['outgoing','SENT'],['incoming','ACCEPT'],['none','ADD']])assert.equal(friendSearchAction({relationship}),label);
});

test('friend lookup state follows incoming acceptance and removal during background refresh',async()=>{
 const {relationshipFromList}=await import('../dist/friends.js'),target='222222222';
 const state={playerId:'111111111',friends:[],incoming:[{playerId:target}],outgoing:[]};
 assert.equal(relationshipFromList(target,state),'incoming');state.friends=state.incoming;state.incoming=[];
 assert.equal(relationshipFromList(target,state),'friend');state.friends=[];assert.equal(relationshipFromList(target,state),'none');
 assert.equal(relationshipFromList(state.playerId,state),'self');
});
