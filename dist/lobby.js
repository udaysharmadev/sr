import {applyWardrobeModels} from './wardrobe-models.js';
import {wardrobeById} from './wardrobe.js';
import { applyFabric } from "./surface-textures.js";
import * as T from "./vendor/three.module.js";

// Local model coordinates use metres, Y up and positive Z toward the operator's chest.
const palette = new Map();
function material(color, metalness = 0, roughness = .73) {
  const key = color + "/" + metalness + "/" + roughness;
  if (!palette.has(key)) {
    palette.set(
      key,
      new T.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        flatShading: true,
      }),
    );
  }
  return palette.get(key);
}
const block = new T.BoxGeometry();
function group(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function part(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, typeof mat === "string" ? material(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, x, y, z, w, h, d, mat) {
  const m = part(parent, block, mat, x, y, z);
  m.scale.set(w, h, d);
  return m;
}
// A clipped rectangular cross-section keeps armor planes and their highlights crisp.
function shell(parent, x, y, z, rings, mat, clip = .24) {
  const verts = [], indices = [];
  for (const [height, w, d, dz = 0, dx = 0] of rings) {
    for (
      const [px, pz] of [
        [-1 + clip, 1],
        [1 - clip, 1],
        [1, 1 - clip],
        [1, -1 + clip],
        [1 - clip, -1],
        [-1 + clip, -1],
        [-1, -1 + clip],
        [-1, 1 - clip],
      ]
    ) {
      verts.push(px * w / 2 + dx, height, dz + pz * d / 2);
    }
  }
  for (let r = 1; r < rings.length; r++) {
    for (let i = 0; i < 8; i++) {
      const a = (r - 1) * 8 + i, b = (r - 1) * 8 + (i + 1) % 8;
      indices.push(a, b, a + 8, b, b + 8, a + 8);
    }
  }
  const top = 8 * (rings.length - 1);
  for (let i = 1; i < 7; i++) {
    indices.push(0, i + 1, i, top, top + i, top + i + 1);
  }
  const geom = new T.BufferGeometry();
  geom.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return part(parent, geom, mat, x, y, z);
}
function panel(parent, x, y, z, w, h, d, mat, clip = .2) {
  const b = Math.min(h * .18, .04);
  return shell(
    parent,
    x,
    y,
    z,
    [[-h / 2, w * .92, d * .86], [-h / 2 + b, w, d], [h / 2 - b, w, d], [
      h / 2,
      w * .91,
      d * .86,
    ]],
    mat,
    clip,
  );
}
function limb(parent, a, b, widthA, widthB, depth, mat) {
  const bottom = new T.Vector3(...a),
    top = new T.Vector3(...b),
    delta = top.clone().sub(bottom);
  const len = delta.length();
  const item = shell(
    parent,
    0,
    0,
    0,
    [[0, widthA * .86, depth * .85], [len * .12, widthA, depth], [
      len * .8,
      widthB,
      depth * .96,
    ], [len, widthB * .84, depth * .85]],
    mat,
    .36,
  );
  item.position.copy(bottom);
  item.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return item;
}
function rod(parent, a, b, r, mat, r2 = r, segments = 10) {
  const from = new T.Vector3(...a),
    to = new T.Vector3(...b),
    delta = to.clone().sub(from);
  const item = part(
    parent,
    new T.CylinderGeometry(r2, r, delta.length(), segments),
    mat,
  );
  item.position.copy(from.add(to).multiplyScalar(.5));
  item.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return item;
}
function label(
  parent,
  text,
  x,
  y,
  z,
  w,
  h,
  ink = "#ecf4ed",
  font = "900 80px Arial",
  align = "center",
) {
  const cv = document.createElement("canvas");
  cv.width = 768;
  cv.height = 160;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = ink;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, align === "center" ? 384 : 4, 86, 756);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  const m = part(
    parent,
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    x,
    y,
    z,
  );
  m.castShadow = false;
  return m;
}
const navy = "#172735",
  body = "#273847",
  soft = "#344957",
  dark = "#101c27",
  edge = "#526c79",
  silver = "#8eabb4";
const amber = "#f29a1a", cyan = "#77dce9", cobalt = "#2059aa", blue = "#347bd1";
function rifle(parent, detailed = true) {
  const g = group(parent);
  const steel = material("#273742", .42, .42),
    light = material("#71868e", .40, .48),
    stock = material("#ff9a19").clone();
  g.userData.finish = stock;
  panel(g, -.48, 0, 0, .32, .17, .115, stock);
  panel(g, -.64, -.015, 0, .07, .235, .14, dark);
  panel(g, -.48, .083, 0, .25, .06, .12, steel);
  limb(g, [-.49, -.055, 0], [-.18, .0, 0], .062, .085, .077, light);
  panel(g, -.12, .018, 0, .53, .14, .13, "#e5eefa");
  panel(g, .21, .013, 0, .32, .148, .138, stock);
  for (let i = 0; i < 5; i++) {
    box(g, .095 + i * .044, .038, .071, .022, .044, .01, dark).rotation.z = -.2;
  }
  panel(g, .38, .004, 0, .1, .104, .117, light);
  rod(g, [.39, .016, 0], [.86, .016, 0], .037, steel, .031, 12);
  rod(g, [.7, .016, 0], [.75, .016, 0], .048, light);
  rod(g, [.84, .016, 0], [1.03, .016, 0], .063, steel, .062, 12);
  rod(g, [1.031, .016, 0], [1.035, .016, 0], .043, dark);
  const grip = panel(g, -.19, -.112, 0, .08, .21, .094, dark);
  grip.rotation.z = -.25;
  panel(g, .012, -.105, 0, .14, .14, .115, steel).rotation.z = -.10;
  box(g, -.105, -.119, 0, .1, .018, .025, light);
  rod(g, [-.035, -.122, 0], [-.027, -.05, 0], .009, light);
  box(g, -.04, .104, 0, .39, .027, .075, light);
  for (const x of [-.15, .07]) box(g, x, .15, 0, .052, .08, .088, steel);
  rod(g, [-.26, .196, 0], [.13, .196, 0], .047, steel);
  rod(g, [.06, .196, 0], [.18, .196, 0], .047, steel, .077);
  rod(g, [.165, .196, 0], [.225, .196, 0], .079, dark);
  rod(
    g,
    [.225, .196, 0],
    [.228, .196, 0],
    .065,
    new T.MeshBasicMaterial({ color: "#1ce9ff" }),
  );
  rod(g, [-.28, .196, 0], [-.195, .196, 0], .067, dark);
  rod(g, [-.11, .235, 0], [-.11, .273, 0], .033, steel);
  if (detailed) {
    box(g, .20, -.04, .076, .19, .018, .012, amber);
    rod(g, [-.19, .055, .068], [-.23, .005, .15], .012, light);
    panel(g, -.23, -.002, .15, .043, .035, .034, dark);
    label(
      g,
      "SR  /  05",
      -.08,
      .018,
      .068,
      .22,
      .049,
      "#bed2cf",
      "bold 94px monospace",
    );
    for (const x of [-.58, -.44, -.2, .35]) {
      rod(g, [x, .01, .064], [x, .01, .073], .012, light);
    }
  }
  return g;
}
export function buildOperator(scene) {
  const root = group(scene), hip = group(root), chest = group(hip, 0, 1.485, 0);
  const plastic = (color) =>
    new T.MeshStandardMaterial({ color, roughness: .53, metalness: 0 });
  const paint = plastic(cobalt),
    accent = plastic(blue),
    suit = plastic("#244f80"),
    pants = plastic("#25364c");
  const shoeUpper = plastic("#294660"),
    shoeAccent = plastic("#b1e4f4"),
    skin = plastic("#ffce9d");
  const hair = plastic("#56301f"),
    hairHighlight = plastic("#744329"),
    ink = plastic("#1c2028"),
    trim = plastic("#e7eff5");
  for (const fabric of [paint, accent, suit, pants]) applyFabric(fabric);
  applyFabric(shoeUpper, "leather");
  applyFabric(shoeAccent, "rubber");
  function rounded(parent, x, y, z, w, h, d, mat, r = .025) {
    r = Math.min(r, w / 4, h / 4, d / 4);
    const shape = new T.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: d - 2 * r,
      bevelEnabled: true,
      bevelSize: r,
      bevelThickness: r,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 5,
    });
    geometry.translate(0, 0, -d / 2 + r);
    return part(parent, geometry, mat, x, y, z);
  }
  function avatarArm(parent, a, b, width, depth, mat) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      delta = to.clone().sub(from);
    const item = rounded(
      parent,
      0,
      0,
      0,
      width,
      delta.length() + .04,
      depth,
      mat,
      .018,
    );
    item.position.copy(from.add(to).multiplyScalar(.5));
    item.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return item;
  }
  // Classic toy-avatar proportions, with broad cuboid limbs and a short torso.
  const boots = [], shoeToe = [];
  for (const side of [-1, 1]) {
    const leg = group(root, side * .255, 1.35, side < 0 ? .035 : -.035);
    leg.rotation.z = side * .025;
    rounded(leg, 0, -.56, 0, .43, 1.10, .43, pants, .025);
    rounded(leg, 0, -.46, .22, .29, .28, .035, suit, .015);
    const boot = group(root, side * .27, 0, side < 0 ? .07 : -.02);
    boots.push(boot);
    rounded(boot, 0, .07, .055, .49, .12, .62, trim, .023);
    rounded(boot, 0, .18, .045, .47, .19, .57, shoeUpper, .035);
    shoeToe.push(rounded(boot, 0, .20, .32, .41, .07, .025, shoeAccent, .012));
    for (let n = 0; n < 3; n++) {
      rounded(boot, 0, .278, .19 - n * .045, .22, .012, .019, trim, .004);
    }
  }
  rounded(hip, 0, 1.29, 0, .87, .19, .47, pants, .023);
  rounded(hip, 0, 1.37, .025, .89, .09, .49, ink, .012);
  rounded(hip, 0, 1.37, .28, .105, .075, .025, trim, .008);
  rounded(chest, 0, .30, 0, .89, .84, .49, suit, .025);
  for (const side of [-1, 1]) {
    rounded(chest, side * .23, .34, .263, .36, .59, .055, paint, .02);
    rounded(chest, side * .24, .13, .30, .27, .19, .05, suit, .014);
    rounded(chest, side * .24, .18, .333, .23, .022, .012, accent, .005);
  }
  rounded(chest, 0, .30, .304, .055, .75, .033, ink, .007);
  rounded(chest, -.25, .52, .307, .13, .065, .018, trim, .006);
  rounded(chest, .25, .54, .311, .12, .026, .012, accent, .004);
  const arms = [];
  // One-piece rectangular upper arms and forearms keep the silhouette blocky.
  for (const side of [-1, 1]) {
    const shoulder = [side * .60, .55, 0],
      elbow = [side * .69, .12, .08],
      wrist = side < 0 ? [-.24, .27, .47] : [.35, .29, .40];
    const upper = avatarArm(chest, elbow, shoulder, .38, .38, suit);
    const lower = avatarArm(chest, elbow, wrist, .31, .31, skin);
    upper.material = suit;
    lower.material = skin;
    const cap = rounded(chest, shoulder[0], .52, .01, .41, .24, .42, paint, .025);
    const hand = rounded(chest, wrist[0], wrist[1], wrist[2], .285, .28, .30, skin, .025);
    const pivot = group(chest, ...shoulder);
    for (const node of [upper, lower, cap, hand]) { pivot.add(node); node.position.sub(new T.Vector3(...shoulder)); }
    arms.push({ root: pivot, side });
  }
  const h = group(chest, 0, .80, 0);
  rounded(h, 0, .18, 0, .62, .61, .58, skin, .06);
  for (const side of [-1, 1]) {
    const eye = part(
      h,
      new T.SphereGeometry(1, 16, 10),
      ink,
      side * .122,
      .205,
      .302,
    );
    eye.scale.set(.026, .044, .008);
    rounded(h, side * .122, .285, .303, .103, .019, .008, hair, .006).rotation
      .z = side * .12;
  }
  const smile = new T.CatmullRomCurve3([
    new T.Vector3(-.095, .113, .307),
    new T.Vector3(-.04, .083, .313),
    new T.Vector3(.04, .083, .313),
    new T.Vector3(.095, .113, .307),
  ]);
  part(h, new T.TubeGeometry(smile, 16, .008, 8, false), ink);
  // A clean swept fringe replaces the jagged low-poly hair spikes.
  const hairGroup = group(h);
  rounded(hairGroup, 0, .482, -.035, .67, .18, .60, hair, .055);
  rounded(hairGroup, -.287, .30, -.075, .10, .34, .45, hair, .025);
  rounded(hairGroup, .287, .33, -.075, .10, .27, .44, hair, .025);
  for (
    const [index, [x, y, w, angle]] of [[-.18, .42, .25, -.25], [.03, .44, .25, -.3], [
      .22,
      .455,
      .19,
      -.25,
    ]].entries()
  ) {
    const fringe = rounded(hairGroup, x, y, .261 + index * .008, w, .20, .115, hairHighlight, .027);
    fringe.rotation.z = angle;
  }
  const visor = new T.MeshStandardMaterial({
    color: "#27ddff",
    roughness: .16,
    metalness: .18,
    emissive: "#053b4b",
    emissiveIntensity: .25,
  });
  const goggles = group(h, 0, .438, .30);
  rounded(goggles, 0, 0, -.02, .61, .13, .085, ink, .025);
  for (const side of [-1, 1]) {
    rounded(goggles, side * .15, .002, .025, .25, .15, .055, ink, .025);
    rounded(goggles, side * .15, .007, .058, .204, .108, .021, visor, .015);
    rounded(
      goggles,
      side * .15 - .045,
      .021,
      .071,
      .025,
      .062,
      .006,
      trim,
      .004,
    ).rotation.z = -.5;
  }
  const cap = group(h);
  rounded(cap, 0, .49, -.025, .69, .24, .62, paint, .06);
  rounded(cap, 0, .398, .35, .67, .04, .37, paint, .015);
  const headset = group(h);
  const band = new T.CatmullRomCurve3([
    new T.Vector3(-.36, .19, 0),
    new T.Vector3(-.35, .52, 0),
    new T.Vector3(0, .65, 0),
    new T.Vector3(.35, .52, 0),
    new T.Vector3(.36, .19, 0),
  ]);
  part(headset, new T.TubeGeometry(band, 24, .036, 8, false), ink);
  for (const side of [-1, 1]) {
    rounded(headset, side * .348, .18, -.02, .115, .25, .23, ink, .03);
    rounded(headset, side * .41, .18, -.02, .018, .17, .16, paint, .015);
  }
  rod(headset, [-.37, .12, .06], [-.25, .07, .34], .013, ink);
  rounded(headset, -.20, .07, .355, .10, .036, .04, ink, .012);
  const mask = group(h);
  rounded(mask, 0, .065, .305, .49, .20, .08, ink, .035);
  for (let i = 0; i < 3; i++) {
    rounded(mask, 0, .025 + i * .045, .351, .32, .013, .006, suit, .004);
  }
  for (const side of [-1, 1]) {
    const filter = part(mask, new T.CylinderGeometry(.085,.085,.07,12), ink, side*.19,.04,.37);
    filter.rotation.x = Math.PI/2;
    rounded(mask, side*.19,.04,.412,.10,.025,.01,trim,.004);
  }
  const helmet = group(h), helmetPaint = plastic('#777e5f');
  rounded(helmet,0,.45,-.02,.76,.37,.70,helmetPaint,.065);
  rounded(helmet,0,.30,.34,.73,.055,.14,ink,.012);
  for(const side of [-1,1]) {
    rounded(helmet,side*.34,.20,-.02,.10,.26,.37,helmetPaint,.02);
    rounded(helmet,side*.32,.43,.08,.035,.11,.24,ink,.008);
  }
  const faceVisor = group(h);
  rounded(faceVisor,0,.205,.321,.65,.23,.08,ink,.028);
  rounded(faceVisor,0,.205,.371,.58,.165,.026,visor,.02);
  for(const side of [-1,1]) rounded(faceVisor,side*.337,.205,.05,.04,.10,.52,ink,.01);
  const hood = group(chest, 0, .71, -.11);
  rounded(hood, 0, .04, 0, .63, .23, .37, paint, .05);
  const cape = group(chest);
  rounded(cape, 0, .12, -.29, .78, .83, .08, paint, .025);
  const vest = group(chest);
  rounded(vest, 0, .35, .32, .70, .52, .09, ink, .02);
  for (const side of [-1, 1]) {
    rounded(vest, side * .18, .20, .38, .28, .18, .045, paint, .015);
  }
  const scarf = group(chest, 0, .71, .01);
  rounded(scarf, 0, .015, 0, .68, .17, .58, paint, .04);
  rounded(scarf, 0, -.02, .30, .62, .12, .08, accent, .025);
  const ribbon = new T.Shape();
  ribbon.moveTo(0, 0);
  ribbon.bezierCurveTo(-.25, .09, -.42, .18, -.62, .08);
  ribbon.lineTo(-.80, .14);
  ribbon.lineTo(-.72, -.015);
  ribbon.bezierCurveTo(-.45, -.08, -.22, -.04, 0, -.11);
  ribbon.closePath();
  part(
    scarf,
    new T.ExtrudeGeometry(ribbon, {
      depth: .035,
      bevelEnabled: true,
      bevelSize: .008,
      bevelThickness: .006,
      bevelSegments: 2,
      steps: 1,
    }),
    paint,
    -.25,
    .005,
    -.12,
  );
  const costumes = {}, costumeSleeves = {}, costumeHoods = {};
  for(const id of ['cobalt','ember','lime','arctic','desert','shadow']) costumes[id]=group(chest);
  for(const id of ['arctic','lime'])costumeHoods[id]=group(costumes[id]);
  // Geometry, not just colour, distinguishes the six costumes.
  for(const side of [-1,1]) {
    rounded(costumes.cobalt,side*.33,.35,.32,.045,.65,.03,trim,.006);
    rounded(costumes.ember,side*.23,.32,.35,.12,.73,.08,ink,.008).rotation.z=side*.15;
    rounded(costumes.ember,side*.47,.57,.03,.27,.15,.54,trim,.018);
    rounded(costumes.ember,side*.25,.02,.36,.25,.19,.08,paint,.012);
    rounded(costumes.arctic,side*.455,.38,.01,.16,.73,.62,paint,.035);
    rounded(costumes.arctic,side*.29,.21,.37,.30,.29,.13,paint,.02);
    rounded(costumes.arctic,side*.29,.39,.45,.30,.06,.03,trim,.009);
    rounded(costumes.desert,side*.32,.03,.33,.30,.30,.15,pants,.015);
    rounded(costumes.desert,side*.50,.55,-.04,.24,.25,.60,paint,.025);
    rounded(costumes.shadow,side*.49,.54,.01,.32,.22,.56,ink,.025);
    rounded(costumes.shadow,side*.23,.36,.41,.26,.30,.14,paint,.012);
    for(let n=0;n<3;n++) rounded(costumes.shadow,side*.23,.26+n*.075,.49,.22,.035,.015,accent,.004);
  }
  rounded(costumes.ember,0,.42,.415,.32,.24,.035,trim,.012);
  rounded(costumes.ember,0,.42,.424,.15,.13,.012,paint,.004);
  rounded(costumes.arctic,0,.27,-.40,.68,.77,.25,suit,.035);
  rounded(costumes.arctic,0,.71,-.10,.82,.19,.68,trim,.04);
  rounded(costumes.desert,0,-.12,-.305,.95,1.22,.10,paint,.018);
  rounded(costumes.shadow,0,.28,-.37,.65,.65,.16,ink,.02);
  rounded(costumes.lime,0,.12,-.30,1.02,1.08,.13,paint,.02);
  for(let row=0;row<4;row++) for(let col=0;col<7;col++) {
    const leaf=rounded(costumes.lime,(col-3)*.14,.56-row*.22,.30+(row%2)*.035+(col%3)*.008,.15,.29,.045,row%2?paint:accent,.012);
    leaf.rotation.z=(col%2?1:-1)*.22;
  }
  // Costume pieces continue onto the legs and sleeves, rather than recolouring a jacket.
  for(const side of [-1,1]) {
    rounded(costumes.ember,side*.40,-.70,.13,.055,.82,.035,trim,.006);
    rounded(costumes.ember,side*.25,-.90,.27,.30,.18,.06,paint,.012);
    rounded(costumes.arctic,side*.39,-.17,.02,.18,.29,.60,paint,.025);
    rounded(costumes.arctic,side*.25,-.80,.26,.34,.28,.07,trim,.02);
    rounded(costumes.desert,side*.28,-.49,.19,.38,.49,.08,paint,.012);
    rounded(costumes.shadow,side*.25,-.76,.27,.32,.26,.085,ink,.012);
    rounded(costumes.shadow,side*.40,-.42,.07,.12,.35,.24,paint,.012);
    rounded(costumeHoods.lime,side*.42,1.05,-.04,.18,.80,.62,paint,.025);
    rounded(costumeHoods.arctic,side*.43,1.03,-.08,.18,.80,.67,paint,.035);
    rounded(costumeHoods.arctic,side*.37,1.03,.25,.09,.76,.08,trim,.02);
    for(let row=0;row<3;row++) {
      const leaf=rounded(costumes.lime,side*(.21+row*.055),-.33-row*.23,.27+row*.012,.32,.35,.07,row%2?paint:accent,.012);
      leaf.rotation.z=side*.15;
    }
  }
  rounded(costumeHoods.arctic,0,1.43,-.06,.94,.18,.67,paint,.035);
  rounded(costumeHoods.arctic,0,1.36,.27,.83,.12,.08,trim,.025);
  rounded(costumeHoods.lime,0,1.43,-.055,.92,.18,.68,paint,.025);
  const sash=rounded(costumes.desert,-.02,.34,.40,.24,.93,.065,accent,.012);sash.rotation.z=-.60;
  for(const arm of arms) {
    for(const id of ['ember','arctic','shadow']) {
      const node=group(arm.root);
      rounded(node,arm.side*.06,-.37,.19,id==='arctic'?.38:.33,.16,.34,id==='arctic'?trim:ink,.018);
      costumeSleeves[id] ||= [];costumeSleeves[id].push(node);
    }
  }
  const shoeVariants = { runner:[], tactical:[], alpine:[], crimson:[] };
  for(const boot of boots) {
    for(const id of Object.keys(shoeVariants)) {
      const detail=group(boot);shoeVariants[id].push(detail);
      if(id==='runner') rounded(detail,0,.18,.345,.44,.055,.04,accent,.008);
      if(id==='crimson') {
        // Keep both faces clear of the asymmetric trouser stance.
        rounded(detail,0,.40,-.02,.47,.32,.48,shoeUpper,.025).name='crimson-collar';
        rounded(detail,0,.46,.225,.32,.055,.02,trim,.005);
        for(const side of [-1,1]) rounded(detail,side*.26,.27,.04,.015,.05,.36,trim,.005).rotation.x=.25;
      }
      if(id==='tactical') {
        rounded(detail,0,.38,-.02,.48,.37,.48,shoeUpper,.018).name='tactical-collar';
        for(let i=0;i<5;i++) rounded(detail,0,.42-i*.055,.225,.29,.016,.025,trim,.004);
        for(let i=0;i<4;i++) for(const side of [-1,1]) rounded(detail,side*.19,.032,-.16+i*.14,.10,.055,.075,ink,.006);
      }
      if(id==='alpine') {
        rounded(detail,0,.38,-.03,.50,.34,.46,trim,.025);
        for(const y of [.31,.45]) rounded(detail,0,y,.21,.47,.08,.06,shoeAccent,.008);
        for(const side of [-1,1]) rounded(detail,side*.20,.055,.30,.055,.09,.09,ink,.007);
      }
    }
  }
  const gun = rifle(chest);
  gun.position.set(0, .38, .36);
  gun.rotation.z = -.245;
  return {
    root,
    hip,
    chest,
    arms,
    head: h,
    paint,
    accent,
    suit,
    pants,
    shoeUpper,
    shoeAccent,
    boots,
    shoeToe,
    visor,
    stock: gun.userData.finish,
    gun,
    goggles,
    cap,
    headset,
    mask,
    hood,
    cape,
    vest,
    scarf,
    costumes, costumeSleeves, costumeHoods, shoeVariants, helmet, faceVisor, hairGroup,
  };
}

