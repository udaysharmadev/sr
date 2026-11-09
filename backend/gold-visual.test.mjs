import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {rifle,setRifleFinish,disposeRifle} from '../dist/rifle-models.js';
import {updateRifleSkinEffects} from '../dist/rifle-skin-effects.js';
import {WEAPONS} from '../dist/weapons.js';
test('Gold adds sculpted crown/filigree and engraved metal across8rifles without shifting combat anchors',()=>{
 for(const spec of WEAPONS){
  const root=rifle(new T.Group(),spec.id,false),base=new T.Box3().setFromObject(root).getSize(new T.Vector3()),bolt=root.userData.bolt,flash=root.userData.flash,boltAt=bolt.position.clone(),flashAt=flash.position.clone();let steel;root.traverse(o=>{if(o.material?.name==='rifle-steel')steel=o.material;});const original={map:steel.map,color:steel.color.getHex(),metalness:steel.metalness,roughness:steel.roughness};
  setRifleFinish(root,'gold');const trim=root.getObjectByName('rifle-skin-decoration');assert.ok(trim);assert.ok(trim.children.length>=30);assert.equal(root.userData.skinEffect.type,'gold');assert.notEqual(steel.map,original.map);assert.ok(new Set(steel.map.image.data).size>12);assert.ok(steel.metalness>.9);assert.ok(steel.roughness<.2);assert.doesNotThrow(()=>root.clone());
  const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());for(const axis of ['x','y','z'])assert.ok(size[axis]<=base[axis]+.14,'gold trim must stay bounded');
  assert.equal(root.userData.bolt,bolt);assert.equal(root.userData.flash,flash);assert.deepEqual(bolt.position,boltAt);assert.deepEqual(flash.position,flashAt);
  let disposed=0;trim.children[0].geometry.addEventListener('dispose',()=>disposed++);setRifleFinish(root,'field');assert.equal(disposed,1);assert.equal(root.getObjectByName('rifle-skin-decoration'),undefined);assert.equal(root.userData.skinEffect,null);assert.equal(steel.map,original.map);assert.equal(steel.color.getHex(),original.color);assert.equal(steel.metalness,original.metalness);assert.equal(steel.roughness,original.roughness);disposeRifle(root);
 }
});
test('Gold aura mixes star sparks and faint vapor in one bounded reduced-motion-aware pool',()=>{
 const root=rifle(new T.Group(),'sunbolt',false);setRifleFinish(root,'gold');const group=updateRifleSkinEffects(root,100),points=group.children[0],geometry=points.geometry,material=points.material;
 assert.equal(geometry.drawRange.count,12);assert.deepEqual([...geometry.attributes.aShape.array],[1,0,1,0,1,0,1,0,1,0,1,0]);const before=[...geometry.attributes.position.array];updateRifleSkinEffects(root,900);assert.notDeepEqual([...geometry.attributes.position.array],before);assert.equal(points.geometry,geometry);assert.equal(points.material,material);assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
 updateRifleSkinEffects(root,900,{reducedMotion:true,quality:'low'});const still=[...geometry.attributes.position.array];updateRifleSkinEffects(root,1900,{reducedMotion:true,quality:'low'});assert.deepEqual([...geometry.attributes.position.array],still);assert.equal(geometry.drawRange.count,6);updateRifleSkinEffects(root,2000,{hidden:true});assert.equal(group.visible,false);
 let freed=0;geometry.addEventListener('dispose',()=>freed++);setRifleFinish(root,'field');assert.equal(freed,1);disposeRifle(root);
});
test('a delayed Gold corpse uses frozen gold and frees new engraved trim and texture once',async()=>{
 const {createDeathEffects}=await import('../dist/death-animation.js');const scene=new T.Scene(),model=new T.Group(),gun=rifle(model,'sunbolt',false);model.userData.gun=gun;model.userData.weapon='sunbolt';
 const effects=createDeathEffects(scene,{boxes:[]},()=>0);effects.add(model,0,{weapon:'glacier',finish:'gold',x:0,y:0,z:0});const trim=scene.getObjectByName('rifle-skin-decoration');assert.ok(trim);let geometry=0,material=0,texture=0;trim.children[0].geometry.addEventListener('dispose',()=>geometry++);trim.children[0].material.addEventListener('dispose',()=>material++);
 let map;scene.traverse(o=>{if(o.material?.name==='rifle-steel')map=o.material.map;});assert.ok(map);map.addEventListener('dispose',()=>texture++);
 effects.update(1501);assert.equal(geometry,1);assert.equal(material,1);assert.equal(texture,1);effects.dispose();assert.equal(geometry,1);disposeRifle(model);
});
