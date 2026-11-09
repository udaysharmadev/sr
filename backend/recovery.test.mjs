import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {localProfileStore} from './local-profile-store.mjs';
import {profileApi,resolveGuestProfile} from './profiles.mjs';
import {roomApi} from './api.mjs';
test('single-use recovery restores the same save, hides secrets and retires previous profile/room credentials',async()=>{
  const path=await mkdtemp(tmpdir()+'/rush-recovery-'),saved=await localProfileStore(pathToFileURL(path+'/'));
  const profiles=profileApi(saved.store),rooms=roomApi(saved.rooms,Date.now,request=>resolveGuestProfile(saved.store,request));
  const call=async(api,data,cookie,token)=>{const res=await api(new Request('https://qa.test/api/profile',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));return {status:res.status,cookie:res.headers.get('set-cookie'),...await res.json()};};
  try{
    const guest=await call(profiles,{type:'open',name:'Recover pilot'}),oldCookie=guest.cookie.split(';')[0];
    assert.equal((await call(profiles,{type:'open',expectedProfileId:guest.profile.id})).status,401,'missing cookie cannot replace a known save');
    assert.equal((await call(rooms,{type:'create'})).status,401,'production room requires guest cookie');
    const gift=await call(profiles,{type:'dailycoins',version:1},oldCookie);assert.equal(gift.profile.coins,200);
    const joined=await call(rooms,{type:'create'},oldCookie);assert.equal(joined.status,200);
    const key=await call(profiles,{type:'recoverykey',version:2},oldCookie);assert.equal(key.status,200);assert.match(key.result.recoveryCode,/^SR-[a-f0-9]{48}$/);
    const code=key.result.recoveryCode;
    const refreshed=await call(profiles,{type:'refresh'},oldCookie);assert.equal(refreshed.profile.recoveryReady,true);assert.equal(JSON.stringify(refreshed).includes(code),false);assert.equal(JSON.stringify(refreshed).includes('recoveryHash'),false);
    assert.equal(JSON.stringify(joined.state).includes('guestSessionHash'),false);
    assert.equal((await call(profiles,{type:'recover',code:'SR-'+'0'.repeat(48)})).status,403);
    const attempts=await Promise.all([call(profiles,{type:'recover',code}),call(profiles,{type:'recover',code})]);const won=attempts.find(x=>x.status===200);
    assert.equal(attempts.filter(x=>x.status===200).length,1);assert.ok(attempts.filter(x=>x.status!==200).every(x=>[403,409].includes(x.status)));
    assert.equal(won.profile.id,guest.profile.id);assert.equal(won.profile.coins,200);assert.equal(won.profile.recoveryReady,false);assert.equal((await call(profiles,{type:'recover',code})).status,403);
    assert.equal((await call(profiles,{type:'refresh'},oldCookie)).status,401);
    const newCookie=won.cookie.split(';')[0];assert.notEqual(newCookie,oldCookie);assert.equal((await call(profiles,{type:'refresh'},newCookie)).profile.coins,200);
    assert.equal((await call(rooms,{type:'refresh',code:joined.code},oldCookie,joined.token)).status,401);
    assert.equal((await call(rooms,{type:'refresh',code:joined.code},newCookie,joined.token)).status,403,'old room proof does not survive cookie rotation');
    const fresh=await call(rooms,{type:'create'},newCookie);assert.equal(fresh.status,200);assert.equal(fresh.state.players[0].name,'Recover pilot');
    const second=await call(profiles,{type:'recoverykey',version:won.version},newCookie);assert.equal(second.status,200);assert.notEqual(second.result.recoveryCode,code);
    const third=await call(profiles,{type:'recoverykey',version:second.version},newCookie);assert.equal(third.status,200);assert.equal((await call(profiles,{type:'recover',code:second.result.recoveryCode})).status,403,'replacement revokes previous key');
  }finally{saved.close();await rm(path,{recursive:true,force:true});}
});
