import * as T from './vendor/three.module.js';

const auraName='rifle-skin-aura';
const styles={
  fire:{color:[0xff9a36,0x70524c],life:1.3,rise:.29,width:.055,size:.13,blend:T.NormalBlending},
  frost:{color:[0x9deeff,0xd7f9ff],life:2.2,rise:.16,width:.09,size:.16,blend:T.NormalBlending},
  arc:{color:[0x55e8ff,0xefffff],life:.55,rise:.09,width:.11,size:.035,blend:T.AdditiveBlending},
  void:{color:[0x9d6cfa,0x433259],life:2.4,rise:.19,width:.10,size:.17,blend:T.NormalBlending},
  gold:{color:[0xffd871,0xfff3bc],life:2.6,rise:.31,width:.10,size:.075,blend:T.AdditiveBlending},
  relic:{color:[0xf4d98e,0xfff7d2],life:2.7,rise:.20,width:.07,size:.045,blend:T.AdditiveBlending},
};
const effectAliases={flame:'fire',flames:'fire',smoke:'fire',frost:'frost',ice:'frost',spark:'arc',sparks:'arc',energy:'arc',mist:'void',motes:'relic'};
const seedOf=text=>[...String(text)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
function clearAura(root){const group=root.getObjectByName(auraName);if(!group)return;group.removeFromParent();group.traverse(node=>{node.geometry?.dispose();for(const m of [].concat(node.material||[]))m.dispose();});}
function createAura(root,effect,seed,definition){
  const group=new T.Group();group.name=auraName;group.userData={effect,seed};
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(36),3));
  geometry.setAttribute('aAlpha',new T.BufferAttribute(new Float32Array(12),1));geometry.setAttribute('aSize',new T.BufferAttribute(new Float32Array(12),1));
  geometry.setAttribute('aShape',new T.BufferAttribute(Float32Array.from({length:12},(_,i)=>effect==='gold'&&i%2===0?1:0),1));
  const colors=new Float32Array(36),style=styles[effect],color=new T.Color();
  for(let i=0;i<12;i++){color.setHex(i%2===0&&Number.isFinite(definition?.color)?definition.color:style.color[i%2]);colors.set([color.r,color.g,color.b],i*3);}
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const material=new T.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,blending:style.blend,
    vertexShader:'attribute float aAlpha;attribute float aSize;attribute float aShape;varying float vShape;varying float vAlpha;varying vec3 vColor;void main(){vAlpha=aAlpha;vShape=aShape;vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*190./max(.1,-mv.z),1.,23.);}',
    fragmentShader:'varying float vShape;varying float vAlpha;varying vec3 vColor;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv)*2.;float soft=pow(max(0.,1.-d),1.7);if(vShape>.5){float ray=max(exp(-abs(uv.x)*42.)*max(0.,1.-abs(uv.y)*2.),exp(-abs(uv.y)*42.)*max(0.,1.-abs(uv.x)*2.));soft=max(soft*.35,ray);}gl_FragColor=vec4(vColor,soft*vAlpha);}',vertexColors:true});
  const points=new T.Points(geometry,material);points.frustumCulled=false;points.name='rifle-skin-particles';group.add(points);
  (root.getObjectByName('rifle-skin-decoration')||root).add(group);return group;
}

// Cosmetic, deterministic, pooled and independent of recoil/aim/hit registration.
export function updateRifleSkinEffects(root,timeMs=0,options={}){
  if(!root)return;
  const definition=root.userData.skinEffect;
  const requested=typeof definition==='string'?definition:definition?.type||definition?.family||definition?.kind||definition?.effect;
  const effect=styles[requested]?requested:effectAliases[requested];
  if(!effect){clearAura(root);return;}
  const seed=seedOf(root.userData.finish||requested);let group=root.getObjectByName(auraName);
  if(group&&(group.userData.effect!==effect||group.userData.seed!==seed)){clearAura(root);group=null;}
  if(options.hidden||root.visible===false){if(group)group.visible=false;return;}
  group ||= createAura(root,effect,seed,definition);group.visible=true;
  const points=group.children[0],geometry=points.geometry,style=styles[effect];
  const count=options.quality==='low'?6:12;geometry.setDrawRange(0,count);
  const position=geometry.attributes.position,alpha=geometry.attributes.aAlpha,size=geometry.attributes.aSize;
  const seconds=options.reducedMotion?0:Math.max(0,Number.isFinite(timeMs)?timeMs:0)/1000;
  for(let i=0;i<count;i++){
    const phase=(i/count+(seed%101)/101+seconds/style.life)%1,wave=Math.sin(i*2.39+seed*.001+phase*5),side=i%2?-1:1;
    const z=-.35-(i%4)*.13,baseX=side*.074;
    let x=baseX+wave*style.width*phase,y=.06+phase*style.rise;
    if(effect==='arc'){x=baseX+Math.sin(phase*27+i)*style.width*phase;y=.05+Math.cos(phase*13+i)*.08;}
    if(effect==='void'){x=baseX+Math.sin(phase*6.28+i)*style.width;y=.08+phase*style.rise;}
    if(effect==='gold'){x=Math.sin(phase*6.28+i)*style.width*(.5+phase*.5);y=.05+phase*style.rise;}
    if(effect==='relic'){x=baseX+Math.sin(phase*6.28+i)*style.width;y=.06+phase*style.rise;}
    position.setXYZ(i,x,y,z+Math.cos(i+phase*4)*.035);
    const fade=Math.sin(phase*Math.PI);alpha.setX(i,(options.reducedMotion ? .16 : effect==='gold' ? i%2===0?.8*(.65+.35*Math.sin(phase*18+i)):.12 : effect==='arc' ? .75 : effect==='fire' ? .42 : .34)*fade);
    size.setX(i,effect==='gold'&&i%2===1?.19*(.65+phase*.7):style.size*(effect==='arc'?1: .65+phase*.8));
  }
  position.needsUpdate=alpha.needsUpdate=size.needsUpdate=true;
  return group;
}
