import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import { listenMouseButtons } from '../dist/mouse-input.js';
import { createEquipmentEffects } from '../dist/equipment-models.js';
import { grenadeLaunch, stepGrenade, FUSE_MS } from '../dist/equipment.js';
import { newRoom, addPlayer, command } from './rooms.mjs';
const at=1000000;
function setup(){const r=newRoom('MICROA',false),a=addPlayer(r,{name:'Alpha'},at),b=addPlayer(r,{name:'Bravo'},at);r.phase='live';r.endsAt=at+600000;const [p,q]=r.players;for(const [i,v] of [p,q].entries())Object.assign(v,{x:24,y:0,z:20-i*2,eyeHeight:1.62,yaw:0,alive:true,shieldUntil:0,history:[]});return {r,a,p,q};}
test('same equipment selection preserves grenade hold power and rifle ADS; an actual switch cancels prime',()=>{
  const {r,a,p}=setup();p.scoped=true;p.scopeSince=at;
  command(r,a.token,{type:'equip',equipment:'rifle'},at+100);assert.equal(p.scoped,true);assert.equal(p.scopeSince,at);
  command(r,a.token,{type:'equip',equipment:'grenade'},at+100);command(r,a.token,{type:'prime'},at+100);
  command(r,a.token,{type:'equip',equipment:'grenade'},at+900);assert.equal(p.grenadePrimedAt,at+100);
  command(r,a.token,{type:'throw',seq:1,yaw:0,pitch:0,holdMs:1200},at+1300);assert.ok(Math.abs(r.grenades[0].vz+22.2)<.0001);
  const other=setup();command(other.r,other.a.token,{type:'equip',equipment:'grenade'},at);command(other.r,other.a.token,{type:'prime'},at);command(other.r,other.a.token,{type:'equip',equipment:'knife'},at+10);command(other.r,other.a.token,{type:'throw',seq:1,yaw:0,pitch:0},at+1200);
  assert.equal(other.p.grenades,1);assert.equal(other.r.grenades.length,0);assert.equal(other.p.grenadePrimedAt,null);
});
test('fast equipment switches cannot reset the knife recovery or a sniper chamber',()=>{
  const {r,a,p,q}=setup();command(r,a.token,{type:'shoot',seq:1,yaw:Math.PI,pitch:0},at);const reload=p.reloadUntil;
  command(r,a.token,{type:'equip',equipment:'knife'},at);command(r,a.token,{type:'melee',seq:1,yaw:0,pitch:0},at);assert.equal(q.health,50);
  command(r,a.token,{type:'equip',equipment:'rifle'},at+100);command(r,a.token,{type:'equip',equipment:'knife'},at+150);command(r,a.token,{type:'melee',seq:2,yaw:0,pitch:0},at+200);assert.equal(q.health,50);assert.equal(p.reloadUntil,reload);
  command(r,a.token,{type:'melee',seq:3,yaw:0,pitch:0},at+580);assert.equal(q.alive,false);
});
test('missed window releases cancel abandoned mouse chords once without generating a grenade throw',()=>{
  const canvas=new EventTarget(),window=new EventTarget(),abort=new AbortController();let down=0,up=0,cancels=0;
  listenMouseButtons(canvas,window,()=>down++,()=>up++,abort.signal,()=>cancels++);
  const send=(target,type,button,buttons)=>{const event=new Event(type);Object.assign(event,{button,buttons});target.dispatchEvent(event);};
  send(canvas,'mousedown',2,2);send(canvas,'mousedown',0,3);send(window,'mousemove',0,3);assert.equal(cancels,0);
  send(window,'mousemove',0,2);assert.equal(cancels,1);assert.equal(up,0,'lost release cancels rather than throws');send(window,'mousemove',0,0);assert.equal(cancels,1);
  send(canvas,'mousedown',0,1);send(window,'mouseup',0,0);assert.equal(up,1,'normal release still throws');
  send(canvas,'mousedown',0,1);window.dispatchEvent(new Event('blur'));assert.equal(cancels,2);send(window,'mousemove',0,0);assert.equal(cancels,2);
  abort.abort();send(canvas,'mousedown',0,1);send(window,'mouseup',0,0);assert.equal(down,4);assert.equal(up,1);
});
test('throw guide follows the shared bounced fuse position, refreshes at most every80ms and reuses its meshes',()=>{
  const map={half:20,boxes:[{x:0,z:-3,w:8,d:.1,h:8}]},pose={x:0,y:0,z:0,yaw:0,pitch:.1,eyeHeight:1.62};
  const scene=new T.Scene(),fx=createEquipmentEffects(scene,map);fx.guide(pose,1,0,true);const root=scene.children[0],nodes=root.children.slice(),end=nodes.at(-1).position.clone();assert.equal(nodes.length,12);assert.ok(nodes.every(n=>n.material.depthTest&&n.position.z> -3));
  const actual=grenadeLaunch(pose,1,map);stepGrenade(actual,map,FUSE_MS/1000);assert.ok(end.distanceTo(new T.Vector3(actual.x,actual.y,actual.z))<1e-7);
  fx.guide({...pose,yaw:1},.2,30,true);assert.deepEqual(nodes.at(-1).position,end);
  fx.guide({...pose,yaw:1},.2,80,true);assert.ok(nodes.at(-1).position.distanceTo(end)>1);assert.deepEqual(root.children,nodes);
  fx.guide(pose,0,81,false);assert.equal(root.visible,false);fx.guide(pose,1,82,true);assert.equal(root.visible,true);assert.ok(nodes.at(-1).position.distanceTo(end)<1e-7,'showing a guide refreshes immediately');
  let disposed=0;nodes[0].material.addEventListener('dispose',()=>disposed++);fx.dispose();assert.equal(disposed,1);assert.equal(scene.children.length,0);
});
