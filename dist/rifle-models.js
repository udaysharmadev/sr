import {rifleSkinById} from './rifle-skins.js';
import { applyFabric } from "./surface-textures.js";
import * as T from "./vendor/three.module.js";
import { weaponById } from "./weapons.js";

function finishTexture(kind) {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 1471;
  const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let value = kind === "wood"
        ? 105 + Math.sin(y * .20 + Math.sin(x * .055) * 3) * 22 + random() * 14
        : 162 + random() * 28;
      if (kind === "camo") {
        value = 125 +
          Math.floor(
              (Math.sin(x * .13) + Math.cos(y * .19) + random() * .6) * 2,
            ) * 15;
      }
      data[i] = value;
      data[i + 1] = kind === "wood" ? value * .62 : value;
      data[i + 2] = kind === "wood" ? value * .34 : value;
      data[i + 3] = 255;
    }
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

const stockShapes = {
  classic: [
    [.60, .025],
    [.30, .045],
    [.12, -.02],
    [-.16, -.04],
    [-.57, -.04],
    [-.62, -.10],
    [-.16, -.125],
    [.10, -.15],
    [.22, -.12],
    [.34, -.18],
    [.60, -.19],
  ],
  arctic: [
    [.60, .035],
    [.23, .04],
    [.15, -.025],
    [-.59, -.025],
    [-.62, -.13],
    [-.08, -.16],
    [.13, -.245],
    [.25, -.25],
    [.27, -.15],
    [.60, -.17],
  ],
  heavy: [
    [.58, .045],
    [.30, .045],
    [.26, -.035],
    [.08, -.04],
    [.08, -.13],
    [.29, -.14],
    [.34, -.19],
    [.58, -.19],
  ],
  scout: [
    [.57, .035],
    [.31, .025],
    [.10, -.045],
    [-.53, -.045],
    [-.58, -.10],
    [-.18, -.13],
    [.09, -.16],
    [.20, -.13],
    [.34, -.20],
    [.57, -.20],
  ],
  bullpup: [
    [.59, .07],
    [.08, .06],
    [-.13, -.015],
    [-.51, -.015],
    [-.57, -.10],
    [-.24, -.14],
    [.06, -.12],
    [.17, -.23],
    [.27, -.23],
    [.28, -.15],
    [.59, -.18],
  ],
};

