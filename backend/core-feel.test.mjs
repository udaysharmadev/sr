import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createPlayClock} from '../dist/presentation.js';
import {KNIFE_CONTACT_MS,KNIFE_MS,knifeSwing} from '../dist/equipment.js';
import {operator,animateOperator,animateOperatorCombat,setOperatorWeapon} from '../dist/arena.js';
import {newRoom,addPlayer,advance,command} from './rooms.mjs';
import {MemoryStore,roomApi} from './api.mjs';
const at=1000000;
function fixture(){const r=newRoom('LIFEQA',false),a=addPlayer(r,{name:'Alpha'},at),b=addPlayer(r,{name:'Bravo'},at);r.phase='live';r.endsAt=at+600000;const [p,q]=r.players;for(const [i,v]of[p,q].entries())Object.assign(v,{x:24,y:0,z:20-i*2,eyeHeight:1.62,lean:0,yaw:0,shieldUntil:0,history:[]});return {r,a,b,p,q};}
test('knife full thrust coincides with its180ms contact and recovers continuously within580ms',()=>{
  const start=knifeSwing(0),contact=knifeSwing(KNIFE_CONTACT_MS);
  assert.equal(KNIFE_CONTACT_MS,180);assert.ok(Math.abs(contact.z-(start.z-.28))<1e-9);
  for(let ms=0;ms<=KNIFE_MS;ms++)assert.ok(knifeSwing(ms).z>=contact.z-1e-8,'no later thrust than damage');
  for(const boundary of [KNIFE_MS*.18,KNIFE_CONTACT_MS]){
    const a=knifeSwing(boundary-.001),b=knifeSwing(boundary+.001);for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<.0001,key);
  }
  assert.deepEqual(knifeSwing(KNIFE_MS),start);
});
test('practice clock freezes chamber, respawn and effect deadlines together; repeated pause and resume are idempotent',()=>{
  let wall=100;const clock=createPlayClock(()=>wall),chamber=clock.now()+1500,respawn=clock.now()+2000;
  wall=600;clock.setPaused(true);wall=5600;clock.setPaused(true);
  assert.equal(clock.now(),600);assert.equal(chamber-clock.now(),1000);assert.equal(respawn-clock.now(),1500);
  clock.setPaused(false);clock.setPaused(false);wall=6599;assert.equal(clock.now(),1599);assert.ok(clock.now()<chamber);
  wall=6600;assert.equal(clock.now(),chamber);wall=7100;assert.equal(clock.now(),respawn);
  clock.setPaused(true);wall=17100;assert.equal(clock.now(),respawn);clock.setPaused(false);wall+=16;assert.equal(clock.now(),respawn+16);
  const online=createPlayClock(()=>wall);const before=online.now();wall+=3000;assert.equal(online.now()-before,3000,'online menu must leave clock unpaused');
});
test('a pre-respawn timestamp cannot damage the new target life even after shield has ended',()=>{
  for(const stale of [true,false]){
    const {r,a,p,q}=fixture();q.alive=false;q.respawnAt=at+2000;advance(r,at+2000);const life=q.life;assert.equal(q.spawnedAt,at+2000);
    Object.assign(p,{x:24,z:20});Object.assign(q,{x:24,z:18,shieldUntil:0,history:[]});
    command(r,a.token,{type:'shoot',life:p.life,seq:1,yaw:0,pitch:0,at:at+(stale?1900:2020)},at+2050);
    assert.equal(q.alive,stale);assert.equal(q.life,life);assert.equal(p.shots,1,'old target timestamp still consumes an accepted shooter round');
  }
});
test('queued old-life movement and attacks cannot execute after respawn or consume new-life counters/ammo',()=>{
  const {r,a,p,q}=fixture(),oldLife=p.life;p.alive=false;p.respawnAt=at+2000;advance(r,at+2000);assert.equal(p.life,oldLife+1);
  Object.assign(p,{x:24,z:20,shieldUntil:0});Object.assign(q,{x:24,z:18,shieldUntil:0,history:[]});
  const state=()=>JSON.stringify({x:p.x,z:p.z,ammo:p.ammo,shots:p.shots,grenades:p.grenades,equipment:p.equipment,prime:p.grenadePrimedAt,seq:p.inputSeq,shotSeq:p.shotSeq,equipmentSeq:p.equipmentSeq,health:q.health});
  const before=state();
  for(const action of [{type:'input',seq:999,frames:[{forward:1,dt:.05}]},{type:'shoot',seq:999,yaw:0,pitch:0},{type:'equip',equipment:'grenade'},{type:'prime'},{type:'throw',seq:999,yaw:0,pitch:0},{type:'melee',seq:999,yaw:0,pitch:0},{type:'cancelprime'},{type:'reload'}])command(r,a.token,{...action,life:oldLife},at+2010);
  assert.equal(state(),before);
  command(r,a.token,{type:'shoot',life:p.life,seq:1,yaw:0,pitch:0},at+2020);assert.equal(q.alive,false);assert.equal(p.shots,1);
});
test('lag-compensated head lean crosses the short yaw arc at±pi instead of swinging to the other side',()=>{
  const {r,a,p,q}=fixture();Object.assign(p,{x:23.87,z:20,eyeHeight:1.62});Object.assign(q,{x:24,z:16,eyeHeight:1.62,lean:.15,yaw:-Math.PI+.1});
  q.history=[{at,x:24,y:0,z:16,eyeHeight:1.62,lean:.15,yaw:Math.PI-.1},{at:at+100,x:24,y:0,z:16,eyeHeight:1.62,lean:.15,yaw:-Math.PI+.1}];
  command(r,a.token,{type:'shoot',life:p.life,seq:1,yaw:0,pitch:Math.atan2(.17,4),at:at+50},at+100);
  assert.equal(q.alive,false);assert.equal(r.events.at(-1).headshot,true);
});
test('remote shot presentation retains the accepted flick aim and origin instead of a later movement/respawn pose',()=>{
  const {r,a,p}=fixture();p.lean=.15;const yaw=-.9,pitch=.3;
  command(r,a.token,{type:'shoot',life:p.life,seq:1,yaw,pitch},at);
  const shot=r.events.find(e=>e.type==='shot'),before=structuredClone(shot);
  assert.equal(shot.yaw,yaw);assert.equal(shot.pitch,pitch);assert.equal(shot.life,p.life);
  assert.ok(Math.abs(shot.origin[0]-(24+Math.cos(yaw)*.15))<1e-9);assert.ok(Math.abs(shot.origin[2]-(20-Math.sin(yaw)*.15))<1e-9);assert.equal(shot.origin[1],1.62);
  p.alive=false;p.respawnAt=at+2000;advance(r,at+2000);assert.notEqual(p.life,shot.life);assert.deepEqual(shot,before);
});
test('combat atomically applies the pending movement/ADS batch before deriving the shot origin, and retries cannot move or shoot twice',()=>{
  const {r,a,p,q}=fixture();Object.assign(p,{x:23.3,vx:7,credit:.1,moveTime:at});Object.assign(q,{x:24,z:16});
  const data={type:'shoot',life:p.life,seq:1,yaw:0,pitch:0,at,input:{seq:1,frames:Array.from({length:6},()=>({strafe:1,scoped:true,yaw:0,dt:1/60}))}};
  command(r,a.token,data,at);assert.ok(Math.abs(p.x-24)<1e-7);assert.equal(q.alive,false);assert.equal(r.events.at(-1).quickscope,true);
  const shot=r.events.find(e=>e.type==='shot');assert.ok(Math.abs(shot.origin[0]-24)<1e-7);assert.equal(p.inputSeq,1);
  const before={x:p.x,shots:p.shots,kills:p.kills,credit:p.credit};command(r,a.token,data,at);assert.deepEqual({x:p.x,shots:p.shots,kills:p.kills,credit:p.credit},before);
  command(r,a.token,{type:'input',life:p.life,...data.input},at);assert.equal(p.x,before.x,'late ordinary copy of the same input is ignored');
});
test('piggybacked movement still obeys time credit, collisions, legal fields and life checks',()=>{
  const {r,a,p,q}=fixture();Object.assign(p,{x:8.1,z:8,vx:7,credit:.1,moveTime:at});Object.assign(q,{x:12,z:8});
  const packet={type:'prime',life:p.life,x:999,z:999,input:{seq:1,frames:Array.from({length:32},()=>({strafe:1,yaw:0,dt:50,x:999,z:999}))}};
  command(r,a.token,packet,at);assert.ok(p.x<9,'near wall prevents crossing');assert.ok(p.x<8.81,'packet cannot create more than100ms of motion');assert.equal(p.credit,0);assert.equal(p.grenadePrimedAt,null,'input does not bypass equipment requirements');
  const x=p.x;command(r,a.token,{...packet,input:{...packet.input,seq:2}},at);assert.equal(p.x,x,'a fresh input sequence cannot refill elapsed-time budget');
});
test('remote combat pose follows lean/aim, reaches at knife contact and restores rest without touching geometry',()=>{
  const model=operator(new T.Scene()),head=model.children.find(n=>n.isMesh&&Math.abs(n.position.y-1.55)<.001),rightArm=model.children.find(n=>n.isMesh&&n.position.x>.24&&n.position.y<1.3&&n.position.y>.9);
  const restHead=head.position.clone(),restArm=rightArm.position.clone(),restGun=model.userData.gun.position.clone(),count=model.children.length,geometry=head.geometry;
  animateOperatorCombat(model,{lean:.15,pitch:.8,snap:true},1/60);assert.ok(Math.abs(head.position.x-restHead.x-.15)<1e-9);assert.ok(model.userData.gun.rotation.x>.6);assert.equal(head.geometry,geometry);
  animateOperatorCombat(model,{swingAge:KNIFE_CONTACT_MS,snap:true},1/60);assert.ok(rightArm.position.z<restArm.z-.17);
  animateOperatorCombat(model,{charge:1,snap:true},1/60);const primed=rightArm.position.z;animateOperatorCombat(model,{throwAge:190,snap:true},1/60);assert.ok(rightArm.position.z<primed-.1);
  animateOperatorCombat(model,{snap:true},1/60);assert.ok(head.position.distanceTo(restHead)<1e-9);assert.ok(rightArm.position.distanceTo(restArm)<1e-9);assert.ok(model.userData.gun.position.distanceTo(restGun)<1e-9);
  assert.equal(model.children.length,count);assert.doesNotThrow(()=>model.clone());
  setOperatorWeapon(model,'prism');animateOperatorCombat(model,{pitch:-.6,snap:true},1/60);assert.ok(model.userData.gun.rotation.x<-.4);
});
test('remote pose interpolation is frame-rate independent, retains stride, and reduced motion suppresses decorative attack jerk',()=>{
  const results=[];
  for(const hz of [30,60,144]){
    const model=operator(new T.Scene());for(let i=0;i<hz;i++){animateOperator(model,5,1/hz);animateOperatorCombat(model,{lean:.15,pitch:.6},1/hz);}
    const head=model.children.find(n=>n.isMesh&&n.geometry.type==='BoxGeometry'&&Math.abs(n.position.y-1.55)<.1&&n.position.x<.16&&n.position.x>.14);assert.ok(head);results.push(head.position.x);assert.ok(model.userData.legs.some(({node,rotation})=>Math.abs(node.rotation.x-rotation)>.01));
    animateOperatorCombat(model,{swingAge:180,reducedMotion:true,snap:true},1/hz);const arm=model.children.find(n=>n.isMesh&&n.position.x>.24&&n.position.y<1.3&&n.position.y>.9);assert.equal(arm.position.z,0);
  }
  assert.ok(Math.max(...results)-Math.min(...results)<1e-9);
});

