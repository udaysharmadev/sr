import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {WEAPONS} from '../dist/weapons.js';
import {rifle,setRifleFinish,disposeRifle} from '../dist/rifle-models.js';

test('remote rifles stay within eleven meshes while preserving animated anchors and skin materials',()=>{
  for(const spec of WEAPONS){
    const root=rifle(new T.Group(),spec.id,false),bolt=root.userData.bolt,flash=root.userData.flash;
    let count=0;root.traverse(o=>{if(o.isMesh)count++;});assert.equal(count,11,spec.name);
    assert.equal(bolt.parent,root);assert.equal(flash.parent,root);
    const bounds=new T.Box3().setFromObject(root);assert.ok(!bounds.isEmpty());
    const before=bolt.position.clone();setRifleFinish(root,'gold');setRifleFinish(root,'field');assert.deepEqual(bolt.position,before);
    let disposed=0;const geometry=root.children.find(o=>o.isMesh&&o!==flash).geometry;
    geometry.addEventListener('dispose',()=>disposed++);disposeRifle(root);assert.equal(disposed,1);
  }
});