// All models use a shared eye/receiver alignment, with forward along negative Z.
export function rifle(parent, id = "sunbolt", showHands = true) {
  const spec = weaponById(id),
    type = spec.model || "classic",
    root = new T.Group();
  parent.add(root);
  const steel = new T.MeshStandardMaterial({
    color: 0x42494c,
    metalness: .78,
    roughness: .30,
    map: finishTexture("steel"),
  });
  const dark = new T.MeshStandardMaterial({
    color: 0x151c20,
    metalness: .42,
    roughness: .48,
  });
  const rubber = new T.MeshStandardMaterial({
    color: 0x111517,
    roughness: .94,
  });
  const silver = new T.MeshStandardMaterial({
    color: 0x9ba6a7,
    metalness: .82,
    roughness: .28,
  });
  const stock = new T.MeshStandardMaterial({
    color: spec.color,
    roughness: .74,
    map: finishTexture(
      type === "dragun" ? "wood" : type === "classic" ? "camo" : "polymer",
    ),
  });
  stock.name = "rifle-stock";
  steel.name = "rifle-steel";
  const wood = new T.MeshStandardMaterial({
    color: 0xc98d52,
    roughness: .58,
    map: finishTexture("wood"),
  });
  // Fine grip texture and shallow grain preserve the clean rifle silhouette.
  applyFabric(rubber, "rubber");
  stock.bumpMap = stock.map;
  stock.bumpScale = .004;
  wood.bumpMap = wood.map;
  wood.bumpScale = .006;
  steel.bumpMap = steel.map;
  steel.bumpScale = .001;
  const lens = new T.MeshPhysicalMaterial({
    color: 0x236b87,
    metalness: .65,
    roughness: .08,
    clearcoat: 1,
    clearcoatRoughness: .06,
  });
  const scopeMetal = new T.MeshStandardMaterial({
    color: 0x1b2429,
    metalness: .62,
    roughness: .34,
  });
  function mesh(geometry, mat, x = 0, y = 0, z = 0, owner = root) {
    const item = new T.Mesh(geometry, mat);
    item.position.set(x, y, z);
    item.castShadow = item.receiveShadow = true;
    owner.add(item);
    return item;
  }
  function box(x, y, z, w, h, d, mat = steel, owner = root) {
    return mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, owner);
  }
  function tube(x, y, z, r, len, mat = steel, r2 = r, owner = root) {
    const item = mesh(
      new T.CylinderGeometry(r, r2, len, 24),
      mat,
      x,
      y,
      z,
      owner,
    );
    item.rotation.x = Math.PI / 2;
    return item;
  }
  function rod(a, b, r, mat = steel, owner = root) {
    const delta = new T.Vector3(...b).sub(new T.Vector3(...a));
    const item = mesh(
      new T.CylinderGeometry(r, r, delta.length(), 12),
      mat,
      0,
      0,
      0,
      owner,
    );
    item.position.copy(
      new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5),
    );
    item.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return item;
  }
  function profile(points, width, mat, hole) {
    const shape = new T.Shape();
    points.forEach(([z, y], i) => i ? shape.lineTo(z, y) : shape.moveTo(z, y));
    shape.closePath();
    if (hole) {
      const cut = new T.Path();
      hole.forEach(([z, y], i) => i ? cut.lineTo(z, y) : cut.moveTo(z, y));
      cut.closePath();
      shape.holes.push(cut);
    }
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: .006,
      bevelThickness: .005,
    });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(width / 2, 0, 0);
    return mesh(geometry, mat);
  }
  function screw(x, y, z) {
    const s = mesh(
      new T.CylinderGeometry(.009, .009, .006, 10),
      silver,
      x,
      y,
      z,
    );
    s.rotation.z = Math.PI / 2;
    box(x + .004, y, z, .002, .002, .013, dark);
  }
  function rail(z, length, y = .105) {
    box(0, y, z, .067, .025, length, dark);
    for (let i = 0; i < Math.floor(length / .032); i++) {
      box(
        0,
        y + .019,
        z - length / 2 + .017 + i * .032,
        .085,
        .016,
        .012,
        steel,
      );
    }
  }
  function grip(z = .06) {
    const g = box(0, -.15, z, .073, .19, .095, rubber);
    g.rotation.x = -.27;
    for (let i = 0; i < 5; i++) {
      box(.038, -.10 - i * .022, z + .004, .004, .007, .074, steel);
    }
  }
  function trigger(z = .02) {
    rod([-.039, -.09, z - .045], [-.039, -.18, z - .045], .006);
    rod([-.039, -.18, z - .045], [-.039, -.18, z + .065], .006);
    rod([-.039, -.18, z + .065], [-.039, -.08, z + .065], .006);
    rod([0, -.08, z + .008], [0, -.137, z - .004], .004, silver);
  }
  function magazine(z, height = .16) {
    const mag = box(0, -.135 - height / 2, z, .075, height, .105, dark);
    mag.rotation.x = .07;
    for (let side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        box(side * .039, -.16 - i * .035, z, .003, .009, .082, steel);
      }
    }
  }
  function bipod(z) {
    box(0, -.11, z, .15, .045, .06, steel);
    for (const side of [-1, 1]) {
      rod([side * .06, -.11, z], [side * .16, -.34, z + .11], .011, steel);
      tube(side * .16, -.34, z + .11, .018, .045, rubber);
      rod([side * .07, -.13, z], [side * .11, -.25, z + .065], .006, silver);
    }
  }
  function ventHandguard(z, length, mat = stock) {
    profile(
      [[z + length / 2, .045], [z - length / 2, .045], [
        z - length / 2 - .025,
        -.08,
      ], [z + length / 2, -.12]],
      .11,
      mat,
    );
    for (const side of [-1, 1]) {
      for (let i = 0; i < Math.floor(length / .065); i++) {
        box(
          side * .061,
          -.025,
          z - length / 2 + .04 + i * .065,
          .006,
          .039,
          .037,
          dark,
        );
        screw(side * .065, -.085, z - length / 2 + .04 + i * .065);
      }
    }
  }
  const heavy = type === "heavy", barrelEnd = -1.35 * spec.barrel;
  // Machined receiver and free-floating steel barrel.
  if (type === "dragun") {
    profile(
      [[.13, .075], [-.43, .075], [-.47, -.045], [.1, -.075]],
      .097,
      steel,
    );
    tube(0, .082, -.15, .045, .50, dark);
    profile(
      [
        [.59, .03],
        [.28, .04],
        [.17, -.04],
        [.13, -.08],
        [.20, -.24],
        [.32, -.21],
        [.34, -.14],
        [.59, -.17],
      ],
      .09,
      wood,
      [[.31, -.08], [.49, -.08], [.49, -.13], [.34, -.15]],
    );
    ventHandguard(-.59, .37, wood);
    magazine(-.15, .25);
    grip(.11);
    trigger(.02);
    rod([0, .09, -.50], [0, .09, barrelEnd + .15], .013, dark);
  } else if (type === "chassis" || type === "competition") {
    box(0, -.045, -.20, .105, .11, .64, stock);
    tube(0, .035, -.17, .043, .48, steel);
    if(type==='competition') {
      tube(0,-.015,-.59,.075,.52,stock);
      for(const side of [-1,1])for(let i=0;i<6;i++)box(side*.073,-.005,-.79+i*.075,.008,.045,.043,dark);
      rod([-.06,.13,-.46],[-.06,.25,-.46],.015,steel);
      rod([-.06,.25,-.46],[-.06,.25,-.68],.015,steel);
      rod([-.06,.25,-.68],[-.06,.10,-.68],.015,steel);
      rod([0,-.10,.49],[0,-.34,.49],.013,steel);
      box(0,-.34,.49,.14,.025,.07,rubber);
    } else ventHandguard(-.57,.43,stock);
    grip(.08);
    trigger(.01);
    magazine(-.12, .15);
    rod([-.036, -.035, .16], [-.036, -.035, .53], .014, silver);
    rod([.036, -.035, .16], [.036, -.035, .53], .014, silver);
    profile(
      [[.54, .03], [.34, .03], [.34, -.045], [.52, -.045], [.52, -.16], [
        .59,
        -.16,
      ], [.59, .02]],
      .075,
      stock,
    );
    box(0, .047, .38, .105, .05, .24, rubber);
    box(0, -.08, .60, .12, .25, .032, rubber);
    box(.058, -.02, .18, .023, .13, .075, dark);
    screw(.074, .005, .18);
    screw(.074, -.053, .18);
    bipod(type==='competition'?-.82:-.65);
  } else if (type === "heavy") {
    profile(
      [[.22, .095], [-.60, .095], [-.71, -.03], [-.61, -.10], [.21, -.10]],
      .137,
      steel,
    );
    profile(stockShapes.heavy, .11, stock);
    grip(.12);
    trigger(.03);
    magazine(-.15, .20);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        box(side * .072, .018, -.57 + i * .075, .006, .042, .038, dark);
      }
    }
    box(0, .065, .42, .13, .065, .25, rubber);
    bipod(-.71);
  } else if (type === "bullpup") {
    profile(stockShapes.bullpup, .115, stock);
    box(0, .062, .15, .12, .06, .69, steel);
    ventHandguard(-.38, .31, stock);
    grip(-.14);
    trigger(-.23);
    magazine(.31, .18);
    box(0, .105, .34, .125, .045, .26, rubber);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        box(side * .06, .012, .14 + i * .06, .006, .027, .026, dark);
      }
    }
  } else {
    profile(
      stockShapes[type] || stockShapes.classic,
      type === "arctic" ? .125 : .108,
      stock,
      type === "arctic"
        ? [[.25, -.09], [.46, -.09], [.46, -.135], [.29, -.17]]
        : undefined,
    );
    tube(0, .033, -.16, .044, .45, steel);
    box(0, .045, -.01, .10, .065, .11, steel);
    if (type === "arctic") {
      grip(.16);
      magazine(-.12);
      box(0, .06, .43, .14, .055, .25, rubber);
      bipod(-.57);
    } else {
      trigger(.13);
      if (type === "scout") magazine(-.11, .12);
      box(0, .035, .43, .105, .035, .20, rubber);
    }
    for (const side of [-1, 1]) screw(side * .057, -.065, -.37);
  }
  box(0, -.075, .615, .13, .245, .033, rubber);
  const barrelStart = heavy ? -.67 : -.58;
  tube(
    0,
    .025,
    (barrelStart + barrelEnd) / 2,
    heavy ? .031 : .024,
    barrelStart - barrelEnd,
    steel,
    heavy ? .028 : .018,
  );
  tube(0, .025, barrelStart + .015, heavy ? .046 : .037, .07, dark);
  // Crown, muzzle bore and characteristic brakes/suppressors.
  if (type === "heavy") {
    box(0, .025, barrelEnd - .06, .11, .085, .17, steel);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        box(
          side * .057,
          .025,
          barrelEnd - .12 + i * .045,
          .004,
          .043,
          .024,
          dark,
        );
      }
    }
    tube(0, .025, barrelEnd - .15, .026, .004, rubber);
  } else if (type === "chassis") {
    tube(0, .025, barrelEnd - .10, .043, .26, dark);
    for (let i = 0; i < 4; i++) {
      tube(0, .025, barrelEnd - .20 + i * .065, .044, .008, steel);
    }
    tube(0, .025, barrelEnd - .232, .025, .006, rubber);
  } else {
    tube(0, .025, barrelEnd - .025, .03, .065, dark);
    tube(0, .025, barrelEnd - .061, .016, .006, rubber);
    if (type === "dragun") {
      tube(0, .026, barrelEnd - .065, .025, .11, steel);
      for (let i = 0; i < 4; i++) {
        box(.024, .025, barrelEnd - .10 + i * .022, .004, .026, .011, dark);
      }
    }
  }
  rail(
    type === "scout" ? -.40 : -.16,
    type === "heavy" ? .69 : type === "scout" ? .42 : .46,
  );
  // Scope objective bell, eyepiece, mounting rings and numbered adjustment turrets.
  const optic = type === "scout" ? .84 : type === "heavy" ? 1.1 : spec.scope;
  const oy = .215;
  for (const z of [-.32, -.075]) {
    box(0, .139, z, .078, .07, .042, steel);
    tube(0, oy, z, .063 * optic, .033, steel);
    tube(0, oy, z, .056 * optic, .037, rubber);
    for (const side of [-1, 1]) screw(side * .060 * optic, oy, z);
  }
  tube(0, oy, -.23, .046 * optic, .43, scopeMetal);
  tube(0, oy, -.48, .046 * optic, .16, scopeMetal, .087 * optic);
  tube(0, oy, -.571, .088 * optic, .026, rubber);
  tube(0, oy, -.585, .072 * optic, .006, lens);
  tube(0, oy, .006, .081 * optic, .19, scopeMetal, .046 * optic);
  tube(0, oy, .107, .084 * optic, .035, rubber);
  tube(0, oy, .128, .069 * optic, .006, lens);
  const reflection = mesh(
    new T.CircleGeometry(.040 * optic, 20),
    new T.MeshBasicMaterial({
      color: 0x80b8c4,
      transparent: true,
      opacity: .48,
    }),
    -.021 * optic,
    oy + .023 * optic,
    .133,
  );
  reflection.scale.set(.65, .19, 1);
  reflection.rotation.z = .50;
  for (let i = 0; i < 14; i++) {
    tube(0, oy, .025 + i * .004, .065 * optic, .0018, steel);
  }
  mesh(
    new T.CylinderGeometry(.032, .032, .047, 24),
    scopeMetal,
    0,
    oy + .065,
    -.22,
  );
  mesh(
    new T.CylinderGeometry(.035, .035, .016, 24),
    rubber,
    0,
    oy + .094,
    -.22,
  );
  const windage = mesh(
    new T.CylinderGeometry(.030, .030, .055, 24),
    scopeMetal,
    .063,
    oy,
    -.22,
  );
  windage.rotation.z = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    box(
      Math.sin(angle) * .028,
      oy + .106,
      -.22 + Math.cos(angle) * .028,
      .003,
      .002,
      .006,
      silver,
    );
  }
  // Ejection port, fasteners and operating bolt remain at the gameplay animation anchor.
  box(.056, .042, -.145, .003, .035, .13, rubber);
  const bolt = new T.Group();
  root.add(bolt);
  bolt.position.set(.055, .065, -.06);
  rod([0, 0, 0], [.067, -.04, .025], .009, silver, bolt);
  mesh(new T.SphereGeometry(.021, 12, 10), rubber, .070, -.044, .027, bolt);
  for (const z of [-.30, -.03, .18]) screw(.058, -.005, z);
  const flash = mesh(
    new T.ConeGeometry(.045, .17, 6),
    new T.MeshBasicMaterial({
      color: 0xffe7b0,
      transparent: true,
      opacity: .8,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
    0,
    .025,
    barrelEnd - (type === "chassis" ? .32 : .2),
  );
  flash.rotation.x = -Math.PI / 2;
  flash.visible = false;
  if (showHands) {
    const glove = new T.MeshStandardMaterial({
      color: 0x273433,
      roughness: .92,
    });
    const sleeve = new T.MeshStandardMaterial({
      color: 0x3a4c55,
      roughness: .88,
    });
    rod([-.18, -.42, -.14], [-.07, -.10, -.54], .070, sleeve);
    box(-.045, -.10, -.52, .12, .10, .16, glove);
    for (let i = 0; i < 4; i++) {
      box(-.085 + i * .023, -.048, -.52, .018, .027, .13, glove);
    }
    rod([.14, -.40, .30], [.045, -.17, .09], .070, sleeve);
    box(.035, -.14, .08, .09, .12, .115, glove);
  }
  flash.name = "muzzle-flash";
  // Scene-node references must not be JSON-serialized when a corpse clones a rifle.
  Object.defineProperties(root.userData, {
    bolt: { value: bolt }, flash: { value: flash },
  });
  if (!showHands) batchStaticRifle(root, flash);
  return root;
}

// Remote rifles retain the full silhouette with one draw per static material.
// The operating bolt and flash keep their independent animation anchors.
function batchStaticRifle(root, flash) {
  const groups = new Map();
  for (const item of [...root.children]) {
    if (!item.isMesh || item === flash || Array.isArray(item.material)) continue;
    item.updateMatrix();
    const geometry = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
    geometry.applyMatrix4(item.matrix);
    if (!groups.has(item.material)) groups.set(item.material, []);
    groups.get(item.material).push(geometry);
    item.removeFromParent();
    item.geometry.dispose();
  }
  for (const [mat, sources] of groups) {
    const geometry = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const size = sources[0].getAttribute(name).itemSize;
      const data = new Float32Array(sources.reduce((total, source) => total + source.getAttribute(name).array.length, 0));
      let offset = 0;
      for (const source of sources) { const values=source.getAttribute(name).array;data.set(values,offset);offset+=values.length; }
      geometry.setAttribute(name,new T.BufferAttribute(data,size));
    }
    const item = new T.Mesh(geometry,mat);
    item.castShadow = item.receiveShadow = true;
    root.add(item);
    for (const source of sources) source.dispose();
  }
}