export function applyOperatorGear(operator, gear = {}) {
  const outfits = {
    cobalt: ["#1656b5", "#39a4f1", "#204475", "#21344c"],
    ember: ["#b13e29", "#ff9f4c", "#743c32", "#312f3c"],
    lime: ["#4e8440", "#b7db75", "#364f37", "#263b35"],
    arctic: ["#d8e7e7", "#8fdce9", "#a8c1ce", "#52697b"],
    desert: ["#b58a5c", "#e1c590", "#81694b", "#665743"],
    shadow: ["#252b35", "#596c82", "#232d37", "#1b2530"],
  };
  const custom=wardrobeById(gear.clothing);
  const colors = custom ? [custom.color,custom.color,custom.color,0x28313c] : outfits[gear.clothing] || outfits.cobalt;
  operator.paint.color.set(colors[0]);
  operator.accent.color.set(colors[1]);
  operator.suit.color.set(colors[2]);
  operator.pants.color.set(colors[3]);
  operator.hood.visible = gear.clothing === "arctic"&&!wardrobeById(gear.accessories);
  operator.cape.visible = gear.clothing === "desert";
  operator.vest.visible = gear.clothing === "shadow";
  for(const [id,node] of Object.entries(operator.costumes || {})) {
    node.visible=id===(gear.clothing || 'cobalt');
    for(const sleeve of operator.costumeSleeves?.[id] || [])sleeve.visible=node.visible;
  }
  operator.scarf.visible = !custom&&!['ember','lime','shadow'].includes(gear.clothing);
  const shoes = gear.shoes || "runner";
  const shoeColors = {
    runner: ["#274965", "#a6d9e8"],
    tactical: ["#3c443e", "#73806c"],
    alpine: ["#b7bfc5", "#f2b14b"],
    crimson: ["#a92c37", "#f8d6cf"],
  }[shoes] || ["#274965", "#a6d9e8"];
  operator.shoeUpper.color.set(shoeColors[0]);
  operator.shoeAccent.color.set(shoeColors[1]);
  for (const boot of operator.boots) {
    // Wider snow boots need stance clearance, rather than intersecting at the toes.
    boot.position.x = Math.sign(boot.position.x) * (shoes === 'alpine' ? .33 : .28);
    boot.scale.set(
      shoes === "alpine" ? 1.12 : 1,
      shoes === "runner" || shoes === "crimson" ? .88 : 1,
      shoes === "alpine" ? 1.10 : 1,
    );
  }
  for(const [id,nodes] of Object.entries(operator.shoeVariants || {})) for(const node of nodes) node.visible=id===shoes;
  const accessory = gear.accessories || "sky";
  for(const node of Object.values(operator.costumeHoods || {}))node.visible=!wardrobeById(accessory)&&!['blaze','cap'].includes(accessory);
  operator.goggles.visible = accessory === 'sky';
  operator.helmet.visible = accessory === 'blaze';
  operator.faceVisor.visible = accessory === 'violet';
  operator.hairGroup.visible = !wardrobeById(accessory)&&!['blaze','cap'].includes(accessory);
  operator.cap.visible = accessory === "cap";
  operator.headset.visible = accessory === "headset";
  operator.mask.visible = accessory === "mask";
  operator.visor.color.set(
    ({ blaze: "#ffae35", violet: "#c888fa" })[accessory] || "#29dcff",
  );
  const footwear=wardrobeById(shoes);if(footwear){operator.shoeUpper.color.setHex(footwear.color);operator.shoeAccent.color.setHex(footwear.color);}
  applyWardrobeModels(operator.root,gear,operator);
}

