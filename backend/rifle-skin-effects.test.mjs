import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {updateRifleSkinEffects} from '../dist/rifle-skin-effects.js';
import {rifle,setRifleFinish,disposeRifle} from '../dist/rifle-models.js';
import {RIFLE_SKINS} from '../dist/rifle-skins.js';
const kinds=['fire','frost','arc','void','relic'];
const make=type=>{const root=new T.Group();root.userData={finish:'test-'+type,skinEffect:{type}};return root;};
test('five cosmetic aura families animate differently with bounded clone-safe particle resources',()=>{
 const signatures=[];
 for(const type of kinds){const root=make(type),group=updateRifleSkinEffects(root,0),points=group.children[0],geometry=points.geometry,material=points.material;
  assert.equal(geometry.drawRange.count,12);const before=[...geometry.attributes.position.array];updateRifleSkinEffects(root,600);assert.notDeepEqual([...geometry.attributes.position.array],before);
  for(let t=0;t<10000;t+=37){updateRifleSkinEffects(root,t);assert.equal(group.children[0].geometry,geometry);assert.equal(group.children[0].material,material);assert.equal(root.children.length,1);assert.ok([...geometry.attributes.position.array].every(Number.isFinite));}
  signatures.push([...geometry.attributes.position.array].join(','));assert.doesNotThrow(()=>root.clone());
  updateRifleSkinEffects(root,1000,{quality:'low'});assert.equal(geometry.drawRange.count,6);disposeRifle(root);
 }
 assert.equal(new Set(signatures).size,5);
});
test('reduced motion freezes aura, scoped/hidden suppresses it, clearing skin releases exactly once',()=>{
 const root=make('fire'),group=updateRifleSkinEffects(root,10,{reducedMotion:true}),points=group.children[0];const before=[...points.geometry.attributes.position.array];
 updateRifleSkinEffects(root,10000,{reducedMotion:true});assert.deepEqual([...points.geometry.attributes.position.array],before);
 updateRifleSkinEffects(root,10000,{hidden:true});assert.equal(group.visible,false);updateRifleSkinEffects(root,10010);assert.equal(group.visible,true);
 let geometries=0,materials=0;points.geometry.addEventListener('dispose',()=>geometries++);points.material.addEventListener('dispose',()=>materials++);
 root.userData.skinEffect=null;updateRifleSkinEffects(root,11000);assert.equal(root.children.length,0);assert.equal(geometries,1);assert.equal(materials,1);updateRifleSkinEffects(root,11010);assert.equal(geometries,1);
});
test('all forty authored collections expose effects and switching finishes clears old aura resources',()=>{
 assert.equal(RIFLE_SKINS.length,40);
 for(const skin of RIFLE_SKINS){const root=rifle(new T.Group(),skin.weapon,false);setRifleFinish(root,skin.id);const aura=updateRifleSkinEffects(root,500);assert.ok(aura,skin.id);assert.equal(aura.parent.name,'rifle-skin-decoration');
  let count=0;aura.children[0].geometry.addEventListener('dispose',()=>count++);setRifleFinish(root,'field');assert.equal(count,1);updateRifleSkinEffects(root,600);assert.equal(root.getObjectByName('rifle-skin-aura'),undefined);disposeRifle(root);
 }
});

test('a delayed death with a newly replaced collection rifle releases its added armor resources',async()=>{
 const {createDeathEffects}=await import('../dist/death-animation.js');
 const scene=new T.Scene(),model=new T.Group(),gun=rifle(model,'sunbolt',false);model.userData.gun=gun;model.userData.weapon='sunbolt';
 const effects=createDeathEffects(scene,{boxes:[]},()=>0),skin=RIFLE_SKINS.find(s=>s.weapon==='glacier'&&s.family==='fire');
 effects.add(model,0,{weapon:'glacier',finish:skin.id,x:0,y:0,z:0});const trim=scene.getObjectByName('rifle-skin-decoration');assert.ok(trim);
 let geometry=0,material=0;trim.children[0].geometry.addEventListener('dispose',()=>geometry++);trim.children[0].material.addEventListener('dispose',()=>material++);
 effects.update(1501);assert.equal(geometry,1);assert.equal(material,1);effects.dispose();assert.equal(geometry,1);disposeRifle(model);
});
