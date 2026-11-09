import * as T from './vendor/three.module.js';
import {wardrobeById} from './wardrobe.js';
import {applyFabric} from './surface-textures.js';

const wardrobeStates=new WeakMap();
function release(groups){const geometries=new Set(),materials=new Set(),textures=new Set();for(const group of groups){group.removeFromParent();group.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const mat of [].concat(node.material||[])){materials.add(mat);if(mat.map)textures.add(mat.map);if(mat.bumpMap)textures.add(mat.bumpMap);}});}for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
function pieces(item){
 const main=new T.MeshStandardMaterial({color:item.color,roughness:.57,metalness:.18}),dark=new T.MeshStandardMaterial({color:0x202a31,roughness:.8}),accent=new T.MeshStandardMaterial({color:item.effect==='flame'?0xf7a34d:item.effect==='frost'?0xc8f5ff:item.effect==='arc'?0x64e8db:item.effect==='void'?0xad86df:0xf2d990,metalness:.5,roughness:.35,emissive:item.effect==='arc'?0x1b5453:0,emissiveIntensity:.25});
 applyFabric(main,item.category==='shoes'?'leather':'cloth');
 const result=[];const make=part=>{const g=new T.Group();g.name='wardrobe-'+item.id+'-'+part;g.userData.wardrobePart=part;result.push(g);return g;};
 const put=(parent,geometry,mat,x=0,y=0,z=0)=>{const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(parent,w,h,d,mat,x=0,y=0,z=0)=>put(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);
 const ring=(parent,r,tube,mat,x,y,z)=>put(parent,new T.TorusGeometry(r,tube,6,16),mat,x,y,z);
 if(item.category==='clothing'){
  const body=make('body');
  // Exterior plates clear the base cuboid; panels are deliberately separated at seams.
  for(const side of [-1,1]){box(body,.07,.47,.35,main,side*.22,0,0);box(body,.16,.46,.045,main,side*.105,0,.18);}
  box(body,.43,.065,.36,dark,0,-.25,0);
  if(item.shape==='fire'){
   box(body,.26,.28,.11,dark,0,.02,-.22);for(const side of [-1,1]){const stack=put(body,new T.CylinderGeometry(.038,.045,.28,7),main,side*.13,.13,-.25);stack.rotation.z=side*.22;for(let i=0;i<3;i++)box(body,.07,.035,.035,accent,side*.11,.14-i*.09,.213);}
   for(let i=0;i<3;i++)box(body,.025,.30,.025,accent,(i-1)*.06,0,-.283);
  }else if(item.shape==='frost'){
   for(const side of [-1,1]){box(body,.13,.19,.08,accent,side*.115,.12,.20);for(let i=0;i<3;i++){const crystal=put(body,new T.OctahedronGeometry(.055),accent,side*.25,.17-i*.10,0);crystal.scale.set(.4,1,1.1);}}
   box(body,.30,.33,.14,main,0,.03,-.23);box(body,.20,.22,.025,accent,0,.03,-.314);
  }else if(item.shape==='arc'){
   for(const side of [-1,1]){box(body,.035,.39,.03,accent,side*.13,.01,.214);for(let i=0;i<3;i++){const coil=ring(body,.055,.009,accent,side*.11,.12-i*.10,-.25);coil.rotation.y=Math.PI/2;}}
   box(body,.28,.35,.10,dark,0,.03,-.23);box(body,.10,.20,.025,accent,0,.03,-.293);
  }else if(item.shape==='void'){
   for(let row=0;row<3;row++)for(const side of [-1,1]){const plate=box(body,.19,.105,.06,row%2?main:dark,side*.115,.14-row*.11,.204+row*.005);plate.rotation.z=side*.07;}
   for(const side of [-1,1]){const skirt=box(body,.18,.29,.055,main,side*.17,-.35,0);skirt.rotation.z=side*.11;const blade=put(body,new T.TetrahedronGeometry(.065),accent,side*.25,.20,-.05);blade.scale.set(.45,1.4,1);}
  }else if(item.shape==='relic'){
   for(const side of [-1,1]){box(body,.18,.34,.035,accent,side*.11,.04,.21);for(let i=0;i<3;i++){const emblem=ring(body,.027,.006,main,side*.11,.14-i*.095,.237);emblem.rotation.z=i*.3;}}
   box(body,.40,.44,.04,main,0,-.06,-.20);const sun=put(body,new T.DodecahedronGeometry(.075),accent,0,.08,-.24);sun.scale.z=.3;
  }else if(item.shape==='space'){
   box(body,.36,.39,.08,accent,0,.035,.20);box(body,.17,.13,.04,dark,0,.07,.26);for(const side of [-1,1])put(body,new T.CylinderGeometry(.065,.065,.40,10),main,side*.11,.02,-.24);box(body,.12,.16,.05,accent,0,.18,-.31);
  }else if(item.shape==='diver'){
   for(const side of [-1,1]){box(body,.04,.43,.04,accent,side*.14,0,.214);put(body,new T.CylinderGeometry(.05,.05,.36,8),main,side*.12,.04,-.23);}
   ring(body,.075,.013,accent,0,.10,.23);box(body,.34,.055,.055,accent,0,-.14,.214);for(let i=0;i<3;i++)box(body,.075,.095,.075,dark,(i-1)*.105,-.26,.19);
  }else{
   for(let row=0;row<4;row++){box(body,.36,.055,.055,row%2?main:dark,0,.16-row*.085,.21);for(const side of [-1,1])box(body,.025,.055,.012,accent,side*.12,.16-row*.085,.244);}
   const sash=box(body,.045,.51,.04,accent,0,.0,.25);sash.rotation.z=-.5;for(const side of [-1,1])box(body,.17,.26,.055,main,side*.16,-.34,-.03);
  }
  for(const side of [-1,1]){const arm=make(side<0?'armL':'armR');
   if(item.shape==='fire'||item.shape==='samurai'){box(arm,.23,.15,.29,main);for(let i=0;i<3;i++)box(arm,.24,.025,.31,dark,0,.065-i*.04,0);if(item.shape==='fire'){const fin=put(arm,new T.ConeGeometry(.04,.12,3),accent,side*.10,.10,-.05);fin.rotation.z=-side*.6;}}
   else if(item.shape==='frost'){box(arm,.22,.17,.29,accent);put(arm,new T.OctahedronGeometry(.065),main,side*.1,.08,0);}
   else if(item.shape==='arc'){box(arm,.21,.15,.28,dark);box(arm,.025,.16,.29,accent,side*.075,0,0);}
   else if(item.shape==='void'){const blade=put(arm,new T.TetrahedronGeometry(.12),main,side*.03,0,0);blade.scale.set(1.1,.8,1.5);box(arm,.18,.06,.28,accent,0,.045,0);}
   else if(item.shape==='relic'){box(arm,.23,.13,.29,accent);const gem=put(arm,new T.DodecahedronGeometry(.045),main,side*.07,.085,0);gem.scale.y=.6;}
   else if(item.shape==='space'){box(arm,.22,.17,.29,main);box(arm,.23,.035,.30,accent,0,.03,0);box(arm,.23,.03,.30,accent,0,-.03,0);}
   else{box(arm,.20,.17,.26,main);ring(arm,.055,.008,accent,0,0,.143);}
  }
 }else if(item.category==='accessories'){
  const head=make('head');
  if(item.shape==='fire'||item.shape==='samurai'){
   box(head,.43,.10,.39,main,0,.21,-.005);for(const side of [-1,1]){box(head,.06,.20,.28,main,side*.20,.075,-.02);const horn=put(head,new T.ConeGeometry(.035,.23,5),accent,side*.16,.35,0);horn.rotation.z=-side*.65;}
   if(item.shape==='samurai'){box(head,.51,.035,.30,dark,0,.15,-.02);const crest=ring(head,.10,.012,accent,0,.34,.04);crest.scale.y=.65;}else box(head,.04,.15,.29,accent,0,.28,-.005);
  }else if(item.shape==='frost'||item.shape==='relic'){
   box(head,.40,.055,.36,main,0,.24,0);for(let i=0;i<5;i++){const x=(i-2)*.078;const spire=put(head,item.shape==='frost'?new T.OctahedronGeometry(.075):new T.ConeGeometry(.033,.14,4),accent,x,.34+(2-Math.abs(i-2))*.018,0);spire.scale.set(.5,1.2,1);}
   if(item.shape==='relic'){const sun=put(head,new T.DodecahedronGeometry(.052),accent,0,.22,.20);sun.scale.z=.3;}
  }else if(item.shape==='arc'){
   const halo=ring(head,.24,.012,accent,0,.31,0);halo.rotation.x=Math.PI/2;
   for(const side of [-1,1]){put(head,new T.CylinderGeometry(.045,.045,.06,8),dark,side*.23,.10,0).rotation.z=Math.PI/2;box(head,.025,.20,.05,main,side*.23,.22,-.04);}
  }else if(item.shape==='void'){
   box(head,.37,.23,.055,main,0,.025,.20);for(const side of [-1,1]){const horn=put(head,new T.ConeGeometry(.035,.23,4),accent,side*.15,.25,.06);horn.rotation.z=-side*.35;box(head,.09,.025,.02,dark,side*.085,.07,.235).rotation.z=side*.22;}
   const fang=put(head,new T.ConeGeometry(.028,.10,3),accent,0,-.08,.22);fang.rotation.z=Math.PI;
  }else if(item.shape==='space'){
   box(head,.46,.08,.43,main,0,.27,0);for(const side of [-1,1]){box(head,.07,.35,.42,main,side*.215,.08,0);put(head,new T.CylinderGeometry(.055,.055,.065,10),accent,side*.265,.11,0).rotation.z=Math.PI/2;}
   box(head,.43,.06,.12,main,0,-.10,.18);box(head,.34,.045,.025,accent,0,.25,.23);
  }else{
   box(head,.45,.08,.42,main,0,.26,-.02);for(const side of [-1,1])box(head,.065,.32,.39,main,side*.21,.07,-.02);const port=ring(head,.135,.015,accent,0,.06,.235);port.scale.y=.85;for(let i=0;i<8;i++){const a=i*Math.PI/4;put(head,new T.SphereGeometry(.012,5,4),dark,Math.cos(a)*.16,.06+Math.sin(a)*.14,.233);}box(head,.16,.07,.07,accent,0,-.11,.21);
  }
 }else{
  for(const side of [-1,1]){const foot=make(side<0?'footL':'footR');
   box(foot,.224,.11,.32,main,0,-.005,.02);box(foot,.23,.035,.33,dark,0,-.058,.02);
   for(const x of [-.098,.098])box(foot,.025,.14,.20,main,x,.10,-.04);
   box(foot,.22,.14,.025,main,0,.10,-.145);
   if(item.shape==='fire'){for(let i=0;i<3;i++)box(foot,.04,.035,.035,accent,(i-1)*.065,.05,.187);put(foot,new T.CylinderGeometry(.031,.031,.04,8),accent,0,.035,-.16).rotation.x=Math.PI/2;}
   else if(item.shape==='frost'){for(const x of [-.08,.08]){const ice=put(foot,new T.OctahedronGeometry(.037),accent,x,-.035,.14);ice.scale.y=.5;}box(foot,.23,.04,.04,accent,0,.10,.06);}
   else if(item.shape==='arc'){for(const x of [-.11,.11])box(foot,.015,.025,.27,accent,x,-.033,.025);box(foot,.17,.035,.06,accent,0,.05,-.13);}
   else if(item.shape==='void'){for(const x of [-.105,.105])for(let i=0;i<2;i++){const shard=put(foot,new T.TetrahedronGeometry(.033),accent,x,.07+i*.06,-.04);shard.scale.set(.5,1.3,1);}box(foot,.18,.025,.28,dark,0,.045,.02);}
   else if(item.shape==='relic'){box(foot,.19,.055,.08,accent,0,.045,.15);ring(foot,.033,.008,accent,0,.135,.07);box(foot,.24,.025,.23,accent,0,-.03,.05);}
   else if(item.shape==='space'){for(let i=0;i<3;i++)box(foot,.23,.025,.22,accent,0,.07+i*.04,-.035);for(const x of [-.07,.07])put(foot,new T.CylinderGeometry(.025,.025,.045,7),dark,x,.015,-.165).rotation.x=Math.PI/2;}
   else if(item.shape==='diver'){box(foot,.24,.035,.34,accent,0,-.03,.02);box(foot,.16,.06,.04,accent,0,.13,.075);for(const x of [-.075,.075])box(foot,.024,.09,.024,dark,x,.13,.097);}
   else{for(const x of [-.055,.055])box(foot,.09,.045,.09,accent,x,.04,.145);for(let i=0;i<3;i++)box(foot,.19,.025,.03,accent,0,.07+i*.04,.055);}
  }
 }
 return result;
}

// New nodes own their resources, and only rebuild when the three selected IDs change.
export function applyWardrobeModels(root,gear,rig=null){
 const ids=['clothing','accessories','shoes'].map(k=>gear?.[k]||'').join('/'),previous=wardrobeStates.get(root);if(previous?.key===ids)return;
 if(previous)release(previous.groups);const groups=[];
 for(const category of ['clothing','accessories','shoes']){const item=wardrobeById(gear?.[category]);if(!item||item.category!==category)continue;
  for(const node of pieces(item)){
   const part=node.userData.wardrobePart;let parent=root;
   if(rig){const scale=part.startsWith('foot')?2.15:part==='head'?1.7:2.05;node.scale.setScalar(scale);
    if(part==='body'){parent=rig.chest;node.position.set(0,.30,0);}
    else if(part==='head'){parent=rig.head;node.position.set(0,.18,0);}
    else if(part.startsWith('arm')){parent=rig.arms.find(arm=>arm.side===(part==='armL'?-1:1)).root;node.position.set(0,-.10,0);}
    else{parent=rig.boots[part==='footL'?0:1];node.position.set(0,.16,.03);}
   }else{node.scale.z=-1;if(part==='body')node.position.y=1.06;else if(part==='head')node.position.y=1.55;else if(part.startsWith('arm'))node.position.set(part==='armL'?-.263:.263,1.19,0);else node.position.set(part==='footL'?-.14:.14,.075,-.025);}
   parent.add(node);groups.push(node);
  }
 }
 wardrobeStates.set(root,{key:ids,groups});root.userData.wardrobeHeight=rig?3:1.86;root.userData.wardrobeForward=rig?1:-1;
 root.userData.wardrobeEffects=['clothing','accessories','shoes'].map(category=>wardrobeById(gear?.[category])).filter(Boolean).map(item=>({id:item.id,category:item.category,effect:item.effect,color:({flame:0xf39848,frost:0xb7efff,arc:0x72e7ed,void:0xb18be4,embers:0xf4da8d})[item.effect]}));
}
