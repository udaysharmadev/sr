import * as T from './vendor/three.module.js';
import { grenadeLaunch, stepGrenade, FUSE_MS } from './equipment.js';
export function equipmentModel(parent, kind, hands = false) {
  const root = new T.Group(); parent.add(root);
  const steel = new T.MeshStandardMaterial({color:0x9ba3a1,metalness:.85,roughness:.28});
  const dark = new T.MeshStandardMaterial({color:0x292d29,roughness:.78});
  const olive = new T.MeshStandardMaterial({color:0x626b3e,metalness:.25,roughness:.8});
  function mesh(geometry,mat,x=0,y=0,z=0){const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);root.add(o);return o;}
  if(kind==='knife') {
    const shape = new T.Shape(); shape.moveTo(-.065,0);shape.lineTo(-.065,.36);shape.lineTo(0,.53);shape.lineTo(.065,.36);shape.lineTo(.065,0);shape.closePath();
    const blade=mesh(new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:1,steps:1}),steel,0,.04,-.01);
    mesh(new T.BoxGeometry(.24,.035,.075),steel,0,.035,0);
    mesh(new T.CylinderGeometry(.045,.05,.23,8),dark,0,-.10,0);
    for(let i=0;i<5;i++)mesh(new T.TorusGeometry(.048,.006,4,12),olive,0,-.03-i*.035,0).rotation.x=Math.PI/2;
    blade.castShadow=true;
  } else {
    mesh(new T.SphereGeometry(.12,12,8),olive,0,-.02,0).scale.y=1.25;
    mesh(new T.CylinderGeometry(.06,.07,.08,8),dark,0,.14,0);
    mesh(new T.BoxGeometry(.045,.20,.04),steel,.09,.08,0).rotation.z=.22;
    mesh(new T.TorusGeometry(.042,.007,6,16),steel,-.045,.19,0).rotation.y=Math.PI/2;
    for(let i=0;i<3;i++)mesh(new T.TorusGeometry(.116,.005,4,16),dark,0,-.09+i*.065,0).rotation.x=Math.PI/2;
  }
  Object.defineProperty(root.userData, "itemNodes", { value: root.children.slice(), enumerable: false });
  if(hands){
    const skin=new T.MeshStandardMaterial({color:0xf0c397,roughness:.85});
    const glove=mesh(new T.BoxGeometry(.14,.18,.14),dark,0,-.14,.065);
    mesh(new T.BoxGeometry(.15,.13,.16),skin,0,-.28,.09);
    mesh(new T.BoxGeometry(.18,.26,.18),dark,0,-.46,.14).rotation.x=-.18;
    glove.rotation.x=-.2;
  }
  return root;
}
export function createEquipmentEffects(scene, map = null) {
  const bodies = new Map(), blasts = [];
  let guideRoot = null, guideAt = -Infinity, guideMaterial = null;
  const flashGeometry = new T.SphereGeometry(1, 12, 8), debrisGeometry = new T.BoxGeometry(.04, .04, .04);
  const ringGeometry=new T.RingGeometry(.83,1,40);
  const fireColor = new T.Color(0xffbf69), sootColor = new T.Color(0x514b42);
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5), i = (y * 64 + x) * 4;
    const cloud = .76 + Math.sin(x * .43 + Math.cos(y * .3)) * .1 + Math.sin(y * .57 + x * .19) * .08;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255; pixels[i + 3] = Math.max(0, 1 - r) ** 1.5 * cloud * 255;
  }
  const smokeTexture = new T.DataTexture(pixels, 64, 64, T.RGBAFormat); smokeTexture.needsUpdate = true;
  function dispose(root) { const geo = new Set(), mats = new Set(); root.traverse(o => { if (o.geometry) geo.add(o.geometry); if (o.material) mats.add(o.material); }); geo.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); root.removeFromParent(); }
  function removeBlast(b) { b.root.removeFromParent(); b.mats.forEach(m => m.dispose()); }
  return {
    guide(pose, charge, time, enabled) {
      if (!enabled || !map) { if(guideRoot)guideRoot.visible=false;return; }
      if(!guideRoot){
        guideRoot=new T.Group();scene.add(guideRoot);
        guideMaterial=new T.MeshBasicMaterial({color:0xf1d18a,transparent:true,opacity:.5,depthWrite:false});
        for(let i=0;i<12;i++){const dot=new T.Mesh(flashGeometry,guideMaterial);dot.scale.setScalar(i===11?.07:.018);guideRoot.add(dot);}
      }
      const wasVisible=guideRoot.visible;guideRoot.visible=true;
      if(wasVisible&&time-guideAt<80)return;
      guideAt=time;
      const path=grenadeLaunch(pose,charge,map);
      let previous=null;
      for(const dot of guideRoot.children){
        stepGrenade(path,map,FUSE_MS/12000);dot.position.set(path.x,path.y,path.z);
        dot.visible=Math.hypot(path.x-pose.x,path.y-pose.y-pose.eyeHeight,path.z-pose.z)>.75&&(!previous||dot.position.distanceTo(previous)>.12);
        if(dot.visible)previous=dot.position;
      }
    },
    sync(grenades) {
      const ids = new Set(grenades.map(g => g.id));
      for (const [id, body] of bodies) if (!ids.has(id)) { dispose(body); bodies.delete(id); }
      for (const g of grenades) {
        let body=bodies.get(g.id);
        if(!body){body=equipmentModel(scene,'grenade');bodies.set(g.id,body);body.rotation.set(g.age*4,g.age*3,0);}
        else {
          const dx=g.x-body.position.x,dy=g.y-body.position.y,dz=g.z-body.position.z;
          if(Math.hypot(dx,dy,dz)<2){body.rotation.x+=dz/.12;body.rotation.z-=dx/.12;body.rotation.y+=dy*2;}
        }
        body.position.set(g.x,g.y,g.z);
      }
    },
    blast(position, at) {
      if (blasts.length >= 12) removeBlast(blasts.shift());
      const root = new T.Group(), mats = []; scene.add(root); root.position.copy(position);
      const flashMat = new T.MeshBasicMaterial({ color: 0xffefbe, transparent: true, opacity: .85, depthWrite: false, blending: T.AdditiveBlending }); mats.push(flashMat);
      const flash = new T.Mesh(flashGeometry, flashMat); root.add(flash);
      const ringMat=new T.MeshBasicMaterial({color:0xd9c89c,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide});mats.push(ringMat);
      const ring=new T.Mesh(ringGeometry,ringMat);ring.rotation.x=-Math.PI/2;ring.position.y=-position.y+.025;root.add(ring);
      const smoke = [], debris = [], sparks = [];
      for (let i = 0; i < 20; i++) {
        const mat = new T.SpriteMaterial({ map: smokeTexture, color: i % 3 ? 0x655d50 : 0xaaa18b, transparent: true, opacity: .7, depthWrite: false }); mats.push(mat);
        const puff = new T.Sprite(mat); puff.userData.direction = new T.Vector3(Math.sin(i * 2.4), .15 + i % 4 * .23, Math.cos(i * 2.4)); puff.userData.shade=mat.color.clone();root.add(puff); smoke.push(puff);
      }
      for (let i = 0; i < 12; i++) {
        const mat = new T.MeshBasicMaterial({ color: i % 2 ? 0xdbc7a1 : 0xd58b38, transparent: true }); mats.push(mat);
        const chip = new T.Mesh(debrisGeometry, mat); chip.userData.velocity = new T.Vector3(Math.sin(i * 2.4) * 8, 3 + i % 4, Math.cos(i * 2.4) * 8); root.add(chip); debris.push(chip);
      }
      for(let i=0;i<12;i++){
        const mat=new T.MeshBasicMaterial({color:0xffdb8a,transparent:true,depthWrite:false,blending:T.AdditiveBlending});mats.push(mat);
        const spark=new T.Mesh(debrisGeometry,mat);spark.userData.velocity=new T.Vector3(Math.sin(i*2.4)*12,1+i%5,Math.cos(i*2.4)*12);spark.scale.set(.6,.6,7);spark.lookAt(spark.userData.velocity);root.add(spark);sparks.push(spark);
      }
      blasts.push({ root, mats, flash, ring, smoke, debris, sparks, at });
    },
    update(t) {
      for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i], seconds = (t - b.at) / 1000, age = seconds / 4;
        if (age >= 1) { removeBlast(b); blasts.splice(i, 1); continue; }
        b.flash.visible = seconds < .12; b.flash.scale.setScalar(.4 + Math.min(1, seconds / .08) * 1.4); b.flash.material.opacity = Math.max(0, .85*(1 - seconds / .12));
        b.ring.visible=seconds<.6;b.ring.scale.setScalar(.4+Math.min(1,seconds/.5)*7.6);b.ring.material.opacity=Math.max(0,.6*(1-seconds/.6));
        for (const puff of b.smoke) {
          puff.position.copy(puff.userData.direction).multiplyScalar(.25 + Math.min(1, seconds / .4) * 2.6);
          puff.position.y += seconds * .5; puff.scale.setScalar(.7 + Math.min(1,seconds/.22)*1.2 + Math.min(seconds,2.5)*.7);
          puff.material.color.lerpColors(fireColor,seconds<.45?sootColor:puff.userData.shade,Math.min(1,seconds/.24));
          puff.material.opacity = .88 * Math.min(1, seconds / .025) * Math.pow(1 - age, 1.3);
        }
        for (const chip of b.debris) { chip.position.copy(chip.userData.velocity).multiplyScalar(seconds); chip.position.y = Math.max(.04-b.root.position.y, chip.position.y - seconds * seconds * 5);chip.rotation.set(seconds*7,seconds*4,seconds*3); chip.visible = seconds < .65; chip.material.opacity = Math.max(0, 1 - seconds / .65); }
        for(const spark of b.sparks){spark.visible=seconds<.23;spark.position.copy(spark.userData.velocity).multiplyScalar(seconds);spark.position.y-=seconds*seconds*5;spark.material.opacity=Math.max(0,1-seconds/.23);}
      }
    },
    dispose() { for (const body of bodies.values()) dispose(body); bodies.clear(); blasts.forEach(removeBlast); blasts.length = 0;guideRoot?.removeFromParent();guideMaterial?.dispose(); flashGeometry.dispose(); debrisGeometry.dispose();ringGeometry.dispose(); smokeTexture.dispose(); }
  };
}

let thumbnails;
export function equipmentThumbnails() {
  return thumbnails ||= Promise.resolve().then(() => {
    const renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(320,160);renderer.setPixelRatio(1);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,2,.01,10), images={};
    scene.add(new T.HemisphereLight(0xffffff,0x77796c,3));const key=new T.DirectionalLight(0xffffff,4);key.position.set(-2,4,3);scene.add(key);
    try {for(const kind of ['knife','grenade']){const model=equipmentModel(scene,kind);model.rotation.z=kind==='knife'?-.7:-.2;model.rotation.y=.5;const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());model.position.sub(bounds.getCenter(new T.Vector3()));camera.position.set(0,0,Math.max(size.y,size.x/2)/(2*Math.tan(Math.PI/12))*1.2+.2);camera.lookAt(0,0,0);renderer.render(scene,camera);images[kind]=renderer.domElement.toDataURL('image/webp');const gs=new Set(),ms=new Set();model.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());model.removeFromParent();}return images;}finally{renderer.dispose();renderer.forceContextLoss();}
  }).catch(error=>{thumbnails=null;throw error;});
}
