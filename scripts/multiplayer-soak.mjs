// Run against the local server: npm run test:multiplayer -- 45
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {unpackSnapshot} from '../dist/snapshot-wire.js';
const seconds=Number(process.argv[2]||45);
assert.ok(Number.isFinite(seconds)&&seconds>=15&&seconds<=120,'duration must be15–120seconds');
const baseUrl=new URL(process.env.SNIPER_SOAK_URL||'http://127.0.0.1:4173');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(baseUrl.hostname),'soak server must be local');
const endpoint=new URL('/api/rooms',baseUrl),clients=[],rtts=[];
let requests=0,bytes=0,busy=0,dropped=0,gaps=0,liveObserved=false,roomCode,report;
async function enroll(name){
  const response=await fetch(new URL('/api/profile',baseUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'open',name}),signal:AbortSignal.timeout(3500)});
  assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);return cookie;
}
async function post(type,data={},client,guestCookie){
  const start=performance.now();
  const cookie=client?.cookie||guestCookie;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(client?{Authorization:'Bearer '+client.token}:{})},body:JSON.stringify({...data,type,wire:1,...(client?{code:client.code,eventAfter:client.state?.eventId}:{})}),signal:AbortSignal.timeout(3500)});
  const raw=await response.text();rtts.push(performance.now()-start);bytes+=Buffer.byteLength(raw);requests++;
  if(response.status===503){busy++;return null;}
  const result=JSON.parse(raw);assert.equal(response.status,200,result.error);
  if(result.state)result.state=unpackSnapshot(result.state);
  if(result.token)result.cookie=cookie;
  return result;
}
function apply(c,state){
  assert.equal(state.code,roomCode);assert.equal(state.players.length,15);
  assert.ok(state.players.some(p=>p.id===c.id));assert.equal(state.map,'foundry');
  for(const e of state.events){assert.ok(!c.seen.has(e.id),'event delivered twice after acknowledged cursor');c.seen.add(e.id);}
  if(state.eventGap)gaps++;
  liveObserved||=state.phase==='live';c.state=state;
}
try{
  const hostCookie=await enroll('Soak QA 01');
  const host=await post('create',{name:'Soak QA 01',device:'soak-qa-host'},null,hostCookie);assert.ok(host);clients.push(host);roomCode=host.code;
  await post('settings',{settings:{capacity:15,map:'foundry'}},host);
  for(let i=1;i<15;i++){const cookie=await enroll('Soak QA '+String(i+1).padStart(2,'0'));const client=await post('join',{code:roomCode,device:'soak-qa-'+i},null,cookie);assert.ok(client);clients.push(client);}
  const ready=await Promise.all(clients.map(c=>post('ready',{ready:true},c)));assert.ok(ready.every(Boolean));
  const started=await post('start',{},host);assert.ok(started);assert.equal(started.state.phase,'warmup');
  for(const c of clients){c.state=started.state;c.seq=0;c.shot=0;c.seen=new Set();}
  const start=performance.now(),deadline=start+seconds*1000;
  const outcomes=await Promise.allSettled(clients.map(async(c,index)=>{
    let tick=0,resync=false;
    while(performance.now()<deadline){
      const began=performance.now(),me=c.state.players.find(p=>p.id===c.id);
      const input={seq:++c.seq,frames:[{strafe:Math.sin(tick*.08+index)>.2?1:-1,forward:tick%24<12?1:-1,yaw:index*.43,dt:.05},{yaw:index*.43,dt:.04}]};
      const fire=tick%18===index%18;
      const result=await (resync?post('refresh',{},c):fire?post('shoot',{life:me.life,seq:++c.shot,yaw:index*.43,pitch:1.4,input},c):post('input',{life:me.life,...input},c));
      tick++;
      // Deliberate acknowledgement loss, not mutation replay. Next request is a refresh.
      if(result && tick%97===0){dropped++;resync=true;}
      else if(!result)resync=true;
      else {await delay((tick*13+index*7)%41);apply(c,result.state);resync=false;}
      await delay(Math.max(0,100+(index%3-1)*7-(performance.now()-began)));
    }
  }));
  const failure=outcomes.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  const final=await post('refresh',{},host);assert.ok(final);assert.equal(final.state.players.length,15);assert.equal(liveObserved,true);assert.equal(gaps,0);
  rtts.sort((a,b)=>a-b);const percentile=p=>Number(rtts[Math.min(rtts.length-1,Math.floor(rtts.length*p))].toFixed(2));
  report={at:new Date().toISOString(),scope:'15 independently authenticated localhost API clients; current local server storage; injected client receive jitter and discarded acknowledgements; no native rendering/WAN benchmark',durationSeconds:Number(((performance.now()-start)/1000).toFixed(2)),clients:15,requests,busyResponses:busy,discardedAcknowledgements:dropped,eventGaps:gaps,responseBytes:bytes,rttMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:percentile(1)},finalPhase:final.state.phase,acceptedLiveShots:final.state.players.reduce((n,p)=>n+p.shots,0),verdict:'PASS'};
}finally{
  let left=0;
  for(const c of clients){const result=await post('leave',{},c);if(result?.left)left++;}
  assert.equal(left,clients.length,'all temporary QA participants must leave');
  if(report){report.cleanedClients=left;const path=process.env.SNIPER_SOAK_REPORT||new URL('../qa/multiplayer-soak.json',import.meta.url);if(!process.env.SNIPER_SOAK_REPORT)await mkdir(new URL('../qa/',import.meta.url),{recursive:true});await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
}
