import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {batchStaticMeshes} from '../dist/static-meshes.js';

test('static batching preserves transformed bounds, materials and independent animated groups',()=>{
  const root=new T.Group(),mat=new T.MeshStandardMaterial(),moving=new T.Group();
  root.add(moving);
  for(let i=0;i<3;i++){
    const mesh=new T.Mesh(new T.BoxGeometry(1,2,3),mat);
    mesh.position.set(i*.4,i*.2,-i);mesh.rotation.set(i*.1,.3,i*.2);mesh.scale.set(1,.8,1.1);root.add(mesh);
  }
  const before=new T.Box3().setFromObject(root),sources=root.children.filter(o=>o.isMesh);let freed=0;
  for(const mesh of sources)mesh.geometry.addEventListener('dispose',()=>freed++);
  batchStaticMeshes(root);
  assert.equal(freed,3);assert.equal(moving.parent,root);
  const merged=root.children.filter(o=>o.isMesh);assert.equal(merged.length,1);assert.equal(merged[0].material,mat);
  const after=new T.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min)<1e-6);assert.ok(before.max.distanceTo(after.max)<1e-6);
  assert.equal(merged[0].geometry.attributes.position.count,108);
  merged[0].geometry.dispose();mat.dispose();
});