function buildBay(scene) {
  const blueMetal = "#526b9b",
    high = "#8098c4",
    deep = "#354b76",
    inset = "#253c65";
  const glow = new T.MeshBasicMaterial({ color: "#ffb53d" }),
    ice = new T.MeshBasicMaterial({ color: "#36dcff" });
  const floorMaterial = material("#6880ad", .13, .56);
  box(scene, 0, -.12, 0, 22, .23, 22, deep);
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 3; z++) {
      box(scene, x * 2.12, -.039, z * 2.1, 2.105, .065, 2.083, floorMaterial);
    }
  }
  const wallZ = -4.5;
  box(scene, -5.15, 2.48, wallZ, 4.8, 5, .38, blueMetal);
  box(scene, 6.03, 2.48, wallZ, 3.15, 5, .38, blueMetal);
  box(scene, .9, .39, wallZ, 7.26, .78, .45, high);
  box(scene, .9, 4.61, wallZ, 7.26, .89, .56, blueMetal);
  // An octagonal cutaway between the bay and the practice yard.
  function brace(ax, ay, bx, by, w, z, depth, mat) {
    const m = box(
      scene,
      (ax + bx) * .5,
      (ay + by) * .5,
      z,
      Math.hypot(bx - ax, by - ay),
      w,
      depth,
      mat,
    );
    m.rotation.z = Math.atan2(by - ay, bx - ax);
  }
  const frame = [
    [-2.78, 1.15],
    [-2.40, .79],
    [4.13, .79],
    [4.51, 1.16],
    [4.51, 3.83],
    [4.13, 4.18],
    [-2.40, 4.18],
    [-2.78, 3.82],
  ];
  for (let i = 0; i < frame.length; i++) {
    const a = frame[i], b = frame[(i + 1) % frame.length];
    brace(...a, ...b, .24, wallZ, .60, deep);
    brace(...a, ...b, .047, wallZ + .31, .025, i % 2 ? high : ice);
  }
  for (const side of [-1, 1]) {
    const x = side * 6.25;
    box(scene, x, 2.45, -.20, .30, 4.90, 9, blueMetal);
    for (let j = 0; j < 4; j++) {
      const z = -3.55 + j * 2.08;
      box(scene, x - side * .145, 2.5, z, .20, 4.6, 1.93, high);
      box(scene, x - side * .27, .28, z, .41, .56, 2.00, deep);
      box(scene, x - side * .38, .29, z, .21, .073, .72, glow);
      box(scene, x - side * .28, 4.37, z, .35, .22, 1.12, deep);
      box(scene, x - side * .47, 4.37, z, .045, .08, .94, ice);
    }
    for (let j = 0; j < 3; j++) {
      box(scene, side * (1.80 + j * 1.55), 4.69, -1.35, .13, .22, 7.14, deep);
    }
    box(scene, side * 1.87, 4.57, -.45, .079, .017, 2.63, glow);
    box(scene, side * 4.53, .14, -4.20, .82, .095, .18, glow);
  }
  box(scene, 0, 4.93, -.8, 13, .23, 8, high);
  function crate(x, y, z, w, h, d) {
    panel(scene, x, y + h * .5, z, w, h, d, deep, .095);
    panel(
      scene,
      x,
      y + h * .5,
      z + d * .475,
      w * .76,
      h * .67,
      d * .088,
      inset,
      .09,
    );
    box(scene, x, y + h * .5, z + d * .523, w * .57, h * .36, .02, blueMetal);
    for (const side of [-1, 1]) {
      box(
        scene,
        x + side * w * .38,
        y + h * .51,
        z,
        .10,
        h * .96,
        d * 1.015,
        high,
      );
      for (const cy of [.116, .885]) {
        box(
          scene,
          x + side * w * .434,
          y + h * cy,
          z + d * .474,
          w * .114,
          h * .146,
          .11,
          glow,
        );
      }
    }
    box(scene, x, y + h * .92, z, w * .99, .066, d * 1.015, high);
    label(
      scene,
      "⊕",
      x,
      y + h * .49,
      z + d * .537,
      w * .46,
      h * .63,
      "#b1cbea",
      "bold 126px Arial",
    );
  }
  crate(-3.75, 0, -3.76, 1.9, .98, .91);
  crate(3.96, 0, -2.97, 1.89, 1.02, 1.06);
  crate(4.24, 1.023, -3.12, 1.27, .69, .79);
  const rack = group(scene, -4.31, 2.22, -4.22);
  panel(rack, 0, 0, 0, 2.46, 1.55, .16, deep);
  panel(rack, 0, 0, .09, 2.29, 1.38, .05, high);
  for (const side of [-1, 1]) {
    box(rack, side * .544, .806, .10, .83, .053, .08, glow);
  }
  const displayed = rifle(rack, false);
  displayed.position.set(-.19, -.025, .238);
  displayed.scale.setScalar(1.16);
  displayed.rotation.z = .09;
  for (let i = 0; i < 4; i++) {
    box(rack, -.98 + i * .595, -.44, .145, .20, .04, .04, deep);
  }
  const flag = group(scene, -2.99, 3.34, -3.98);
  panel(flag, 0, 0, 0, .51, 1.37, .03, "#c93442");
  label(flag, "⊕", 0, .04, .022, .49, .53, "#fff4c8", "bold 143px Arial");
  box(flag, 0, -.588, .02, .49, .048, .02, glow);
  rod(flag, [-.35, .70, 0], [.35, .70, 0], .035, deep);
  // Two-tone tiles stay aligned across every face of an arena module.
  function tiled(x, y, z, w, h, d, a, b) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        for (let k = 0; k < d; k++) {
          box(
            scene,
            x + i * .79,
            y + j * .79,
            z + k * .79,
            .791,
            .791,
            .791,
            (i + j + k) % 2 ? a : b,
          );
        }
      }
    }
  }
  tiled(-3.69, .37, -10, 4, 3, 1, "#559fff", "#77b6ff");
  tiled(.48, .37, -9.03, 3, 2, 1, "#fc869e", "#efa0b7");
  tiled(2.8, .37, -11.51, 1, 5, 1, "#83ce35", "#abd94a");
  tiled(3.59, 3.53, -11.51, 3, 1, 1, "#83ce35", "#abd94a");
  tiled(5.96, .37, -11.51, 1, 5, 1, "#83ce35", "#abd94a");
  tiled(-.96, 2.74, -15.26, 4, 2, 1, "#a3d1ff", "#75b1ef");
  box(scene, 0, -.09, -13, 34, .15, 18, "#a9c7e7");
  for (
    const [x, y, z] of [[-3.3, 5.5, -17.5], [4.7, 5.2, -17], [-1, 4.4, -18]]
  ) {
    for (let i = -1; i <= 1; i++) {
      const cloud = part(
        scene,
        new T.SphereGeometry(1, 12, 8),
        "#f4fbff",
        x + i * .48,
        y + (i === 0 ? .12 : 0),
        z,
      );
      cloud.scale.set(.70, i === 0 ? .33 : .23, .44);
      cloud.castShadow = false;
    }
  }
  const platform = part(
    scene,
    new T.CylinderGeometry(1.30, 1.36, .063, 64),
    material("#607ea9", .22, .49),
    .18,
    .015,
    .16,
  );
  for (const [radius, width, mat] of [[1.21, .023, glow], [1.27, .007, high]]) {
    const ring = part(
      scene,
      new T.TorusGeometry(radius, width, 6, 96),
      mat,
      .18,
      .052,
      .16,
    );
    ring.rotation.x = -Math.PI / 2;
  }
  return platform;
}