export function disposeRifle(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      if (material.map) textures.add(material.map);
      if(material._rushFieldMap)textures.add(material._rushFieldMap);
      if (material.bumpMap) textures.add(material.bumpMap);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}

const premiumFinishes = ['ember-drake', 'ivory-relic', 'carbon-circuit'];
function collectionTexture(skin) {
  const size=96,data=new Uint8Array(size*size*4),colors=skin.colors.map(c=>new T.Color(c));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=skin.variant,xx=x+v*7,yy=y+v*11;
    const n=skin.family==='fire'?Math.sin(xx*.19+Math.sin(yy*.11)*3)+Math.cos(yy*.17):skin.family==='frost'?Math.sin((xx+yy)*.15)+Math.cos((xx-yy)*.21):skin.family==='arc'?xx%(13+v)===0||yy%(19+v)===0?2:-1:skin.family==='void'?Math.sin(xx*.09+yy*.2)*Math.cos(yy*.1-xx*.14):Math.sin(xx*.23)*Math.sin(yy*.18)+Math.cos((xx+yy)*.12);
    const color=colors[n>1?2:n>.1?1:0].clone().convertLinearToSRGB(),i=(y*size+x)*4;
    data[i]=Math.round(color.r*255);data[i+1]=Math.round(color.g*255);data[i+2]=Math.round(color.b*255);data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.needsUpdate=true;return texture;
}
function wrapTexture(finish) {
  const collection=rifleSkinById(finish);if(collection)return collectionTexture(collection);
  const size=64,data=new Uint8Array(size*size*4);
  const palettes={
    digital:[[44,57,35],[92,106,64],[145,145,95],[29,38,27]],
    tiger:[[187,129,52],[38,34,29],[224,180,87],[69,61,44]],
    alpine:[[218,226,222],[114,139,147],[60,79,88],[166,188,190]],
    'ember-drake':[[29,25,26],[89,33,24],[195,69,25],[226,150,61]],
    'ivory-relic':[[231,222,193],[190,174,132],[112,96,64],[247,242,222]],
    'carbon-circuit':[[19,28,33],[34,46,50],[42,143,151],[100,221,216]],
  },colors=palettes[finish]||palettes.digital;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let index;
    if(finish==='digital')index=(Math.floor(x/7)*13^Math.floor(y/5)*23)%4;
    else if(finish==='tiger')index=Math.floor((x+y*.65+Math.sin(y*.3)*6)/6)%4;
    else if(finish==='ember-drake')index=(x+Math.floor(y/8)%2*6)%12<2?2:Math.floor(y/8)%3===0?1:0;
    else if(finish==='ivory-relic')index=Math.abs(Math.sin(x*.13+y*.17+Math.sin(y*.2)))>.94?2:(Math.floor(x/16)+Math.floor(y/16))%2?0:3;
    else if(finish==='carbon-circuit')index=x%19===0||y%23===0&&x%19<11?3:(Math.floor(x/3)+Math.floor(y/3))%2;
    else index=Math.abs(Math.floor((x+y*.8)/13)+Math.floor((x-y)/9))%4;
    const i=(y*size+x)*4;data.set([...colors[index],255],i);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.needsUpdate=true;return texture;
}
function decorateCollection(root,skin) {
  const group=new T.Group();group.name='rifle-skin-decoration';root.add(group);
  const v=skin.variant,sideOffset=.073+v*.0015,front=-.35-v*.017;
  const metal=new T.MeshStandardMaterial({color:skin.colors[1],metalness:.76,roughness:.32});
  const accent=new T.MeshStandardMaterial({color:skin.colors[2],metalness:.45,roughness:.28,emissive:skin.colors[2],emissiveIntensity:.16});
  const dark=new T.MeshStandardMaterial({color:skin.colors[0],metalness:.63,roughness:.43});
  const put=(g,m,x,y,z)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
  const plate=(w,h,d,m,x,y,z)=>put(new T.BoxGeometry(w,h,d),m,x,y,z);
  // The eight authored receiver treatments use different member counts, spacing,
  // handed offsets, relief shapes and rear armor; not a tint over a common mesh.
  if(skin.family==='fire'){
    for(const side of [-1,1])for(let i=0;i<3+v%4;i++){
      const blade=put(new T.ConeGeometry(.026+v*.001,.12+(v%3)*.02,3),i%2?metal:accent,side*sideOffset,.017,front-i*(.09-v*.003));blade.rotation.z=side*1.12;blade.rotation.x=.5+v*.09;
    }
    for(let i=0;i<3+Math.floor(v/2);i++){const fin=plate(.018,.055+(i%3)*.013,.09,dark,0,.103,-.50-i*.09);fin.rotation.x=-.35-v*.06;}
    const rear=plate(.12,.045,.20+v*.014,metal,0,-.073,.37);rear.rotation.z=(v-3)*.025;
  }else if(skin.family==='frost'){
    for(const side of [-1,1])for(let i=0;i<3+v%3;i++){
      const crystal=put(new T.OctahedronGeometry(.047+v*.0018,0),i%2?metal:accent,side*sideOffset,.015,front-i*.11);crystal.scale.set(.4,1+(i%2)*.4,1.55);crystal.rotation.z=side*(.2+v*.055);
    }
    for(let i=0;i<2+v%4;i++){const collar=put(new T.TorusGeometry(.048,.008,4,6+v),accent,0,.215,-.40+i*.075);collar.rotation.z=v*.11;}
    plate(.12,.032,.18+v*.015,dark,0,-.09,.37);
  }else if(skin.family==='arc'){
    for(const side of [-1,1]){
      for(let i=0;i<2+v%3;i++)plate(.023,.087,.12,dark,side*sideOffset,-.015,front-i*.16);
      for(let i=0;i<4+v;i++)plate(.009,.016,.027,accent,side*(sideOffset+.015),.015,front+.04-i*.057);
    }
    for(let i=0;i<3+v%4;i++){const coil=put(new T.TorusGeometry(.049,.005,4,12+v*2),metal,0,.025,-.69-i*.045);coil.rotation.z=i*.2;}
    plate(.10,.019,.26+v*.011,accent,0,-.083,.32);
  }else if(skin.family==='void'){
    for(const side of [-1,1])for(let i=0;i<3+v%4;i++){
      const guard=plate(.021,.071+v*.003,.09,dark,side*(sideOffset+.008),-.014,front-i*.093);guard.rotation.z=side*.37;guard.rotation.x=(i%2?1:-1)*.17;
      const shard=put(new T.TetrahedronGeometry(.035+v*.001),accent,side*(sideOffset+.017),.035,front-i*.093);shard.rotation.y=i*.7+v*.13;shard.scale.set(.3,1,1.7);
    }
    for(let i=0;i<2+v%3;i++){const halo=put(new T.TorusGeometry(.054,.005,3,8),metal,0,.215,-.39+i*.10);halo.rotation.z=i*.3+v*.13;}
    const tail=plate(.10,.035,.20+v*.015,metal,0,-.09,.38);tail.rotation.z=(v-3)*.035;
  }else{
    for(const side of [-1,1]){
      plate(.014,.09,.36+v*.018,metal,side*sideOffset,-.018,front-.07);
      for(let i=0;i<3+v%4;i++){
        const relief=put(v%2?new T.TorusGeometry(.019,.004,4,7+v):new T.OctahedronGeometry(.023),accent,side*(sideOffset+.012),-.012,front+.06-i*.073);relief.rotation.y=Math.PI/2;relief.rotation.z=i*.25;
      }
      plate(.015,.05,.18+v*.018,dark,side*sideOffset,-.09,.36);
    }
    for(let i=0;i<2+v%3;i++){const crown=put(new T.TorusGeometry(.054,.007,4,10+v),metal,0,.215,-.39+i*.115);crown.rotation.z=v*.09;}
    const emblem=put(new T.DodecahedronGeometry(.041,0),accent,0,.095,-.63-v*.012);emblem.scale.set(1,.4,1);
  }
}
function goldEngraving() {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const scroll=Math.sin(x*.15+Math.sin(y*.12)*2.8),weave=Math.sin((x+y)*.25)*Math.cos((x-y)*.25);
    const border=x%32<2||y%64<2,engraved=Math.abs(scroll)<.13||Math.abs(weave)<.07;
    const value=border?255:engraved?144:228+Math.round(Math.sin(x*.07+y*.11)*15),i=(y*size+x)*4;
    data.set([value,value,value,255],i);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.needsUpdate=true;return texture;
}
function decorateGold(root) {
  const group=new T.Group();group.name='rifle-skin-decoration';root.add(group);
  const gold=new T.MeshPhysicalMaterial({color:0xf3c555,metalness:.94,roughness:.18,clearcoat:.9,clearcoatRoughness:.12});
  const pale=new T.MeshStandardMaterial({color:0xffe7a3,metalness:.84,roughness:.24,emissive:0xb88b27,emissiveIntensity:.16});
  const obsidian=new T.MeshStandardMaterial({color:0x29211b,metalness:.8,roughness:.26});
  const put=(geometry,material,x,y,z)=>{const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
  for(const side of [-1,1]){
    put(new T.BoxGeometry(.016,.085,.46),gold,side*.077,-.015,-.39);
    for(let i=0;i<6;i++){
      const relief=put(new T.TorusGeometry(.022,.0045,5,12),pale,side*.089,-.014,-.57+i*.071);relief.rotation.y=Math.PI/2;
      const leaf=put(new T.OctahedronGeometry(.017),gold,side*.091,.018,-.57+i*.071);leaf.scale.set(.35,1.3,.75);leaf.rotation.x=i%2?.6:-.6;
    }
    put(new T.BoxGeometry(.014,.055,.25),gold,side*.075,-.085,.35);
    put(new T.BoxGeometry(.017,.014,.24),obsidian,side*.077,-.07,.35);
  }
  for(const z of [-.43,-.02]){
    put(new T.TorusGeometry(.061,.009,8,32),gold,0,.215,z);
    put(new T.TorusGeometry(.061,.003,6,32),pale,0,.215,z-.012);
  }
  put(new T.BoxGeometry(.11,.016,.15),gold,0,.092,-.56);
  for(let i=-1;i<=1;i++){
    const tip=put(new T.ConeGeometry(.018,i===0?.065:.043,4),pale,i*.035,.12+(i===0?.012:0),-.56);tip.rotation.z=-i*.22;
  }
  const jewel=put(new T.OctahedronGeometry(.021),pale,0,.114,-.67);jewel.scale.set(1,.6,1.3);
}
function decorateRifle(root, finish) {
  if(finish==='gold'){decorateGold(root);return;}
  const collection=rifleSkinById(finish);if(collection){decorateCollection(root,collection);return;}
  if(!premiumFinishes.includes(finish))return;
  const group=new T.Group();group.name='rifle-skin-decoration';root.add(group);
  const metal=new T.MeshStandardMaterial({color:finish==='ember-drake'?0xb65d31:finish==='ivory-relic'?0xc5a65c:0x273b43,metalness:.82,roughness:.28});
  const accent=new T.MeshStandardMaterial({color:finish==='ember-drake'?0xf18a39:finish==='ivory-relic'?0xf2ead5:0x64d9d4,metalness:.48,roughness:.31,
    emissive:finish==='carbon-circuit'?0x0c6663:0x000000,emissiveIntensity:.28});
  const add=(geometry,mat,x,y,z)=>{const item=new T.Mesh(geometry,mat);item.position.set(x,y,z);item.castShadow=item.receiveShadow=true;group.add(item);return item;};
  if(finish==='ember-drake'){
    // Offset overlapping scales leave the bolt, trigger and muzzle unobstructed.
    for(const side of [-1,1])for(let i=0;i<6;i++){
      const plate=add(new T.BoxGeometry(.018,.095,.105),i%3===0?accent:metal,side*.073,.003,-.35-i*.075);
      plate.rotation.x=-.22;plate.rotation.z=side*.12;
    }
    for(let i=0;i<5;i++){
      const ridge=add(new T.ConeGeometry(.037,.085,3),metal,0,.092,-.63-i*.10);ridge.rotation.x=-.38;
    }
    for(const side of [-1,1])add(new T.BoxGeometry(.012,.053,.22),accent,side*.072,-.068,.37);
  }else if(finish==='ivory-relic'){
    for(const side of [-1,1]){
      add(new T.BoxGeometry(.015,.09,.43),accent,side*.074,-.025,-.34);
      for(let i=0;i<5;i++){
        const relief=add(new T.TorusGeometry(.023,.004,4,8),metal,side*.086,-.02,-.5+i*.075);relief.rotation.y=Math.PI/2;
      }
      add(new T.BoxGeometry(.014,.06,.23),accent,side*.074,-.075,.35);
    }
    for(const z of [-.42,-.02]){
      const collar=add(new T.TorusGeometry(.059,.007,6,24),metal,0,.215,z);collar.rotation.z=Math.PI/8;
    }
    for(let i=0;i<4;i++)add(new T.BoxGeometry(.08,.012,.022),metal,0,.096,-.65-i*.07);
  }else{
    for(const side of [-1,1]){
      const cover=add(new T.BoxGeometry(.025,.10,.52),metal,side*.073,-.018,-.42);cover.rotation.z=side*.14;
      for(let i=0;i<4;i++)add(new T.BoxGeometry(.005,.014,.07),accent,side*.091,.004,-.61+i*.12);
      add(new T.BoxGeometry(.009,.018,.29),accent,side*.077,-.08,.34);
    }
    for(const z of [-.42,-.02]){
      const ring=add(new T.TorusGeometry(.058,.004,4,24),accent,0,.215,z);ring.rotation.z=Math.PI/4;
    }
    const hood=add(new T.CylinderGeometry(.065,.065,.17,6,1,true),metal,0,.025,-.98);hood.rotation.x=Math.PI/2;
  }
}
export function setRifleFinish(root, finish = "field") {
  if (root.userData.finish === finish) return;
  const previous=root.getObjectByName('rifle-skin-decoration');
  if(previous){previous.removeFromParent();disposeRifle(previous);}
  const seen = new Set();
  root.traverse((node) => {
    for (const mat of [].concat(node.material || [])) {
      if (seen.has(mat) || !["rifle-stock", "rifle-steel"].includes(mat.name)) continue;
      seen.add(mat);
      mat.userData.fieldFinish ||= { color: mat.color.getHex(), metalness: mat.metalness, roughness: mat.roughness };
      const field = mat.userData.fieldFinish;
      if(!Object.hasOwn(mat,'_rushFieldMap'))mat._rushFieldMap=mat.map;
      if(mat.map!==mat._rushFieldMap)mat.map?.dispose();
      const wrapped=['digital','tiger','alpine',...premiumFinishes].includes(finish)||!!rifleSkinById(finish);
      mat.map=finish==='gold'?goldEngraving():wrapped?wrapTexture(finish):mat._rushFieldMap;mat.needsUpdate=true;
      mat.color.setHex(wrapped ? 0xffffff : finish === "gold" ? mat.name === "rifle-stock" ? 0xffd56b : 0xe8b548 : field.color);
      mat.metalness = finish === "gold" ? .94 : field.metalness;
      mat.roughness = finish === "gold" ? .19 : field.roughness;
    }
  });
  decorateRifle(root,finish);
  root.userData.finish = finish;
  const collection=rifleSkinById(finish);
  root.userData.skinEffect=finish==='gold'?{type:'gold',family:'gold',kind:'gold',color:0xffd976,seed:17,finish:'gold'}:collection?{type:collection.family,family:collection.family,kind:collection.effect,color:collection.colors[2],colors:collection.colors,seed:collection.variant,finish:collection.id}:null;
}
