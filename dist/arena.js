import {applyWardrobeModels} from './wardrobe-models.js';
import {wardrobeById} from './wardrobe.js';
import { applyFabric } from "./surface-textures.js";
import { exposedBoxFaces } from "./arena-geometry.js";
import { disposeRifle, rifle, setRifleFinish } from "./rifle-models.js";
import { weaponById, cosmeticLoadout } from "./weapons.js";
import { knifeSwing } from "./equipment.js";
export { rifle };
import * as T from "./vendor/three.module.js";

const material = (color, extra = {}) =>
  new T.MeshStandardMaterial({ color, roughness: .63, ...extra });
const mesh = (parent, g, m, x = 0, y = 0, z = 0) => {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};
const box = (parent, w, h, d, m, x, y, z) =>
  mesh(parent, new T.BoxGeometry(w, h, d), m, x, y, z);
const cylinder = (parent, r1, r2, len, m, x, y, z, segments = 12) =>
  mesh(parent, new T.CylinderGeometry(r1, r2, len, segments), m, x, y, z);

function panels(base, joint, ground = false) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  const pixels = g.getImageData(0, 0, 128, 128);
  let seed = 7381;
  const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const variation = (random() - .5) * 4;
    for (let channel = 0; channel < 3; channel++) {
      pixels.data[i + channel] = Math.max(
        0,
        Math.min(255, pixels.data[i + channel] + variation),
      );
    }
  }
  g.putImageData(pixels, 0, 0);
  // Large quiet panels, rather than alternating checker squares.
  g.fillStyle = joint;
  g.fillRect(0, 0, 1, 128);
  g.fillRect(0, 0, 128, 1);
  g.fillStyle = "rgba(255,255,255,.11)";
  g.fillRect(1, 1, 1, 126);
  g.fillRect(1, 1, 126, 1);
  g.strokeStyle = "rgba(18,39,51,.035)";
  g.lineWidth = .6;
  for (let i = 0; i < 11; i++) {
    const x = random() * 128, y = random() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 3 + random() * 8, y + random() * 2);
    g.stroke();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(ground ? .6 : 1, ground ? .6 : .65);
  t.anisotropy = 4;
  return material(0xffffff, {
    map: t,
    bumpMap: t,
    bumpScale: .006,
    roughness: .93,
  });
}

function signTexture(color, label) {
  const c = document.createElement("canvas");
  c.width = 192;
  c.height = 320;
  const g = c.getContext("2d");
  function flag(y, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(192, 0);
    g.lineTo(192, 242 + y);
    g.lineTo(96, 316 + y);
    g.lineTo(0, 242 + y);
    g.closePath();
    g.fill();
  }
  flag(0, "#e1d5b8");
  flag(-16, color);
  g.fillStyle = "#ffffff";
  g.font = "italic 800 48px Rush, sans-serif";
  g.textAlign = "center";
  g.fillText(label, 96, 224);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(96, 105, 43, 0, Math.PI * 2);
  g.stroke();
  [[96, 48, 96, 81], [96, 129, 96, 162], [39, 105, 70, 105], [
    122,
    105,
    153,
    105,
  ]].forEach(([a, b, c, d]) => {
    g.beginPath();
    g.moveTo(a, b);
    g.lineTo(c, d);
    g.stroke();
  });
  g.beginPath();
  g.arc(96, 105, 5, 0, Math.PI * 2);
  g.fill();
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({
    map: t,
    transparent: true,
    alphaTest: .12,
    side: T.DoubleSide,
  });
}