export function createLobby(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  scene.background = new T.Color("#66c7ff");
  scene.fog = new T.Fog("#afd9f4", 12, 29);
  scene.add(new T.HemisphereLight("#f2f7ff", "#96b4e0", 1.83));
  const sun = new T.DirectionalLight("#ffecd2", 2.8);
  sun.position.set(-3.7, 6, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -5,
    right: 5,
    bottom: -4,
    top: 5,
    near: .2,
    far: 16,
  });
  sun.shadow.normalBias = .012;
  sun.shadow.bias = -.00017;
  scene.add(sun);
  const rim = new T.DirectionalLight("#8edfff", 1.72);
  rim.position.set(2.3, 3, -2.9);
  scene.add(rim);
  buildBay(scene);
  const operator = buildOperator(scene);
  operator.root.position.y = .04;
  const camera = new T.PerspectiveCamera(35, 1, .03, 72);
  const frameSize = new T.Vector2();
  let active = false,
    animation = 0,
    time = 0,
    lastTime = 0,
    rotation = .12,
    drag = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    renderer.getSize(frameSize);
    if (w !== frameSize.x || h !== frameSize.y) renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(.33, 1.62, 5.03);
    camera.lookAt(.08, 1.44, 0);
    if (w / h > 1.1) {
      // Reserve the right side of the loadout view for the equipment pane.
      camera.setViewOffset(w, h, w * .10, 0, w, h);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    return true;
  }
  function draw(stamp) {
    if (!active) return;
    time += Math.min(.06, (stamp - lastTime) * .001);
    lastTime = stamp;
    if (resize()) {
      const motion = reduced.matches ? 0 : 1;
      operator.root.rotation.y = rotation +
        Math.sin(time * .35) * .022 * motion;
      operator.chest.rotation.z = Math.sin(time * 1.1) * .008 * motion;
      operator.chest.position.y = 1.485 + Math.sin(time * 1.65) * .006 * motion;
      operator.head.rotation.y = .12 + Math.sin(time * .54) * .084 * motion;
      renderer.render(scene, camera);
    }
    animation = requestAnimationFrame(draw);
  }
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (e) => {
    if (!active || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    rotation += (e.clientX - drag.x) * .011;
    drag.x = e.clientX;
  });
  function endDrag() {
    drag = null;
    canvas.style.cursor = "grab";
  }
  canvas.addEventListener("lostpointercapture", endDrag);
  return {
    setSkin(name) {
      const colors = {
        cobalt: ["#1159d8", "#2694f9"],
        ember: ["#d34722", "#fca43b"],
        lime: ["#69be2d", "#acdf4a"],
      };
      const gear = typeof name === "string" ? { clothing: name } : name || {};
      applyOperatorGear(operator, gear);
      const [darkColor, lightColor] = colors[gear.clothing] || colors.cobalt;
      operator.paint.color.set(darkColor);
      operator.accent.color.set(lightColor);
      operator.stock.color.set(
        ({ prism: "#b957fa", glacier: "#58caff" })[gear.skins] || "#ff9a19",
      );
      operator.visor.color.set(
        ({ blaze: "#ff9a24", violet: "#d080fb" })[gear.accessories] ||
          "#11dfff",
      );
    },
    setActive(next) {
      if (active === Boolean(next)) return;
      active = Boolean(next);
      if (active) {
        lastTime = performance.now();
        animation = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(animation);
        endDrag();
      }
    },
  };
}