test('three independent API clients agree after concurrent shot retries, respawn, stale commands and a pre-spawn timestamp',async()=>{
  let time=at;const store=new MemoryStore(),api=roomApi(store,()=>time);
  const post=async(type,data={},client)=>{
    const reply=await api(new Request('http://local.test/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',...(client?{Authorization:'Bearer '+client.token}:{})},body:JSON.stringify({...data,type,...(client?{code:client.code}:{})})}));
    const result=await reply.json();assert.equal(reply.status,200,result.error);return result;
  };
  const a=await post('create',{name:'Alpha'}),b=await post('join',{name:'Bravo',code:a.code}),c=await post('join',{name:'Charlie',code:a.code});
  await Promise.all([a,b,c].map(client=>post('ready',{ready:true},client)));await post('start',{},a);time+=10000;await post('refresh',{},a);
  const arrange=async()=>{
    const row=await store.read(a.code),positions=[[24,20],[24,18],[22,18]];
    for(const [i,p]of row.room.players.entries())Object.assign(p,{x:positions[i][0],y:0,z:positions[i][1],eyeHeight:1.62,lean:0,yaw:0,shieldUntil:0,history:[]});
    assert.equal(await store.write(a.code,row,row.room,time),true);
  };
  await arrange();const initial=(await post('refresh',{},a)).state,oldLife=initial.players.find(p=>p.id===b.id).life,lifeA=initial.players.find(p=>p.id===a.id).life;
  await Promise.all([post('shoot',{seq:1,life:lifeA,yaw:0,pitch:0,at:time},a),post('shoot',{seq:1,life:lifeA,yaw:0,pitch:0,at:time},a),post('refresh',{},c)]);
  for(const client of[a,b,c]){const state=(await post('refresh',{},client)).state;assert.equal(state.players.find(p=>p.id===a.id).kills,1);assert.equal(state.players.find(p=>p.id===b.id).deaths,1);assert.equal(state.events.filter(e=>e.type==='shot').length,1);}
  time+=2000;await post('refresh',{},b);await arrange();const current=(await post('refresh',{},b)).state,newLife=current.players.find(p=>p.id===b.id).life;assert.equal(newLife,oldLife+1);
  await post('input',{life:oldLife,seq:999,frames:[{forward:1,dt:.05}]},b);
  await post('shoot',{life:current.players.find(p=>p.id===c.id).life,seq:1,yaw:-Math.PI/2,pitch:0,at:time-100},c);
  for(const client of[a,b,c]){const state=(await post('refresh',{},client)).state,bravo=state.players.find(p=>p.id===b.id);assert.equal(bravo.alive,true);assert.equal(bravo.health,100);assert.equal(bravo.inputSeq,0);assert.equal(bravo.z,18);assert.equal(bravo.life,newLife);assert.equal(state.players.find(p=>p.id===c.id).kills,0);}
  const moved=(await post('input',{life:newLife,seq:1,frames:[{strafe:1,dt:.05}]},b)).state.players.find(p=>p.id===b.id);assert.ok(moved.x>24);assert.equal(moved.inputSeq,1);
});
