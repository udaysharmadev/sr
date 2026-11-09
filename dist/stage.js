import { updateWardrobeEffects } from './wardrobe-effects.js';
import {CATALOG} from './catalog.js';
import { updateRifleSkinEffects } from './rifle-skin-effects.js';
import { lobbyCameraDistance } from "./presentation.js";
import { studioEnvironment } from "./lighting.js";
import * as T from "./vendor/three.module.js";
import { applyOperatorGear, buildOperator } from "./lobby.js";
import { rifle, setRifleFinish } from "./rifle-models.js";
import { renderQuality } from "./quality.js";

export function ownResources(root) {
  const geometries = new Map(), materials = new Map(), textures = new Map();
  root.traverse((object) => {
    if (object.geometry) {
      if (!geometries.has(object.geometry)) {
        geometries.set(object.geometry, object.geometry.clone());
      }
      object.geometry = geometries.get(object.geometry);
    }
    if (object.material) {
      const copy = (mat) => {
        if (!materials.has(mat)) {
          const clone = mat.clone();
          for (const key of ["map", "bumpMap", "normalMap", "roughnessMap"]) if (clone[key]) {
            if (!textures.has(clone[key])) { const own = clone[key].clone(); own.needsUpdate = true; textures.set(clone[key], own); }
            clone[key] = textures.get(clone[key]);
          }
          materials.set(mat, clone);
        }
        return materials.get(mat);
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(copy)
        : copy(object.material);
    }
  });
  return { geometries, materials };
}
function releaseObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const mat of [].concat(object.material)) materials.add(mat);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    for (const key of ["map", "bumpMap", "normalMap", "roughnessMap"]) if (m[key]) textures.add(m[key]);
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
}

function buildTrainingRoom(scene) {
  scene.background = new T.Color("#b6b9a5");
  scene.fog = new T.Fog("#b6b9a5", 18, 38);
  const concrete = new T.MeshStandardMaterial({
    color: "#747d67",
    roughness: .95,
  });
  const wall = new T.MeshStandardMaterial({ color: "#929b80", roughness: .96 });
  const frame = new T.MeshStandardMaterial({ color: "#4b5b41", roughness: .8 });
  const floor = new T.MeshStandardMaterial({ color: "#717e60", roughness: 1 });
  const dark = new T.MeshStandardMaterial({ color: "#3f4f34", roughness: .84 });
  const wood = new T.MeshStandardMaterial({ color: "#746f5c", roughness: .9 });
  function block(x, y, z, w, h, d, material) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  block(0, -.09, 0, 32, .16, 32, floor);
  block(-2, 3, -4.5, 10, 6, .24, wall);
  block(6.15, 3, -4.5, 2.3, 6, .24, wall);
  block(4, 5.15, -4.5, 2, 1.7, .24, wall);
  block(-7, 3, 0, .22, 6, 12, concrete);
  block(7.3, 3, 0, .22, 6, 12, concrete);
  // A single open courtyard doorway admits soft daylight.
  block(2.96, 2.18, -4.32, .12, 4.36, .35, frame);
  block(5.04, 2.18, -4.32, .12, 4.36, .35, frame);
  block(4, 4.35, -4.32, 2.20, .12, .35, frame);
  block(
    4,
    2.7,
    -8,
    6,
    6,
    .1,
    new T.MeshBasicMaterial({ color: "#d3d7bb", toneMapped: false }),
  );
  block(
    4,
    -.04,
    -6,
    4,
    .12,
    5,
    new T.MeshStandardMaterial({ color: "#7f927f", roughness: 1 }),
  );
  block(
    4,
    .36,
    -7.4,
    3.4,
    .72,
    .22,
    new T.MeshStandardMaterial({ color: "#a7aaa1", roughness: .95 }),
  );
  // One low equipment bench and a recessed rack keep the bay recognizable.
  block(-3.7, .57, -3.45, 2.6, .14, .72, wood);
  for (const x of [-4.7, -2.7]) block(x, .26, -3.45, .11, .52, .54, frame);
  block(-3.7, 2.24, -4.26, 2.6, 1.54, .12, dark);
  for (const x of [-4.72, -2.68]) {
    block(x, 2.24, -4.16, .035, 1.20, .025, concrete);
  }
  const display = rifle(scene, "sunbolt", false);
  display.position.set(-3.65, 2.30, -3.99);
  display.scale.setScalar(.72);
  display.rotation.y = -Math.PI / 2;
  block(-3.95, .83, -3.45, .62, .38, .42, dark);
  // Broad wall joints give scale without a repeated tile or checker texture.
  for (const x of [-5, -.5]) block(x, 3, -4.355, .022, 6, .008, concrete);
  block(-2, .12, -4.34, 10, .16, .12, frame);
}

