import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {RIFLE_SKINS,skinsForRifle,rifleSkinById} from '../dist/rifle-skins.js';
import {WEAPONS} from '../dist/weapons.js';
import {CATALOG} from '../dist/catalog.js';
import {rifle,setRifleFinish,disposeRifle} from '../dist/rifle-models.js';

test('eight authored collections each contain five unique priced family identities',()=>{
 assert.equal(RIFLE_SKINS.length,40);assert.equal(new Set(RIFLE_SKINS.map(s=>s.id)).size,40);assert.equal(new Set(RIFLE_SKINS.map(s=>s.name)).size,40);
 for(const weapon of WEAPONS){const skins=skinsForRifle(weapon.id);assert.equal(skins.length,5);assert.equal(new Set(skins.map(s=>s.family)).size,5);for(const skin of skins){assert.equal(rifleSkinById(skin.id),skin);assert.ok(skin.price>=10000&&skin.price<=50000);assert.equal(CATALOG.wraps.find(x=>x[0]==='wrap-'+skin.id)[2],skin.price);}}
});
test('forty collection skins have unique real geometry signatures, finite bounds and clone-safe effect descriptors',()=>{
 const signatures=new Set();
 for(const spec of WEAPONS){const root=rifle(new T.Group(),spec.id,false),bolt=root.userData.bolt,flash=root.userData.flash,boltAt=bolt.position.clone(),flashAt=flash.position.clone();
 for(const skin of skinsForRifle(spec.id)){
  setRifleFinish(root,skin.id);const trim=root.getObjectByName('rifle-skin-decoration');assert.ok(trim);const signature=[];
  trim.traverse(o=>{if(!o.geometry)return;signature.push(o.geometry.type,JSON.stringify(o.geometry.parameters),...o.position.toArray(),...o.rotation.toArray());assert.ok([...o.geometry.getAttribute('position').array].every(Number.isFinite));});
  signatures.add(signature.join('|'));const bounds=new T.Box3().setFromObject(root);assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));assert.ok(bounds.getSize(new T.Vector3()).length()<4);
  assert.equal(root.userData.bolt,bolt);assert.equal(root.userData.flash,flash);assert.deepEqual(bolt.position,boltAt);assert.deepEqual(flash.position,flashAt);assert.equal(root.userData.skinEffect.type,skin.family);assert.doesNotThrow(()=>root.clone());
  let disposed=0;trim.children[0].geometry.addEventListener('dispose',()=>disposed++);setRifleFinish(root,'field');assert.equal(disposed,1);assert.equal(root.getObjectByName('rifle-skin-decoration'),undefined);assert.equal(root.userData.skinEffect,null);
 }
 disposeRifle(root);
 }
 assert.equal(signatures.size,40);
});
test('collection materials restore field maps, idempotent selection keeps one trim and every pattern differs',()=>{
 const root=rifle(new T.Group(),'sunbolt',false),images=new Set();let stock;root.traverse(o=>{if(o.material?.name==='rifle-stock')stock=o.material;});const fieldMap=stock.map,fieldColor=stock.color.getHex();
 for(const skin of RIFLE_SKINS){setRifleFinish(root,skin.id);const trim=root.getObjectByName('rifle-skin-decoration');setRifleFinish(root,skin.id);assert.equal(root.getObjectByName('rifle-skin-decoration'),trim);images.add(Array.from(stock.map.image.data).join(','));}
 assert.equal(images.size,40);setRifleFinish(root,'field');assert.equal(stock.map,fieldMap);assert.equal(stock.color.getHex(),fieldColor);disposeRifle(root);
});
