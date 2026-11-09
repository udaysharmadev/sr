import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import { playerAlias, grenadeLaunch, stepGrenade, FUSE_MS } from '../dist/equipment.js';
import { equipmentModel, createEquipmentEffects } from '../dist/equipment-models.js';
import { MAPS } from '../dist/maps.js';
import { addPlayer, newRoom, command, advance, snapshot } from './rooms.mjs';
const at=1000000;
function room(){const r=newRoom('EXTRAA',false);const a=addPlayer(r,{name:'Alpha'},at),b=addPlayer(r,{name:'Bravo'},at);r.phase='live';r.endsAt=at+600000;const [p,q]=r.players;for(const [i,v] of [p,q].entries())Object.assign(v,{x:24,y:0,z:20-i*2,eyeHeight:1.62,yaw:0,lean:0,alive:true,shieldUntil:0,history:[]});return {r,a,b,p,q};}

test('player alias sanitization is shared by join and rename without replacing career identity',()=>{
  assert.equal(playerAlias('  Ａlpha_ 42!  '),'Alpha_ 42');assert.equal(playerAlias('a'.repeat(40)).length,22);
  const {r,a,p}=room(),id=p.id;command(r,a.token,{type:'rename',name:' New Pilot! '},at);assert.equal(p.name,'New Pilot');assert.equal(p.id,id);
  assert.throws(()=>command(r,a.token,{type:'rename',name:'<>'},at),/2–22/);
});
test('tap throws stay nearby, full holds travel farther and solver is frame-rate independent',()=>{
  const map={half:100,boxes:[]},pose={x:0,y:0,z:0,yaw:0,pitch:0,eyeHeight:1.62};
  const ranges=[];
  for(const charge of [0,1]){const samples=[];for(const hz of [30,60,144]){const g=grenadeLaunch(pose,charge);for(let i=0;i<hz*2;i++)stepGrenade(g,map,1/hz);assert.ok(g.y>=.12);assert.ok(Math.abs(g.age-FUSE_MS/1000)<1e-6);samples.push(g);}
    assert.ok(Math.abs(samples[0].z-samples[2].z)<.15);ranges.push(Math.abs(samples[0].z));}
  assert.ok(ranges[0]<4);assert.ok(ranges[1]>20);assert.ok(ranges[1]>ranges[0]*5);
});
test('grenades bounce before thin walls and stay within playable boundaries',()=>{
  const map={half:10,boxes:[{x:0,z:-3,w:8,d:.16,h:8,y:0}]},g=grenadeLaunch({x:0,y:0,z:0,yaw:0,pitch:0,eyeHeight:1.62},1);
  const close=grenadeLaunch({x:0,y:0,z:-2.5,yaw:0,pitch:0,eyeHeight:1.62},1,map);assert.ok(close.z>-2.8,'hand origin clipped through thin cover');
  for(let i=0;i<240;i++){stepGrenade(g,map,1/120);assert.ok(g.z> -2.8,'projectile tunneled through wall');assert.ok(Math.abs(g.x)<10&&Math.abs(g.z)<10);}
});
test('knife requires selected equipment, range, cooldown and a clear view; rifle statistics stay separate',()=>{
  const {r,a,p,q}=room();command(r,a.token,{type:'melee',seq:1,yaw:0,pitch:0},at);assert.equal(q.alive,true);
  command(r,a.token,{type:'equip',equipment:'knife'},at);command(r,a.token,{type:'shoot',seq:1,yaw:0,pitch:0},at);assert.equal(p.shots,0);
  command(r,a.token,{type:'melee',seq:2,yaw:0,pitch:0},at);assert.equal(q.alive,true);assert.equal(q.knifeHits,1);
  command(r,a.token,{type:'melee',seq:3,yaw:0,pitch:0},at+100);assert.equal(q.knifeHits,1);
  command(r,a.token,{type:'melee',seq:4,yaw:0,pitch:0},at+580);assert.equal(q.alive,false);assert.equal(p.kills,1);assert.equal(p.hits,0);assert.equal(r.events.at(-1).weapon,'knife');
  q.alive=true;command(r,a.token,{type:'melee',seq:5,yaw:0,pitch:0},at+600);assert.equal(q.alive,true);
  q.z=16;command(r,a.token,{type:'melee',seq:6,yaw:0,pitch:0},at+1200);assert.equal(q.alive,true);
  Object.assign(p,{x:8.1,z:8});Object.assign(q,{x:10.4,z:8});command(r,a.token,{type:'melee',seq:7,yaw:-Math.PI/2,pitch:0},at+1800);assert.equal(q.alive,true);
});
test('server measures grenade hold time, rejects forged instant power and deduplicates throw commands',()=>{
  const {r,a,p}=room();command(r,a.token,{type:'equip',equipment:'grenade'},at);command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0,charge:1},at);assert.equal(r.grenades.length,0);
  command(r,a.token,{type:'prime'},at);command(r,a.token,{type:'throw',seq:2,yaw:0,pitch:0,charge:1,x:0,z:0},at+10);
  assert.equal(r.grenades.length,1);assert.ok(Math.abs(r.grenades[0].vz)<3);assert.ok(Math.abs(r.grenades[0].x-p.x)<.5);
  command(r,a.token,{type:'throw',seq:2,yaw:0,pitch:0},at+20);command(r,a.token,{type:'prime'},at+20);assert.equal(r.grenades.length,1);assert.equal(p.grenadePrimedAt,null);
  assert.equal(snapshot(r,at+20).grenades.length,1);
});
test('grenade fuse awards authoritative nearby kills once, supports self-death and preserves rifle mastery',()=>{
  const {r,a,p,q}=room();command(r,a.token,{type:'equip',equipment:'grenade'},at);command(r,a.token,{type:'prime'},at);command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0},at+10);
  advance(r,at+1809);assert.equal(q.alive,true);advance(r,at+1810);assert.equal(q.alive,false);assert.equal(p.alive,false);assert.equal(p.kills,1);assert.equal(p.deaths,1);assert.equal(p.hits,0);assert.deepEqual(p.weaponStats,{});assert.equal(r.grenades.length,0);
  const count=p.kills;advance(r,at+1900);assert.equal(p.kills,count);assert.equal(r.events.filter(e=>e.type==='explosion').length,1);
});
test('blast respects hard cover, shields and team rules; switching cancels prime and respawn resets equipment',()=>{
  for(const reason of ['cover','shield','team']){
    const {r,p,q}=room();Object.assign(p,{x:24,z:20});Object.assign(q,{x:-8.5,z:9.5});
    const blast=reason==='cover'?{x:-11.5,z:9.5}:{x:-7.2,z:9.5};
    if(reason==='shield')q.shieldUntil=at+4000;if(reason==='team'){p.team=q.team='blue';r.settings.mode='tdm';}
    r.grenades=[{...blast,y:.12,vx:0,vy:0,vz:0,age:0,owner:p.id,id:'test',createdAt:at,updatedAt:at}];advance(r,at+1800);assert.equal(q.alive,true,reason);
  }
  const {r,a,p}=room();command(r,a.token,{type:'equip',equipment:'grenade'},at);command(r,a.token,{type:'prime'},at);command(r,a.token,{type:'equip',equipment:'knife'},at+100);assert.equal(p.grenadePrimedAt,null);command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0},at+200);assert.equal(r.grenades.length,0);
  p.alive=false;p.respawnAt=at+2000;advance(r,at+2000);assert.equal(p.equipment,'rifle');assert.equal(p.grenadePrimedAt,null);
});
test('original knife and grenade meshes are finite, clone-safe, and pooled effects release resources',()=>{
  const scene=new T.Scene();for(const kind of ['knife','grenade']){const m=equipmentModel(scene,kind,true),size=new T.Box3().setFromObject(m).getSize(new T.Vector3());assert.ok(size.y>.4&&size.x>.1);assert.doesNotThrow(()=>m.clone());}
  const effects=createEquipmentEffects(scene),start=scene.children.length;effects.sync([{id:'a',x:0,y:1,z:0,age:0}]);effects.sync([]);assert.equal(scene.children.length,start);effects.blast(new T.Vector3(),0);effects.update(4001);assert.equal(scene.children.length,start);effects.dispose();
});

