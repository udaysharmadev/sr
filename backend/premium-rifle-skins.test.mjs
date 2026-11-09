import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {rifle,setRifleFinish,disposeRifle} from '../dist/rifle-models.js';
import {WEAPONS} from '../dist/weapons.js';
import {CATALOG} from '../dist/catalog.js';
const premium=['ember-drake','ivory-relic','carbon-circuit'];
const meshes=root=>{let count=0;root.traverse(node=>{if(node.isMesh)count++;});return count;};
test('all eight rifle models receive three distinct finite premium silhouettes without moving combat anchors',()=>{
 for(const spec of WEAPONS){
  const root=rifle(new T.Group(),spec.id,false),baseSize=new T.Box3().setFromObject(root).getSize(new T.Vector3()),baseCount=meshes(root),bolt=root.userData.bolt,flash=root.userData.flash,boltAt=bolt.position.clone(),flashAt=flash.position.clone(),signatures=[];
  for(const finish of premium){
   setRifleFinish(root,finish);const decoration=root.getObjectByName('rifle-skin-decoration');assert.ok(decoration);assert.ok(meshes(root)>baseCount);
   const types=[];decoration.traverse(node=>{if(node.geometry){types.push(node.geometry.type);const a=node.geometry.getAttribute('position');assert.ok([...a.array].every(Number.isFinite));}});
   signatures.push(types.join(','));assert.doesNotThrow(()=>root.clone());
   assert.equal(root.userData.bolt,bolt);assert.equal(root.userData.flash,flash);assert.deepEqual(bolt.position,boltAt);assert.deepEqual(flash.position,flashAt);
   const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());for(const key of ['x','y','z'])assert.ok(size[key]<=baseSize[key]+.12,'skin must remain within bounded trim of '+spec.id);
   let released=0;decoration.children[0].geometry.addEventListener('dispose',()=>released++);
   setRifleFinish(root,'field');assert.equal(released,1);assert.equal(root.getObjectByName('rifle-skin-decoration'),undefined);assert.equal(meshes(root),baseCount);
  }
  assert.equal(new Set(signatures).size,3);disposeRifle(root);
 }
});
test('repeated premium selection does not duplicate trim and switching restores base textures',()=>{
 const root=rifle(new T.Group(),'sunbolt',false);let stock;root.traverse(o=>{if(o.material?.name==='rifle-stock')stock=o.material;});const originalMap=stock.map,originalColor=stock.color.getHex();
 const patterns=[];
 for(let round=0;round<3;round++)for(const finish of premium){setRifleFinish(root,finish);const count=meshes(root);setRifleFinish(root,finish);assert.equal(meshes(root),count);assert.equal(root.children.filter(c=>c.name==='rifle-skin-decoration').length,1);if(round===0)patterns.push(Array.from(stock.map.image.data).join(','));}
 assert.equal(new Set(patterns).size,3);setRifleFinish(root,'field');assert.equal(stock.map,originalMap);assert.equal(stock.color.getHex(),originalColor);disposeRifle(root);
});
test('premium skin catalogue has unique purchasable permanent identities',()=>{
 for(const id of premium){const item=CATALOG.wraps.find(item=>item[0]==='wrap-'+id);assert.ok(item);assert.ok(item[2]>=14000);}
 assert.equal(new Set(CATALOG.wraps.map(item=>item[0])).size,CATALOG.wraps.length);
});