async function characterScene(canvas, settings, getGear, preview) {
  const quality = renderQuality(settings.quality, devicePixelRatio);
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: quality.antialias,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  const focus = preview && settings.previewFocus;
  const aimHeight = preview ? focus==='accessories' ? 2.60 : focus==='shoes' ? .35 : 1.50 : 1.30;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(35, 16 / 9, .03, 50);
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.add(new T.HemisphereLight(0xfff4d9, 0x737e58, 2.2));
  const key = new T.DirectionalLight(0xffe9ce, 3.1);
  key.position.set(-3.5, 6.5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  key.shadow.normalBias = .025;
  Object.assign(key.shadow.camera, {
    left: -3,
    right: 3,
    top: 4,
    bottom: -2,
    near: .1,
    far: 15,
  });
  scene.add(key);
  const rim = new T.DirectionalLight(0xdce7ad, 2.0);
  rim.position.set(3, 4, -2);
  scene.add(rim);
  const fill = new T.DirectionalLight(0xe2e8bd, .7);
  fill.position.set(2, 1, 4);
  scene.add(fill);
  const actor = buildOperator(scene);
  actor.root.position.set(0, .025, 0);
  actor.root.rotation.y = -.12;
  // The operator's shared templates are copied once so disposing a shop preview
  // cannot release geometry or materials used by the persistent lobby.
  const original = ownResources(actor.root);
  for (
    const name of [
      "paint",
      "accent",
      "suit",
      "pants",
      "shoeUpper",
      "shoeAccent",
      "visor",
      "stock",
    ]
  ) {
    actor[name] = original.materials.get(actor[name]) || actor[name];
  }
  actor.gun.visible = false;
  let heldGun = null, heldId = "";
  const floor = new T.Mesh(
    new T.PlaneGeometry(7, 7),
    new T.ShadowMaterial({ color: 0x101d3b, opacity: .3 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.y = .013;
  floor.visible = preview;
  scene.add(floor);
  if (!preview) buildTrainingRoom(scene);
  let active = true,
    disposed = false,
    frame = 0,
    last = 0,
    width = 0,
    height = 0,
    time = 0,
    tx = 0,
    ty = 0,
    rotation = -.12,
    drag = null;
  const abort = new AbortController();
  if (preview) {
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = event.clientX;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {}
    }, { signal: abort.signal });
    canvas.addEventListener("pointermove", (event) => {
      if (drag === null) return;
      rotation += (event.clientX - drag) * .011;
      drag = event.clientX;
    }, { signal: abort.signal });
    for (const event of ["pointerup", "lostpointercapture"]) {
      canvas.addEventListener(event, () => drag = null, {
        signal: abort.signal,
      });
    }
  } else {
    window.addEventListener("pointermove", (event) => {
      tx = (event.clientX / innerWidth - .5) * .07;
      ty = (.5 - event.clientY / innerHeight) * .025;
    }, { signal: abort.signal });
  }
  function updateRifle(id) {
    if(preview) { for(const arm of actor.arms){arm.root.rotation.x=.85;arm.root.rotation.z=arm.side*.1;}return; }
    id ||= "sunbolt";
    const finish = (getGear() || {}).finishes?.[id];
    if (heldId === id + "/" + finish) return;
    heldId = id + "/" + finish;
    if (heldGun) {
      heldGun.removeFromParent();
      releaseObject(heldGun);
    }
    heldGun = rifle(actor.chest, id, false);
    setRifleFinish(heldGun, finish);
    heldGun.position.set(-.05, .39, .36);
    heldGun.scale.setScalar(.84);
    heldGun.rotation.set(.02, -Math.PI / 2, -.245);
    heldGun.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the same full body frame at the small game embed sizes.
      camera.fov = 35;
      camera.updateProjectionMatrix();
      const distance = focus==='accessories' ? Math.max(3.1,1.4/camera.aspect) : focus==='shoes' ? Math.max(2.7,1.4/camera.aspect) : lobbyCameraDistance(camera.aspect, preview);
      camera.position.set(0, aimHeight, distance);
    }
    return true;
  }
  function draw(stamp) {
    if (!active || disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || stamp - last < 1000 / 40) return;
    const dt = Math.min(.06, (stamp - last) / 1000 || 0);
    last = stamp;
    if (!resize()) return;
    const motion = settings.reducedMotion ? 0 : 1;
    time += dt * motion;
    const gear = getGear() || {};
    applyOperatorGear(actor, gear);
    updateRifle(gear.skins);
    actor.root.rotation.y = rotation + Math.sin(time * .4) * .018;
    actor.chest.position.y = 1.485 + Math.sin(time * 1.65) * .005;
    actor.chest.rotation.z = Math.sin(time * 1.1) * .006;
    actor.head.rotation.y = .16 + Math.sin(time * .52) * .065;
    if (!preview) {
      camera.position.x += (tx * motion - camera.position.x) * .1;
      camera.position.y += (aimHeight + ty * motion - camera.position.y) * .1;
    }
    camera.lookAt(0, aimHeight, 0);
    updateRifleSkinEffects(heldGun,stamp,settings);
    updateWardrobeEffects(actor.root,stamp,settings);
    renderer.render(scene, camera);
  }
  applyOperatorGear(actor, getGear() || {});
  updateRifle((getGear() || {}).skins);
  if (!resize()) {
    abort.abort();
    releaseObject(scene);
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    throw Error("Training bay has no render area");
  }
  camera.lookAt(0, aimHeight, 0);
  renderer.render(scene, camera);
  frame = requestAnimationFrame(draw);
  const portraitCache = new Map();
  return {
    portrait(override = null) {
      if (disposed) return "";
      const original = getGear() || {}, gear = override || original, signature = JSON.stringify(gear);
      if (portraitCache.has(signature)) return portraitCache.get(signature);
      applyOperatorGear(actor, gear); updateRifle(gear.skins);
      updateWardrobeEffects(actor.root,performance.now(),settings);
      const target = new T.WebGLRenderTarget(256, 256), previous = renderer.getRenderTarget();
      target.texture.colorSpace = T.SRGBColorSpace;
      const hidden = scene.children.filter((node) => node !== actor.root && !node.isLight);
      const visibility = hidden.map((node) => node.visible), background = scene.background;
      const photo = new T.PerspectiveCamera(28, 1, .03, 20);
      actor.root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(actor.head), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
      const distance = Math.max(size.x, size.y) * 1.4 / (2 * Math.tan(T.MathUtils.degToRad(14)));
      photo.position.set(center.x, center.y - .04, center.z + distance);
      photo.lookAt(center.x, center.y - .06, center.z);
      const pixels = new Uint8Array(256 * 256 * 4), canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      try {
        hidden.forEach((node) => node.visible = false); scene.background = new T.Color("#484b3f");
        renderer.setRenderTarget(target); renderer.render(scene, photo); renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
        const context = canvas.getContext("2d"), data = context.createImageData(256, 256);
        for (let y = 0; y < 256; y++) data.data.set(pixels.subarray(y * 1024, (y + 1) * 1024), (255 - y) * 1024);
        context.putImageData(data, 0, 0);
        const image = canvas.toDataURL("image/png");
        if (portraitCache.size >= 32) portraitCache.delete(portraitCache.keys().next().value);
        portraitCache.set(signature, image);
        return image;
      } finally {
        hidden.forEach((node, index) => node.visible = visibility[index]); scene.background = background;
        renderer.setRenderTarget(previous); target.dispose();
        if (override) { applyOperatorGear(actor, original); updateRifle(original.skins); }
      }
    },
    setQuality(value) {
      if (disposed) return;
      const next = renderQuality(value, devicePixelRatio);
      renderer.setPixelRatio(next.pixelRatio);
      renderer.shadowMap.enabled = next.shadows;
      key.shadow.mapSize.set(next.shadowSize, next.shadowSize);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      scene.traverse((node) => {
        for (const material of [].concat(node.material || [])) material.needsUpdate = true;
      });
      renderer.setSize(width, height, false);
    },
    setActive(value) {
      if (disposed || active === Boolean(value)) return;
      active = Boolean(value);
      cancelAnimationFrame(frame);
      if (active) {
        last = 0;
        frame = requestAnimationFrame(draw);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      cancelAnimationFrame(frame);
      abort.abort();
      releaseObject(scene);

      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export const createStage = (canvas, settings, getGear) =>
  characterScene(canvas, settings, getGear, false);

let gearImages;
export function characterThumbnails() {
  return gearImages ||= (async () => {
    const renderer = new T.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setSize(256,320);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,.8,.03,20);
    const environment=studioEnvironment(renderer);scene.environment=environment.texture;
    scene.add(new T.HemisphereLight(0xffffff,0x777866,2.4));
    const light=new T.DirectionalLight(0xfff2d9,3);light.position.set(-3,5,4);scene.add(light);
    const actor=buildOperator(scene),owned=ownResources(actor.root);
    for(const [key,value] of Object.entries(actor))if(value?.isMaterial)actor[key]=owned.materials.get(value)||value;
    actor.gun.visible=false;actor.root.rotation.y=-.15;
    for(const arm of actor.arms){arm.root.rotation.x=.85;arm.root.rotation.z=arm.side*.1;}
    const images={};
    try {
      const choices=Object.fromEntries(['clothing','accessories','shoes'].map(category=>[category,CATALOG[category].map(item=>item[0])]));
      for(const [category,ids] of Object.entries(choices))for(const id of ids) {
        await new Promise(requestAnimationFrame);
        applyOperatorGear(actor,{clothing:'cobalt',accessories:'sky',shoes:'runner',[category]:id});
        const head=category==='accessories',feet=category==='shoes',height=head?2.65:feet ? .22 : 1.43;
        camera.position.set(feet ? .45 : 0,height+(feet ? .5 : 0),head?3.4:feet?3:6.8);camera.lookAt(0,height,0);
        renderer.render(scene,camera);images[category+':'+id]=renderer.domElement.toDataURL('image/webp');
      }
      return images;
    } finally { releaseObject(actor.root);environment.dispose();renderer.dispose();renderer.forceContextLoss(); }
  })().catch(error=>{gearImages=null;throw error;});
}
export async function fillCharacterThumbnails(root) {
  try { const images=await characterThumbnails();for(const el of root.querySelectorAll('[data-character-thumb]'))el.src=images[el.dataset.characterThumb]; } catch {}
}
export const createCharacterPreview = (canvas, getGear, settings = {}) =>
  characterScene(
    canvas,
    { ...settings, reducedMotion: settings.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches },
    getGear,
    true,
  );
