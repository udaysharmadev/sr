import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import { buildOperator, applyOperatorGear } from '../dist/lobby.js';
import { operator } from '../dist/arena.js';

const clothes = ['cobalt','ember','lime','arctic','desert','shadow'];
const accessories = ['sky','blaze','violet','headset','cap','mask'];
const shoes = ['runner','tactical','alpine','crimson'];
function* combinations() {
  for(const clothing of clothes)for(const accessory of accessories)for(const shoe of shoes)
    yield {clothing,accessories:accessory,shoes:shoe};
}
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
// Clip two real triangles, rejecting adjacent edges and degenerate/sliver faces.
function overlapCenter(a,b) {
  const components=a.normal.toArray().map(Math.abs),axis=components.indexOf(Math.max(...components)),u=(axis+1)%3,v=(axis+2)%3;
  let polygon=a.points.map(p=>[p.getComponent(u),p.getComponent(v)]);
  const clip=b.points.map(p=>[p.getComponent(u),p.getComponent(v)]),orientation=Math.sign(cross(...clip));
  for(let i=0;i<3;i++) {
    const start=clip[i],end=clip[(i+1)%3],input=polygon;polygon=[];
    for(let j=0;j<input.length;j++) {
      const p=input[j],q=input[(j+1)%input.length],dp=cross(start,end,p)*orientation,dq=cross(start,end,q)*orientation;
      if(dp>=0)polygon.push(p);
      if((dp>=0)!==(dq>=0)){const f=dp/(dp-dq);polygon.push([p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f]);}
    }
    if(polygon.length<3)return null;
  }
  let area=0;for(let i=0;i<polygon.length;i++)area+=polygon[i][0]*polygon[(i+1)%polygon.length][1]-polygon[(i+1)%polygon.length][0]*polygon[i][1];
  if(Math.abs(area)<1e-7)return null;
  const center=new T.Vector3();
  center.setComponent(u,polygon.reduce((sum,p)=>sum+p[0],0)/polygon.length);
  center.setComponent(v,polygon.reduce((sum,p)=>sum+p[1],0)/polygon.length);
  center.setComponent(axis,(a.plane-a.normal.getComponent(u)*center.getComponent(u)-a.normal.getComponent(v)*center.getComponent(v))/a.normal.getComponent(axis));
  return center;
}
function exposedOverlaps(root) {
  root.updateMatrixWorld(true);
  const meshes=[],planes=new Map(),conflicts=new Set(),ray=new T.Raycaster();
  root.traverseVisible(node=>{if(node.isMesh&&node.material?.visible!==false)meshes.push(node);});
  for(const mesh of meshes) {
    const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<(index?index.count:position.count);i+=3) {
      const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(position,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
      const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      if(normal.length()<.9)continue;
      const plane=normal.dot(points[0]),key=[...normal.toArray().map(n=>Math.round(n*10000)),Math.round(plane*100000)].join(':');
      if(!planes.has(key))planes.set(key,[]);
      planes.get(key).push({mesh,points,normal,plane});
    }
  }
  for(const triangles of planes.values())for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++) {
    const a=triangles[i],b=triangles[j];if(a.mesh===b.mesh)continue;
    const center=overlapCenter(a,b);if(!center)continue;
    ray.set(center.clone().addScaledVector(a.normal,10),a.normal.clone().negate());
    const first=ray.intersectObjects(meshes,false)[0];
    // Buried joins cannot flicker on the exterior. The nearest visible face must
    // be at this intersection, rather than a different enclosing garment.
    if(first&&Math.abs(first.distance-10)<.0001)conflicts.add(JSON.stringify([a.mesh.position.toArray(),b.mesh.position.toArray(),a.mesh.parent.name,b.mesh.parent.name,a.mesh.geometry.type,b.mesh.geometry.type]));
  }
  return [...conflicts];
}

