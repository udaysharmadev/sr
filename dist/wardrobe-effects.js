import * as T from './vendor/three.module.js';

const effectName='wardrobe-aura',cache=new WeakMap();
const variants={
  flame:{color:0xf39848,rise:.15,spread:.025,size:.052,life:1.4,shape:0},
  frost:{color:0xb7efff,rise:.07,spread:.05,size:.065,life:2.5,shape:0},
  arc:{color:0x72e7ed,rise:.03,spread:.035,size:.019,life:.8,shape:1},
  void:{color:0xb18be4,rise:.09,spread:.045,size:.064,life:2.8,shape:0},
  embers:{color:0xf4da8d,rise:.11,spread:.035,size:.023,life:2.1,shape:1},
};
const categories=['clothing','accessories','shoes'];
const seedOf=text=>[...String(text)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,11);
function release(root){const old=root.getObjectByName(effectName);if(!old)return;old.removeFromParent();old.traverse(node=>{node.geometry?.dispose();for(const mat of [].concat(node.material||[]))mat.dispose();});}
function prepare(root,source,height){
  const items=(Array.isArray(source)?source:[]).filter(item=>categories.includes(item?.category)&&variants[item.effect]).slice(0,3)
    .map(item=>({...item,style:variants[item.effect],seed:seedOf(item.id),tint:new T.Color(Number.isFinite(item.color)?item.color:variants[item.effect].color)}));
  release(root);
  const entry={source,height,items,group:null,points:null};cache.set(root,entry);
  if(!items.length)return entry;
  const group=new T.Group();group.name=effectName;root.add(group);
  const geometry=new T.BufferGeometry();
  for(const [name,size] of [['position',3],['color',3],['aAlpha',1],['aSize',1],['aShape',1]])geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(18*size),size));
  const material=new T.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,vertexColors:true,toneMapped:false,
    vertexShader:'attribute float aAlpha;attribute float aSize;attribute float aShape;varying float vAlpha;varying float vShape;varying vec3 vColor;void main(){vAlpha=aAlpha;vShape=aShape;vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*180./max(.1,-mv.z),1.,22.);}',
    fragmentShader:'varying float vAlpha;varying float vShape;varying vec3 vColor;void main(){vec2 uv=gl_PointCoord-.5;float soft=pow(max(0.,1.-length(uv)*2.),1.7);if(vShape>.5){float star=max(exp(-abs(uv.x)*35.)*max(0.,1.-abs(uv.y)*2.),exp(-abs(uv.y)*35.)*max(0.,1.-abs(uv.x)*2.));soft=max(soft*.3,star);}gl_FragColor=vec4(vColor,soft*vAlpha);}'
  });
  const points=new T.Points(geometry,material);points.name='wardrobe-particles';points.frustumCulled=false;group.add(points);
  entry.group=group;entry.points=points;return entry;
}

// One shared pool for the whole character, independent of physics, stats or input.
export function updateWardrobeEffects(root,timeMs=0,options={}){
  if(!root)return;
  const source=root.userData.wardrobeEffects,height=root.userData.wardrobeHeight||1.86;
  let entry=cache.get(root);
  if(!entry||entry.source!==source||entry.height!==height)entry=prepare(root,source,height);
  if(!entry.group)return;
  entry.group.visible=!options.hidden&&root.visible!==false;if(!entry.group.visible)return entry.group;
  const perItem=options.quality==='low'?3:6,geometry=entry.points.geometry;
  geometry.setDrawRange(0,entry.items.length*perItem);
  const position=geometry.attributes.position,alpha=geometry.attributes.aAlpha,size=geometry.attributes.aSize,color=geometry.attributes.color,shape=geometry.attributes.aShape;
  const seconds=options.reducedMotion?0:Math.max(0,Number.isFinite(timeMs)?timeMs:0)/1000;
  for(let itemIndex=0;itemIndex<entry.items.length;itemIndex++){
    const item=entry.items[itemIndex],style=item.style,head=item.category==='accessories',feet=item.category==='shoes';
    const tint=item.tint;
    for(let j=0;j<perItem;j++){
      const i=itemIndex*perItem+j,phase=(j/perItem+(item.seed%97)/97+seconds/style.life)%1,side=j%2?-1:1,theta=phase*Math.PI*2+j*1.7;
      let x=side*(head?.14:feet?.09:.17),y=feet?.035:head?.87:.60,z=feet?-.04:head?-.08:-.13;
      x+=Math.sin(theta)*style.spread;y+=phase*style.rise;
      if(item.effect==='arc'){x+=Math.sin(phase*28+j)*style.spread;y+=(Math.cos(phase*17+j))*.018;}
      else if(item.effect==='void'){z+=Math.cos(theta)*style.spread;x+=Math.sin(theta)*style.spread;}
      else if(item.effect==='frost'){z+=Math.sin(theta)*style.spread;}
      if(feet){y=.025+phase*style.rise*.40;z-=phase*.15;}
      position.setXYZ(i,x*height,y*height,z*height*(root.userData.wardrobeForward||1));
      const fade=Math.sin(phase*Math.PI),moving=feet&&Number.isFinite(options.speed)?Math.min(1,.5+options.speed*.08):1;
      alpha.setX(i,fade*(options.reducedMotion?.12:item.effect==='arc'?.55:item.effect==='embers'?.5:.25)*moving);
      size.setX(i,style.size*height*(.65+phase*.7));shape.setX(i,style.shape);color.setXYZ(i,tint.r,tint.g,tint.b);
    }
  }
  position.needsUpdate=alpha.needsUpdate=size.needsUpdate=color.needsUpdate=shape.needsUpdate=true;
  return entry.group;
}
