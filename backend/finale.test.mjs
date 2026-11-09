import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import { createRoundMusic } from '../dist/round-music.js';
import { knifeSwing } from '../dist/equipment.js';
import { animateLoadoutPose } from '../dist/results-stage.js';
import { ownResources } from '../dist/stage.js';
import { setPlatformMuted } from '../dist/platform-audio.js';

test('five-second music fades into the same source at result reveal and obeys mute/cleanup',()=>{
 const nodes=[], sources=[];const context={currentTime:10,state:'running',destination:{},suspend:async()=>{context.state='suspended';},resume:async()=>{context.state='running';},close:async()=>{},createGain(){const events=[];const n={context:this,events,connect(){},disconnect(){this.disconnected=true;},gain:{value:1,setValueAtTime(v,t){events.push(['set',v,t]);},linearRampToValueAtTime(v,t){events.push(['ramp',v,t]);},cancelScheduledValues(t){events.push(['cancel',t]);}}};nodes.push(n);return n;},createBufferSource(){const n={connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(at){this.stoppedAt=at;}};sources.push(n);return n;}};
  const music=createRoundMusic(()=>context);music.configure({duration:18.54},.8);music.unlock();music.countdown(5001);assert.equal(sources.length,0);music.countdown(5000);music.countdown(4500);assert.equal(sources.length,1);assert.deepEqual(nodes[1].events.slice(0,2),[['set',0,10],['ramp',.8*.28,15]]);
  music.setPaused(true);assert.equal(context.state,'suspended');music.setPaused(false);assert.equal(context.state,'running');assert.equal(sources.length,1,'practice pause resumes the same finale source');
  context.currentTime=15;music.reveal();assert.equal(sources.length,1,'result pose must not restart music');assert.ok(nodes[1].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-.6)<1e-9&&e[2]===15.8));setPlatformMuted(true);assert.deepEqual(nodes[0].events.at(-1),['set',0,15]);setPlatformMuted(false);
  music.configure(null,0);assert.ok(nodes[1].events.filter(e=>e[1]===0).length>=3,'in-match volume change mutes the ongoing finale');assert.equal(sources.length,1,'volume changes keep the same source');
  music.configure(null,.8);assert.ok(nodes[1].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-.6)<1e-9&&e[2]===15.8));
  music.stop();assert.equal(sources[0].stoppedAt,15.26);sources[0].onended();assert.equal(sources[0].disconnected,true);music.dispose();assert.equal(nodes[0].disconnected,true);
});
test('knife windup, contact and recovery alternate sides without leaving a permanent pose',()=>{
  const start=knifeSwing(0),end=knifeSwing(580),a=knifeSwing(230,1),b=knifeSwing(230,-1),reduced=knifeSwing(230,1,true);
  assert.deepEqual(start,end);assert.notEqual(a.x,b.x);assert.ok(a.z<start.z-.2);assert.ok(Math.abs(reduced.z-start.z)<Math.abs(a.z-start.z));assert.ok(Object.values(a).every(Number.isFinite));
});
test('rifle victory poses stay distinct and stable with reduced motion',()=>{
  const poses=[];for(let place=0;place<3;place++){const actor={chest:new T.Group(),head:new T.Group(),heldGun:new T.Group(),arms:[{root:new T.Group(),side:-1},{root:new T.Group(),side:1}]};animateLoadoutPose(actor,place,0,true);const rotation=actor.heldGun.rotation.toArray();animateLoadoutPose(actor,place,3,true);assert.deepEqual(actor.heldGun.rotation.toArray(),rotation);poses.push(rotation.join(','));}assert.equal(new Set(poses).size,3);
});

test('result actors own their copied materials, textures and geometry without releasing lobby templates',()=>{
 const geometry=new T.BoxGeometry(), texture=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1), material=new T.MeshStandardMaterial({map:texture,bumpMap:texture});
 const actor=new T.Group(),body=new T.Mesh(geometry,material),arm=new T.Mesh(geometry,material);actor.add(body,arm);
 const owned=ownResources(actor);assert.notEqual(body.geometry,geometry);assert.equal(body.geometry,arm.geometry);assert.notEqual(body.material,material);assert.notEqual(body.material.map,texture);assert.equal(body.material.map,body.material.bumpMap);assert.equal(owned.materials.get(material),body.material);
 let sharedReleased=false;texture.addEventListener('dispose',()=>sharedReleased=true);body.material.map.dispose();body.material.dispose();body.geometry.dispose();assert.equal(sharedReleased,false);
});