test('server caps a long hold, blocks spectator attacks and preserves a sniper chamber while switching',()=>{
  const {r,a,p,q}=room();
  command(r,a.token,{type:'shoot',seq:1,yaw:0,pitch:0},at); const reload=p.reloadUntil;
  command(r,a.token,{type:'equip',equipment:'knife'},at+50);command(r,a.token,{type:'equip',equipment:'rifle'},at+100);assert.equal(p.reloadUntil,reload);assert.equal(p.ammo,0);
  command(r,a.token,{type:'equip',equipment:'grenade'},at+150);command(r,a.token,{type:'prime'},at+200);command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0,charge:0},at+5200);assert.equal(r.grenades.length,1);assert.ok(Math.abs(r.grenades[0].vz-(-22.2))<.001);
  p.spectator=true;p.grenadeReadyAt=0;command(r,a.token,{type:'prime'},at+6000);assert.equal(p.grenadePrimedAt,null);
});

test('each life supplies exactly one grenade and a spent throw returns to sniper until respawn',()=>{
 const {r,a,p}=room();command(r,a.token,{type:'equip',equipment:'grenade'},at);command(r,a.token,{type:'prime'},at);command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0},at+100);assert.equal(p.grenades,0);assert.equal(p.equipment,'rifle');assert.throws(()=>command(r,a.token,{type:'equip',equipment:'grenade'},at+10000),/No grenade/);
 p.alive=false;p.respawnAt=at+2000;advance(r,at+2000);assert.equal(p.grenades,1);assert.equal(p.knifeHits,0);
});
test('a 1cm rifle graze counts while a wider miss and nearer cover do not',()=>{
 for(const [offset,hit] of [[.329,true],[.331,false]]){const {r,a,p,q}=room();Object.assign(p,{x:23,z:20,yaw:0});Object.assign(q,{x:23+offset,z:14});command(r,a.token,{type:'shoot',seq:1,yaw:0,pitch:-.1},at);assert.equal(!q.alive,hit,'offset '+offset);}
 const {r,a,p,q}=room();Object.assign(p,{x:8.1,z:8});Object.assign(q,{x:11,z:8});command(r,a.token,{type:'shoot',seq:1,yaw:-Math.PI/2,pitch:0},at);assert.equal(q.alive,true);
});

test('a queued tap retains its short power while a forged full hold cannot bypass server elapsed time',()=>{
 for(const [elapsed,hold,power] of [[1500,80,'short'],[10,1200,'short'],[1300,1200,'long']]){const {r,a}=room();command(r,a.token,{type:'equip',equipment:'grenade'},at);command(r,a.token,{type:'prime'},at);command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0,holdMs:hold},at+elapsed);assert.equal(r.grenades.length,1);const speed=Math.abs(r.grenades[0].vz);assert.ok(power==='short'?speed<4:speed>22);}
});
