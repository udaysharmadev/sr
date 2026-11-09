import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {updateWardrobeEffects} from '../dist/wardrobe-effects.js';
import {disposeRifle} from '../dist/rifle-models.js';
const categories=['clothing','accessories','shoes'],kinds=['flame','frost','arc','void','embers'];
function model(effect='flame',height=3){const root=new T.Group();root.userData={wardrobeHeight:height,wardrobeEffects:categories.map((category,i)=>({id:category+'-'+effect,category,effect,color:0xbbccdd+i*400}))};return root;}
test('wardrobe effects use one bounded pool across all categories with constant steady-frame resources',()=>{
 const signatures=[];
 for(const effect of kinds){const root=model(effect),group=updateWardrobeEffects(root,0),points=group.children[0],geometry=points.geometry,material=points.material;
  assert.equal(geometry.drawRange.count,18);assert.equal(root.children.length,1);assert.ok(material.depthTest);assert.equal(material.depthWrite,false);const before=[...geometry.attributes.position.array];
  for(let t=20;t<10000;t+=67){updateWardrobeEffects(root,t);assert.equal(points.geometry,geometry);assert.equal(points.material,material);assert.equal(root.children.length,1);assert.ok([...geometry.attributes.position.array].every(Number.isFinite));}
  assert.notDeepEqual([...geometry.attributes.position.array],before);signatures.push([...geometry.attributes.position.array].join(','));assert.doesNotThrow(()=>root.clone());
  updateWardrobeEffects(root,10000,{quality:'low'});assert.equal(geometry.drawRange.count,9);assert.ok([...geometry.attributes.position.array].every(Number.isFinite));disposeRifle(root);
 }
 assert.equal(new Set(signatures).size,5);
});
test('effects scale with the actor, remain behind the head, freeze for reduced motion and hide with actor',()=>{
 const big=model('frost',3),small=model('frost',1.86);const a=updateWardrobeEffects(big,200,{reducedMotion:true}),b=updateWardrobeEffects(small,200,{reducedMotion:true});
 const positions=a.children[0].geometry.attributes.position.array,other=b.children[0].geometry.attributes.position.array;
 for(let i=0;i<positions.length;i++)assert.ok(Math.abs(other[i]-positions[i]*1.86/3)<1e-6);
 // Six head particles occupy the middle of the pool; positiveZ faces the player.
 for(let i=6;i<12;i++)assert.ok(positions[i*3+2]<0);
 const frozen=[...positions];updateWardrobeEffects(big,9000,{reducedMotion:true});assert.deepEqual([...positions],frozen);
 updateWardrobeEffects(big,10000,{hidden:true});assert.equal(a.visible,false);updateWardrobeEffects(big,10001);assert.equal(a.visible,true);big.visible=false;updateWardrobeEffects(big,10002);assert.equal(a.visible,false);
 disposeRifle(big);disposeRifle(small);
});
test('gear transitions dispose the prior pool once; clearing all effects leaves no hidden allocations',()=>{
 const root=model(),group=updateWardrobeEffects(root,0),points=group.children[0];let geo=0,mat=0;points.geometry.addEventListener('dispose',()=>geo++);points.material.addEventListener('dispose',()=>mat++);
 root.userData.wardrobeEffects=[{id:'next',category:'shoes',effect:'arc'}];const next=updateWardrobeEffects(root,50);assert.notEqual(next,group);assert.equal(geo,1);assert.equal(mat,1);assert.equal(next.children[0].geometry.drawRange.count,6);assert.equal(root.children.length,1);
 let freed=0;next.children[0].geometry.addEventListener('dispose',()=>freed++);root.userData.wardrobeEffects=[];assert.equal(updateWardrobeEffects(root,100),undefined);assert.equal(freed,1);assert.equal(root.children.length,0);updateWardrobeEffects(root,200);assert.equal(freed,1);
 root.userData.wardrobeEffects=[{category:'unknown',effect:'flame'},{category:'clothing',effect:'invalid'}];updateWardrobeEffects(root,250);assert.equal(root.children.length,0);
});

test('remote-rig effect orientation keeps heel trails behind its negative-Z facing direction',()=>{
 const root=new T.Group();root.userData={wardrobeHeight:1.86,wardrobeForward:-1,wardrobeEffects:[{id:'pulse-kicks',category:'shoes',effect:'arc'}]};const group=updateWardrobeEffects(root,900),position=group.children[0].geometry.attributes.position;
 for(let i=0;i<6;i++)assert.ok(position.getZ(i)>0,'heel trail must follow behind the remote avatar');disposeRifle(root);
});