export function buildArena(scene, map, quality = { shadows: true, shadowSize: 1024 }) {
  scene.background = new T.Color(0x9bcbe0);
  scene.fog = new T.FogExp2(0xb7d7e1, .007);
  scene.add(new T.HemisphereLight(0xf4fbff, 0x899baa, 1.7));
  const sun = new T.DirectionalLight(0xfff2d2, 2.5);
  sun.position.set(-18, 32, 19);
  sun.castShadow = quality.shadows;
  Object.assign(sun.shadow.camera, {
    left: -38,
    right: 38,
    top: 38,
    bottom: -38,
    near: 1,
    far: 100,
  });
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.bias = -.00045;
  scene.add(sun);
  const sky = mesh(
    scene,
    new T.SphereGeometry(140, 36, 20),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader:
        "varying float h;void main(){h=position.y/140.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying float h;void main(){gl_FragColor=vec4(mix(vec3(.64,.83,.93),vec3(.13,.48,.77),smoothstep(-.08,.68,h)),1.);}",
    }),
  );
  sky.renderOrder = -10;
  let seed = 5589;
  const rand = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 256;
  cloudCanvas.height = 96;
  const cg = cloudCanvas.getContext("2d");
  cg.filter = "blur(2px)";
  const gradient = cg.createLinearGradient(0, 12, 0, 88);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(.62, "#f6fcff");
  gradient.addColorStop(1, "#bbe8ff");
  cg.fillStyle = gradient;
  [
    [48, 65, 42, 13],
    [74, 57, 26, 20],
    [102, 47, 34, 34],
    [132, 54, 34, 25],
    [157, 50, 29, 24],
    [185, 59, 27, 17],
    [200, 68, 42, 12],
  ].forEach(([x, y, rx, ry]) => {
    cg.beginPath();
    cg.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    cg.fill();
  });
  const ct = new T.CanvasTexture(cloudCanvas);
  ct.colorSpace = T.SRGBColorSpace;
  const cm = new T.SpriteMaterial({
    map: ct,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < 24; i++) {
    const a = 2 * Math.PI * i / 24 + .1 * rand(), c = new T.Sprite(cm);
    c.position.set(Math.sin(a) * 95, 12 + rand() * 24, Math.cos(a) * 95);
    const w = 10 + rand() * 18;
    c.scale.set(w, w * .38, 1);
    c.renderOrder = -2;
    scene.add(c);
  }
  const palette = {
    cobalt: panels(...(map.colors?.cobalt || ["#4c8eaf", "#417a97"])),
    amber: panels(...(map.colors?.amber || ["#c4a16c", "#ad8c5e"])),
    steel: panels("#7d919d", "#71848f"),
    concrete: panels("#bfc7c5", "#adb5b2"),
    walkway: panels("#d6d7ca", "#c3c5bc"),
    rail: material(0x617782),
    floor: panels(...(map.colors?.floor || ["#a1afb1", "#8c9b9f"]), true),
    dark: material(0x3c505b),
    orange: new T.MeshBasicMaterial({ color: 0xd6ab65 }),
    light: new T.MeshBasicMaterial({ color: 0xf4d69e }),
    blue: material(0x527a8e),
    glass: material(0x83aeba, { metalness: .18, roughness: .35 }),
  };
  // Batch static box faces by material, preserving metre-based texture coordinates.
  const groups = new Map(), unit = new T.BoxGeometry();
  function block(x, y, z, w, h, d, m, rotation = 0) {
    if (!groups.has(m)) groups.set(m, { p: [], n: [], u: [] });
    const b = groups.get(m), c = Math.cos(rotation), s = Math.sin(rotation);
    const pos = unit.attributes.position, norm = unit.attributes.normal;
    for (const i of unit.index.array) {
      const px = pos.getX(i) * w,
        py = pos.getY(i) * h,
        pz = pos.getZ(i) * d,
        nx = norm.getX(i),
        ny = norm.getY(i),
        nz = norm.getZ(i);
      b.p.push(x + px * c + pz * s, y + py, z - px * s + pz * c);
      b.n.push(nx * c + nz * s, ny, -nx * s + nz * c);
      b.u.push((nx ? pz : px) / 1.8, (ny ? pz : py) / 1.8);
    }
  }
  const { floor, steel, concrete, dark, orange, light, glass } = palette;
  block(0, -.17, 0, 75, .34, 75, floor);
  for (const x of [-15, 15]) block(x, .007, 0, .18, .014, 50, orange);
  for (const z of [-16, 16]) block(0, .008, z, 49, .015, .12, orange);
  for (const z of [-21, -12, 12, 21]) {
    block(-.34, .014, z, .19, .015, .86, light, -.7);
    block(.34, .014, z, .19, .015, .86, light, .7);
  }
  // A quiet training facility surrounds the two readable colour zones.
  const banner = [signTexture("#476d80", "A"), signTexture("#aa7f57", "B")];
  for (let side = 0; side < 4; side++) {
    if (quality.presentation && side === 2) continue;
    const angle = side * Math.PI / 2,
      cs = Math.cos(angle),
      sn = Math.sin(angle);
    const place = (x, y, z, w, h, d, m) =>
      block(x * cs + z * sn, y, -x * sn + z * cs, w, h, d, m, angle);
    place(0, 1.3, -27.9, 57, 2.6, 3.8, steel);
    place(0, .16, -25.96, 54, .12, .12, orange);
    place(0, 5.9, -27.5, 56, .8, 4.0, concrete);
    place(0, 6.42, -27.5, 56, .24, 4.25, dark);
    place(0, 4, -29, 55, 3, 1, glass);
    for (let i = -2; i <= 2; i++) {
      const x = i * 10.8;
      place(x, 4, -27.0, 2.4, 3.2, 2.4, concrete);
      place(x, 5.72, -25.42, 3.8, .14, .12, dark);
      place(x, 5.73, -25.34, 2.8, .085, .075, orange);
      if (Math.abs(i) === 1) {
        const o = mesh(
          scene,
          new T.PlaneGeometry(1.75, 3),
          banner[side % 2],
          x * cs - 25.75 * sn,
          3.28,
          -x * sn - 25.75 * cs,
        );
        o.rotation.y = angle;
      }
    }
    // Distant low warehouse roofs add depth without competing with the arena.
    for (let i = 0; i < 3; i++) {
      const x = -20 + i * 18,
        z = -34 - i % 2 * 4,
        w = 8 + i,
        h = 6 + rand() * 2.5;
      place(x, h / 2, z, w, h, 5, concrete);
      place(x, h + .12, z, w + .25, .24, 5.25, dark);
      place(x, h * .69, z + 2.51, w * .72, 1.1, .06, glass);
    }
  }
  for (const face of exposedBoxFaces(map.boxes)) {
    const source = map.boxes[face.source];
    const m = face.normal[1] > 0 && ["steel", "rail"].includes(source.style)
      ? concrete : palette[source.style] || concrete;
    if (!groups.has(m)) groups.set(m, { p: [], n: [], u: [] });
    const b = groups.get(m), [nx, ny] = face.normal;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = face.vertices[i];
      b.p.push(x, y, z); b.n.push(...face.normal);
      b.u.push((nx ? z : x) / 1.8, (ny ? z : y) / 1.8);
    }
  }
  for (const b of map.boxes) {
    if (b.style === "cobalt" || b.style === "amber") {
      for (const sign of [-1, 1]) {
        block(
          b.x + sign * (b.w / 2 - .045), (b.y || 0) + b.h / 2,
          b.z + b.d / 2 + .006, .09, b.h, .012, concrete,
        );
      }
    } else if (b.style === "steel") {
      block(b.x, (b.y || 0) + b.h - .28, b.z + b.d / 2 + .006, Math.min(1.95, b.w * .65), .18, .012, dark);
    }
  }
  for (const [mat, b] of groups) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(b.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(b.n, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(b.u, 2));
    const o = mesh(scene, g, mat);
    o.castShadow = o.receiveShadow = true;
  }
  if (map.targets?.length) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f5edcf';ctx.fillRect(0,0,128,128);
    for(const [radius,color] of [[54,'#b94e38'],[38,'#f5edcf'],[25,'#b94e38'],[11,'#f5edcf']]){ctx.beginPath();ctx.arc(64,64,radius,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const face=new T.MeshBasicMaterial({map:texture}),geometry=new T.PlaneGeometry(1.2,1.2);
    for(const target of map.targets)mesh(scene,geometry,face,target.x,target.y,target.z+.115);
  }
  unit.dispose();
  return sun;
}