test('surface audit detects an exposed coplanar overlap but permits shared edges and buried joins',()=>{
  const scene=new T.Scene(),geometry=new T.BoxGeometry(1,1,1),mat=new T.MeshBasicMaterial();
  const a=new T.Mesh(geometry,mat),b=new T.Mesh(geometry,mat);scene.add(a,b);
  assert.ok(exposedOverlaps(scene).length>0);
  b.position.x=1;assert.equal(exposedOverlaps(scene).length,0);
  b.position.x=0;const cover=new T.Mesh(new T.BoxGeometry(2,2,2),mat);scene.add(cover);assert.equal(exposedOverlaps(scene).length,0);
});
test('all144 lobby outfit combinations have no exposed competing triangle surfaces',()=>{
  const originalDocument=globalThis.document;
  // The original held-rifle label only needs a canvas while constructing CPU geometry.
  globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
  try {
    const actor=buildOperator(new T.Scene());let count=0;
    for(const gear of combinations()){
      applyOperatorGear(actor,gear);assert.deepEqual(exposedOverlaps(actor.root),[],JSON.stringify(gear));
      const bounds=actor.boots.map(boot=>{const box=new T.Box3();boot.traverseVisible(node=>{if(node.isMesh)box.union(new T.Box3().setFromObject(node));});return box;}).sort((a,b)=>a.min.x-b.min.x);
      assert.ok(bounds[0].max.x+.005<bounds[1].min.x,JSON.stringify(gear)+' shoes must not intersect each other');count++;
    }
    assert.equal(count,144);assert.doesNotThrow(()=>actor.root.clone());
    const trousers=[];actor.root.traverse(node=>{if(node.isMesh&&node.material===actor.pants&&Math.abs(Math.abs(node.parent.position.x)-.255)<1e-6)trousers.push(node);});
    for(const shoe of ['crimson','tactical']){
      applyOperatorGear(actor,{clothing:'cobalt',accessories:'sky',shoes:shoe});actor.root.updateMatrixWorld(true);
      for(const leg of trousers){
        const side=Math.sign(leg.parent.position.x),boot=actor.boots.find(b=>Math.sign(b.position.x)===side),collar=boot.getObjectByName(shoe+'-collar');
        const legBox=new T.Box3().setFromObject(leg),collarBox=new T.Box3().setFromObject(collar);
        assert.ok(collarBox.min.z<legBox.min.z-.005&&collarBox.max.z>legBox.max.z+.005,shoe+' cuff must wrap both trouser stances, not leave a floating label');
      }
    }
  }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
test('all144 practice and remote outfit combinations have no exposed competing triangle surfaces',()=>{
  let count=0;
  for(const gear of combinations()){
    const actor=operator(new T.Scene(),0xffffff,'sunbolt',gear);
    assert.deepEqual(exposedOverlaps(actor),[],JSON.stringify(gear));count++;
  }
  assert.equal(count,144);
});

test('new wardrobe sets preserve exterior surface separation and shoe clearance in both character rigs',async()=>{
 const {wardrobeItems}=await import('../dist/wardrobe.js');const groups=['clothing','accessories','shoes'].map(wardrobeItems),previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 try{const lobby=buildOperator(new T.Scene());const errors=[];
 const outfits=Array.from({length:8},(_,i)=>Object.fromEntries(groups.map((items,j)=>[['clothing','accessories','shoes'][j],items[i].id])));
 for(let i=0;i<8;i++){outfits.push({clothing:groups[0][i].id,accessories:'blaze',shoes:'alpine'},{clothing:'arctic',accessories:groups[1][i].id,shoes:'crimson'},{clothing:'desert',accessories:'mask',shoes:groups[2][i].id});}
 for(const gear of outfits){
  applyOperatorGear(lobby,gear);
  const remote=operator(new T.Scene(),0,'sunbolt',gear);
  for(const [kind,root] of [['lobby',lobby.root],['remote',remote]]){const overlaps=exposedOverlaps(root);if(overlaps.length)errors.push({kind,gear,overlaps:overlaps.slice(0,5)});}
  const feet=remote.children.filter(node=>node.userData.wardrobePart?.startsWith('foot')).map(node=>new T.Box3().setFromObject(node)).sort((a,b)=>a.min.x-b.min.x);if(feet.length)assert.ok(feet[0].max.x+.005<feet[1].min.x,gear.shoes+' remote feet overlap');
  const boxes=lobby.boots.map(boot=>new T.Box3().setFromObject(boot)).sort((a,b)=>a.min.x-b.min.x);assert.ok(boxes[0].max.x+.005<boxes[1].min.x,gear.shoes+' feet overlap');
 }
 assert.deepEqual(errors,[]);
 }finally{globalThis.document=previous;}
});
