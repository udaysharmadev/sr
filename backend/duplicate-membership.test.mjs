import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi} from './api.mjs';
test('same authenticated profile cannot occupy two slots in a room, but its existing token still reconnects',async()=>{
 const path=await mkdtemp(tmpdir()+'/rush-member-'),saved=await localProfileStore(pathToFileURL(path+'/'));
 const profiles=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,r=>resolveGuestProfile(saved.store,r));let cookie;
 const post=async(handler,data,token)=>{const response=await handler(new Request('http://qa.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;return {status:response.status,...await response.json()};};
 try{await post(profiles,{type:'open'});const created=await post(rooms,{type:'create'});assert.equal(created.status,200);
 assert.equal((await post(rooms,{type:'join',code:created.code})).status,409);
 const refresh=await post(rooms,{type:'refresh',code:created.code},created.token);assert.equal(refresh.status,200);assert.equal(refresh.state.players.length,1);
 await post(rooms,{type:'leave',code:created.code},created.token);
 }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
