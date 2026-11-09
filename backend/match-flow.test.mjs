import test from 'node:test';
import assert from 'node:assert/strict';
import {watchSession} from '../dist/net.js';
import {createPlayClock} from '../dist/presentation.js';
import {resetPlayerMotion,movePlayer} from '../dist/movement.js';
import {MAPS} from '../dist/maps.js';
import {createRoundMusic} from '../dist/round-music.js';
import {newRoom,addPlayer,advance} from './rooms.mjs';

function scheduler(){
  let id=0;const jobs=new Map();
  return {time:0,jobs,setTimeout(fn,delay){jobs.set(++id,{fn,delay});return id;},clearTimeout(id){jobs.delete(id);},
    run(){assert.equal(jobs.size,1,'only one matchmaking timer');const [id,job]=jobs.entries().next().value;jobs.delete(id);this.time+=job.delay;return job.fn();},
    delay(){assert.equal(jobs.size,1);return jobs.values().next().value.delay;}};
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
test('matchmaking stays alive through a paused practice clock and hands off once on voting',async()=>{
  const timers=scheduler(),clock=createPlayClock(()=>timers.time),seen=[];
  const states=[{phase:'waiting'},{phase:'waiting'},{phase:'vote'},{phase:'warmup'}];let calls=0;
  clock.setPaused(true);
  const stop=watchSession({refresh:async()=>states[calls++]},state=>{seen.push(state.phase);return state.phase==='waiting';},()=>assert.fail('unexpected error'),timers);
  await timers.run();assert.equal(timers.delay(),750);await timers.run();await timers.run();
  assert.equal(clock.now(),0);assert.equal(timers.time,1500);assert.equal(calls,3);
  assert.deepEqual(seen,['waiting','waiting','vote']);assert.equal(timers.jobs.size,0);stop();
});
test('a slow matchmaking refresh cannot overlap or resurrect a stopped game',async()=>{
  for(const fail of [false,true]){
    const timers=scheduler(),request=deferred();let calls=0;
    const stop=watchSession({refresh(){calls++;return request.promise;}},()=>assert.fail('late success escaped cancellation'),()=>assert.fail('late error escaped cancellation'),timers);
    const pending=timers.run();assert.equal(calls,1);assert.equal(timers.jobs.size,0,'no timer while HTTP is pending');
    stop();stop();if(fail)request.reject(new Error('offline'));else request.resolve({phase:'live'});
    await pending;assert.equal(timers.jobs.size,0);
  }
});
test('matchmaking retries with bounded backoff and resumes its normal heartbeat',async()=>{
  const timers=scheduler(),errors=[],session={failures:0,async refresh(){if(++this.failures<=6)throw new Error('offline');return {phase:'waiting'};}};
  const stop=watchSession(session,()=>true,error=>{errors.push(error.message);},timers);
  for(const expected of [250,500,1000,2000,3000,3000]){await timers.run();assert.equal(timers.delay(),expected);}
  await timers.run();assert.equal(timers.delay(),750);assert.equal(errors.length,6);stop();assert.equal(timers.jobs.size,0);
});
test('matchmaking terminal errors and a stop inside state delivery cannot schedule another refresh',async()=>{
  const timers=scheduler();let failures=0;
  watchSession({refresh:async()=>{throw Object.assign(new Error('expired'),{status:401});}},()=>assert.fail(),error=>{assert.equal(error.status,401);failures++;return false;},timers);
  await timers.run();assert.equal(failures,1);assert.equal(timers.jobs.size,0);
  const stop=watchSession({refresh:async()=>({phase:'waiting'})},()=>{stop();return true;},()=>assert.fail(),timers);
  await timers.run();assert.equal(timers.jobs.size,0);
});
test('explicit reconnect delay is respected without creating a new room or replaying mutations',async()=>{
  const timers=scheduler();let calls=0;
  const session={refresh:async()=>{calls++;throw new Error('busy');}};
  const stop=watchSession(session,()=>assert.fail(),()=>1800,timers);
  await timers.run();assert.equal(calls,1);assert.equal(timers.delay(),1800);stop();assert.equal(timers.jobs.size,0);
});

function dirtyPlayer(){return {id:'same-player',health:42,kills:3,x:20,z:20,y:5,yaw:2,pitch:1,vx:11,vy:7,vz:-11,grounded:false,slideTime:.5,slideCooldown:1,jumpBuffer:.08,coyote:.02,eyeHeight:1.02,lean:.15};}
test('respawn clears motion and buffered jump on every actual map without changing identity or stats',()=>{
  for(const map of MAPS){
    const p=dirtyPlayer();resetPlayerMotion(p,map.spawns[0]);
    assert.equal(p.id,'same-player');assert.equal(p.health,42);assert.equal(p.kills,3);
    assert.deepEqual([p.y,p.vx,p.vy,p.vz,p.pitch,p.slideTime,p.slideCooldown,p.jumpBuffer,p.lean],[0,0,0,0,0,0,0,0,0]);
    assert.equal(p.eyeHeight,1.62);assert.equal(p.grounded,true);assert.equal(p.yaw,map.spawns[0].yaw);
    const {x,z}=p;movePlayer(p,{},1/60,map);assert.equal(p.y,0);assert.equal(p.vy,0);assert.equal(p.x,x);assert.equal(p.z,z);assert.equal(p.slideTime,0);
  }
});
test('authoritative respawn also restores motion, vitality, stock and life before accepting next input',()=>{
  const time=1000000,r=newRoom('FLOWQA',false);addPlayer(r,{name:'Alpha'},time);
  r.phase='live';r.endsAt=time+600000;const p=r.players[0],life=p.life;
  Object.assign(p,dirtyPlayer(),{alive:false,respawnAt:time+2000,health:0,grenades:0,equipment:'knife',ammo:0,reloadUntil:time+4000});
  advance(r,time+2000);
  assert.equal(p.alive,true);assert.equal(p.life,life+1);assert.equal(p.spawnedAt,time+2000);
  assert.deepEqual([p.vx,p.vy,p.vz,p.slideTime,p.jumpBuffer,p.lean],[0,0,0,0,0,0]);
  assert.equal(p.grounded,true);assert.equal(p.health,100);assert.equal(p.grenades,1);assert.equal(p.ammo,1);assert.equal(p.equipment,'rifle');assert.equal(p.reloadUntil,0);
});

function audioFixture(){
  const nodes=[],sources=[];
  const context={currentTime:10,state:'running',destination:{},resumes:0,
    async suspend(){this.state='suspended';},async resume(){this.resumes++;this.state='running';},async close(){this.state='closed';},
    createGain(){const events=[],n={context:this,events,connect(){},disconnect(){this.disconnected=true;},gain:{value:1,setValueAtTime(v,t){events.push(['set',v,t]);},linearRampToValueAtTime(v,t){events.push(['ramp',v,t]);},cancelScheduledValues(t){events.push(['cancel',t]);}}};nodes.push(n);return n;},
    createBufferSource(){const n={connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(at){this.stoppedAt=at;}};sources.push(n);return n;}};
  const music=createRoundMusic(()=>context);music.configure({duration:18.54},.8);music.unlock();music.countdown(5000);
  return {music,context,nodes,sources};
}
test('finishing paused practice resumes its existing finale source for the podium',()=>{
  const {music,context,nodes,sources}=audioFixture();context.currentTime=12;music.setPaused(true);music.reveal();
  assert.equal(context.state,'running');assert.equal(context.resumes,1);assert.equal(sources.length,1,'no restarted countdown track');
  assert.ok(nodes[1].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-.6)<1e-9&&e[2]===12.8));music.dispose();
});
test('leaving paused finale releases its voice and an old end callback cannot stop the next round',()=>{
  const {music,context,nodes,sources}=audioFixture();context.currentTime=12;music.setPaused(true);music.stop();music.stop();
  assert.equal(sources[0].stoppedAt,12);assert.equal(sources[0].disconnected,true);assert.equal(nodes[1].disconnected,true);assert.deepEqual(nodes[1].events.at(-1),['set',0,12]);
  music.unlock();music.countdown(5000);assert.equal(sources.length,2);sources[0].onended();music.countdown(4000);assert.equal(sources.length,2,'stale voice must not reset the active source');
  context.currentTime=14;music.reveal();assert.equal(sources.length,2);music.stop();assert.equal(sources[1].stoppedAt,14.26);music.dispose();
});
