import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../dist/vendor/three.module.js';
import {WARDROBE,wardrobeItems} from '../dist/wardrobe.js';import {CATALOG} from '../dist/catalog.js';import {cosmeticLoadout} from '../dist/weapons.js';
import {buildOperator,applyOperatorGear} from '../dist/lobby.js';import {operator,animateOperator,animateOperatorCombat} from '../dist/arena.js';
import {disposeRifle} from '../dist/rifle-models.js';
const defaults={clothing:'cobalt',accessories:'sky',shoes:'runner'};
const trimGroups=root=>{const groups=[];root.traverse(node=>{if(node.userData.wardrobePart)groups.push(node);});return groups;};
test('all24 catalog items produce unique finite clone-safe silhouettes in lobby and arena; legacy IDs remain valid',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 try{assert.equal(WARDROBE.length,24);const lobby=buildOperator(new T.Scene());for(const cat of ['clothing','accessories','shoes']){
  const signatures=new Set();assert.equal(wardrobeItems(cat).length,8);
  for(const item of wardrobeItems(cat)){assert.ok(CATALOG[cat].some(row=>row[0]===item.id&&row[2]===item.price));const gear={...defaults,[cat]:item.id};assert.equal(cosmeticLoadout(gear)[cat],item.id);
   applyOperatorGear(lobby,gear);const remote=operator(new T.Scene(),0,'sunbolt',gear),parts=trimGroups(remote);assert.ok(parts.length);const signature=[];
   for(const part of parts)part.traverse(node=>{if(node.geometry){const a=node.geometry.attributes.position.array;assert.ok([...a].every(Number.isFinite));signature.push(node.geometry.type+':'+[...a].join(',')+':'+node.position.toArray().join(','));}});signatures.add(signature.join('|'));
   assert.doesNotThrow(()=>lobby.root.clone());assert.doesNotThrow(()=>remote.clone());assert.equal(remote.userData.wardrobeEffects[0].id,item.id);
   animateOperator(remote,6,.1);animateOperatorCombat(remote,{pitch:.5,lean:.1},.1);assert.ok(new T.Box3().setFromObject(remote).getSize(new T.Vector3()).toArray().every(Number.isFinite));disposeRifle(remote);
  }assert.equal(signatures.size,8,cat+' needs8distinct constructed shapes');
 }applyOperatorGear(lobby,defaults);assert.equal(trimGroups(lobby.root).length,0);assert.deepEqual(lobby.root.userData.wardrobeEffects,[]);disposeRifle(lobby.root);
 }finally{globalThis.document=previous;}
});
test('unchanged gear reuses actual meshes; changing categories releases old owned trim once',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};try{const a=buildOperator(new T.Scene());const gear={clothing:'inferno',accessories:'drake-helm',shoes:'cinder-steps'};applyOperatorGear(a,gear);const groups=trimGroups(a.root),effects=a.root.userData.wardrobeEffects;applyOperatorGear(a,{...gear});assert.deepEqual(trimGroups(a.root),groups);assert.equal(a.root.userData.wardrobeEffects,effects);
 let mesh;groups[0].traverse(node=>{if(node.isMesh&&!mesh)mesh=node;});let freed=0;mesh.geometry.addEventListener('dispose',()=>freed++);applyOperatorGear(a,defaults);assert.equal(freed,1);applyOperatorGear(a,defaults);assert.equal(freed,1);disposeRifle(a.root);
 }finally{globalThis.document=previous;}
});