export function operator(scene, color = 0xf4664c, weapon = "sunbolt", gear = null) {
  const outfit = cosmeticLoadout(gear);
  const colors = { cobalt: 0x286bc2, ember: 0xcf5e3d, lime: 0x72994b, arctic: 0xd8e7e7, desert: 0xb58a5c, shadow: 0x333b43 };
  const g = new T.Group();
  scene.add(g);
  const armor = material(gear ? wardrobeById(outfit.clothing)?.color??colors[outfit.clothing] : color),
    navy = material(0x273353),
    visor = material(0x55d4ff, { metalness: .22 }),
    trim = material(0xf6f2fa);
  const footwear = material(wardrobeById(outfit.shoes)?.color??({ runner: 0x567c97, tactical: 0x3c443e, alpine: 0xb7bfc5, crimson: 0xa92c37 })[outfit.shoes]);
  applyFabric(armor);
  applyFabric(navy);
  function part(w, h, d, m, x, y, z) {
    const o = box(g, w, h, d, m, x, y, z);
    o.castShadow = true;
    return o;
  }
  part(.38, .48, .27, armor, 0, 1.06, 0);
  part(.33, .18, .26, navy, 0, .71, 0);
  for (const i of [-1, 1]) {
    part(.14, .52, .16, navy, i * .115, .38, 0);
    part(.17, .12, .26, gear ? footwear : trim, i * .12, .075, -.025);
    part(.18, .26, .23, armor, i * .263, 1.16, 0);
    part(.13, .25, .15, navy, i * .257, .96, -.09).rotation.x = -.65;
  }
  const skin = material(0xffcd99),
    hair = material(0x4b2724),
    black = material(0x171d32);
  part(.36, .34, .33, skin, 0, 1.55, 0);
  part(.40, .13, .37, hair, 0, 1.75, .01);
  part(.09, .28, .32, hair, -.175, 1.64, .03);
  part(.09, .24, .32, hair, .175, 1.66, .03);
  for (let i = 0; i < (gear && (wardrobeById(outfit.accessories)||['cap','blaze'].includes(outfit.accessories)||['arctic','lime'].includes(outfit.clothing)) ? 0 : 4); i++) {
    const spike = mesh(
      g,
      new T.ConeGeometry(.082, .19, 4),
      hair,
      -.13 + i * .09,
      1.88,
      .03,
    );
    spike.rotation.z = -.4;
    spike.rotation.x = .2;
  }
  const goggles = part(.35, .12, .07, navy, 0, 1.75, -.18);
  goggles.visible = !gear || outfit.accessories === 'sky';
  if(gear && outfit.accessories === 'blaze') {
    part(.45,.22,.41,navy,0,1.80,0);part(.43,.035,.15,black,0,1.70,-.22);
    for(const side of [-1,1])part(.07,.18,.23,navy,side*.20,1.66,.01);
  }
  if(gear && outfit.accessories === 'violet') {
    part(.39,.14,.05,black,0,1.59,-.19);part(.35,.10,.025,visor,0,1.59,-.225);
  }
  if (gear && outfit.accessories === "cap") {
    part(.43, .12, .39, navy, 0, 1.86, .015); part(.42, .035, .18, navy, 0, 1.81, -.24);
  }
  if (gear && outfit.accessories === "headset") {
    part(.44, .035, .13, black, 0, 1.87, 0);
    for (const side of [-1,1]) part(.065, .15, .16, navy, side * .21, 1.68, 0);
  }
  if (gear && outfit.accessories === "mask") {
    part(.32,.15,.07,navy,0,1.48,-.18);
    for(const side of [-1,1])part(.09,.10,.07,black,side*.12,1.48,-.235);
  }
  visor.color.setHex(({ blaze: 0xffae35, violet: 0xc888fa })[outfit.accessories] || 0x55d4ff);
  for (const side of [-1, 1]) {
    const lens = part(.135, .08, .026, visor, side * .084, 1.755, -.225); lens.visible = goggles.visible;
    part(.028, .066, .008, black, side * .081, 1.58, -.17);
    part(.064, .017, .008, black, side * .081, 1.63, -.17).rotation.z = side *
      .2;
    part(.13, .09, .18, armor, side * .116, .4, -.085);
  }
  part(.07, .012, .012, black, .024, 1.48, -.17).rotation.z = .15;
  part(.43, .105, .34, armor, 0, 1.34, 0);
  const scarf = part(.15, .10, .49, armor, -.22, 1.30, .22);
  scarf.rotation.z = .22;
  part(.29, .28, .04, navy, 0, 1.065, -.15);
  part(.09, .11, .03, trim, .068, 1.14, -.18);
  part(.40, .055, .31, black, 0, .79, 0);
  part(.07, .055, .035, trim, 0, .79, -.175);
  if(gear) {
    if(['arctic','lime'].includes(outfit.clothing)&&!wardrobeById(outfit.accessories)&&!['blaze','cap'].includes(outfit.accessories)) {
      for(const side of [-1,1])part(.07,.50,.38,armor,side*.245,1.68,.01);
      part(.55,.07,.38,armor,0,1.94,.025);
      if(outfit.clothing==='arctic') {
        for(const side of [-1,1])part(.035,.46,.04,trim,side*.21,1.68,-.20);
        part(.45,.04,.04,trim,0,1.90,-.212);
      }
    }
    if(outfit.clothing==='ember') {
      for(const side of [-1,1]) {part(.06,.43,.06,trim,side*.12,1.06,-.17);part(.13,.12,.26,trim,side*.25,1.22,0);}
      part(.16,.14,.025,trim,0,1.13,-.20);
    } else if(outfit.clothing==='lime') {
      part(.45,.58,.06,armor,0,1.03,.18);
      for(let row=0;row<3;row++)for(let col=0;col<5;col++)part(.085,.16,.035,row%2?navy:armor,(col-2)*.08,1.23-row*.14,-.17-row*.006-col*.002).rotation.z=(col%2?.18:-.18);
    } else if(outfit.clothing==='arctic') {
      part(.44,.43,.35,armor,0,1.06,0);part(.45,.12,.37,trim,0,1.37,0);part(.32,.42,.17,navy,0,1.08,.24);
      for(const side of [-1,1])part(.17,.15,.08,armor,side*.12,.97,-.22);
    } else if(outfit.clothing==='desert') {
      part(.46,.69,.055,armor,0,1.04,.19);
      for(const side of [-1,1])part(.16,.15,.10,navy,side*.15,.89,-.18);
    } else if(outfit.clothing==='shadow') {
      part(.39,.40,.09,black,0,1.07,-.18);
      for(const side of [-1,1]) {part(.16,.20,.08,armor,side*.10,1.06,-.25);part(.19,.13,.28,black,side*.25,1.22,0);}
    }
    for(const side of [-1,1]) {
      if(outfit.shoes==='tactical') {part(.18,.20,.23,footwear,side*.12,.16,0);part(.19,.05,.28,black,side*.12,.035,-.025);}
      if(outfit.shoes==='alpine') {part(.20,.18,.25,trim,side*.12,.16,0);for(const y of [.12,.20])part(.21,.035,.035,footwear,side*.12,y,-.14);}
      if(outfit.shoes==='crimson') {part(.18,.20,.22,footwear,side*.12,.16,0);part(.19,.035,.28,trim,side*.12,.07,-.025);}
    }
  }
  setOperatorWeapon(g, weapon);
  const shield = mesh(
    g,
    new T.CylinderGeometry(.46, .46, 1.95, 12, 1, true),
    new T.MeshBasicMaterial({
      color: 0x67e8ff,
      transparent: true,
      opacity: .18,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    0,
    .98,
    0,
  );
  applyWardrobeModels(g,outfit);
  if(wardrobeById(outfit.accessories))g.traverse(node=>{if(node.material===hair)node.visible=false;});
  shield.visible = false;
  g.userData.shield = shield;
  g.userData.stride = { phase: 0, weight: 0 };
  Object.defineProperty(g.userData, "victoryRig", { value: g.children.filter((node) =>
    (node.isMesh||node.userData.wardrobePart?.startsWith('arm')) && Math.abs(node.position.x) > .24 && node.position.y > .9 && node.position.y < 1.3
  ).map((node) => ({ node, y: node.position.y, x: node.position.x, z: node.rotation.z })), configurable: true });
  g.userData.legs = g.children.filter((o) => (o.isMesh||o.userData.wardrobePart?.startsWith('foot')) && o.position.y < .68)
    .map((node) => ({
      node,
      y: node.position.y,
      z: node.position.z,
      rotation: node.rotation.x,
      side: Math.sign(node.position.x),
    }));
  return g;
}

export function setOperatorWeapon(model, id, finish='field') {
  const weapon = weaponById(id).id;
  if (model.userData.weapon === weapon) {setRifleFinish(model.userData.gun,finish);return;}
  const previous = model.userData.gun;
  if (previous) {
    previous.removeFromParent();
    disposeRifle(previous);
  }
  const gun = rifle(model, weapon, false);
  gun.position.set(.12, 1.03, -.18);
  gun.rotation.set(.05, -.05, .05);
  gun.scale.setScalar(.62);
  // Keep node references out of JSON clone metadata.
  Object.defineProperty(model.userData, "gun", { value: gun, configurable: true });
  model.userData.weapon = weapon;
  setRifleFinish(gun,finish);
}

export function animateOperator(model, speed, dt) {
  const stride = model.userData.stride;
  stride.weight += (Math.min(.48, Math.max(0, speed) * .085) - stride.weight) *
    (1 - Math.exp(-dt * 14));
  stride.phase = (stride.phase + Math.max(0, speed) * dt * 2.8) % (Math.PI * 2);
  for (const leg of model.userData.legs) {
    const angle = Math.sin(stride.phase) * stride.weight * leg.side;
    const c = Math.cos(angle), s = Math.sin(angle), y = leg.y - .72;
    leg.node.position.y = .72 + y * c - leg.z * s;
    leg.node.position.z = y * s + leg.z * c;
    leg.node.rotation.x = leg.rotation + angle;
  }
}

const combatRigs = new WeakMap();
export function animateOperatorCombat(model, pose = {}, dt = 0) {
  let rig = combatRigs.get(model);
  if(!rig){
    rig={lean:0,pitch:0,parts:model.children.filter(node=>(node.isMesh||node.userData.wardrobePart)&&node!==model.userData.shield&&node.position.y>.73)
      .map(node=>({node,x:node.position.x,y:node.position.y,z:node.position.z,rx:node.rotation.x,rz:node.rotation.z}))};
    combatRigs.set(model,rig);
  }
  const blend=pose.snap?1:1-Math.exp(-Math.max(0,dt)*18);
  const lean=Math.max(-.15,Math.min(.15,Number(pose.lean)||0)),pitch=Math.max(-1.4835,Math.min(1.4835,Number(pose.pitch)||0));
  rig.lean+=(lean-rig.lean)*blend;rig.pitch+=(pitch-rig.pitch)*blend;
  const motion=pose.reducedMotion?0:1,blade=knifeSwing(pose.swingAge??Infinity),thrust=Math.max(0,-blade.z-.68)*motion;
  const toss=Number.isFinite(pose.throwAge)&&pose.throwAge>=0&&pose.throwAge<380?Math.sin(pose.throwAge/380*Math.PI)*motion:0;
  const charge=Math.max(0,Math.min(1,Number(pose.charge)||0));
  for(const part of rig.parts){
    const {node,x,y,z,rx,rz}=part,head=y>1.39,arm=Math.abs(x)>.24&&y<1.3;
    const look=head?rig.pitch*.35:0,c=Math.cos(look),s=Math.sin(look),height=y-1.43;
    node.position.set(x+rig.lean*(head?1:arm?.65:.35),head?1.43+height*c-z*s:y,head?height*s+z*c:z);
    node.rotation.x=rx+look;node.rotation.z=rz;
    if(arm){
      const reach=x>0?thrust*.65+toss*.13-charge*.05:thrust*.12;
      node.position.z-=reach;node.rotation.x+=rig.pitch*.2-reach*1.8;
    }
  }
  const gun=model.userData.gun;
  if(rig.gun!==gun){rig.gun=gun;rig.gunPose={x:gun.position.x,y:gun.position.y,z:gun.position.z,rx:gun.rotation.x};}
  gun.position.x=rig.gunPose.x+rig.lean*.65;gun.rotation.x=rig.gunPose.rx+rig.pitch*.8;
  for(const [kind,item] of Object.entries(pose.items||{})){
    item.position.set(.24+rig.lean*.65,1.02+Math.sin(rig.pitch)*.12,-.22-(kind==='knife'?thrust:toss*.2-charge*.06));
    item.rotation.set(kind==='grenade'?-charge*.4+toss*1.4:0,0,kind==='knife'?(blade.rz+.35)*motion:0);
  }
}
