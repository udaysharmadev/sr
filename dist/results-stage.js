import { updateWardrobeEffects } from './wardrobe-effects.js';
import { updateRifleSkinEffects } from './rifle-skin-effects.js';
import * as T from "./vendor/three.module.js";
import { buildArena } from "./arena.js";
import { buildOperator, applyOperatorGear } from "./lobby.js";
import { ownResources } from "./stage.js";
import { rifle, setRifleFinish } from "./rifle-models.js";
import { MAPS } from "./maps.js";
import { studioEnvironment } from "./lighting.js";
import { renderQuality } from "./quality.js";

export function animateVictory(model, place, seconds, reducedMotion = false) {
  const motion = reducedMotion ? 0 : Math.sin(seconds * 2.2 + place);
  for (const rest of model.userData.victoryRig || []) {
    const raised = place === 0 ? rest.x < 0 : rest.x > 0;
    rest.node.rotation.z = rest.z + (raised ? Math.sign(-rest.x) * (place === 0 ? 1.05 + motion * .06 : place === 1 ? .78 : .60 + motion * .18) : 0);
    rest.node.position.y = rest.y + (raised ? place === 0 ? .32 : place === 1 ? .20 : .15 : 0);
  }
}

export function animateLoadoutPose(actor, place, seconds, reducedMotion = false) {
  const breathe = reducedMotion ? 0 : Math.sin(seconds * 1.6 + place) * .012;
  actor.chest.rotation.z = (place === 0 ? -.045 : place % 2 ? .035 : -.025) + breathe;
  actor.head.rotation.y = place % 2 ? -.10 : .08;
  for (const arm of actor.arms) {
    arm.root.rotation.z = place === 0 ? (arm.side < 0 ? .72 : 0) : place === 2 ? arm.side * .12 : 0;
    arm.root.rotation.x = place === 0 && arm.side < 0 ? -.28 : 0;
  }
  const gun = actor.heldGun;
  if (place === 0) { gun.position.set(-.05, .39, .36); gun.rotation.set(.02, -Math.PI / 2, -.20); }
  else if (place === 2) { gun.position.set(.02, .28, .40); gun.rotation.set(.12, -1.35, -.55); }
  else { gun.position.set(-.05, .39, .36); gun.rotation.set(.02, -Math.PI / 2, place === 3 ? .12 : -.245); }
}

export function createResultsStage(canvas, players, settings = {}, arenaName, onLayout) {
  const quality = renderQuality(settings.quality, devicePixelRatio);
  const renderer = new T.WebGLRenderer({ canvas, antialias: quality.antialias });
  renderer.setPixelRatio(quality.pixelRatio); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, .05, 180);
  const map = MAPS.find(m => m.id === arenaName || m.name === arenaName) || MAPS[0];
  buildArena(scene, map, { ...quality, presentation: true });
  const environment = studioEnvironment(renderer); scene.environment = environment.texture;
  const light = new T.DirectionalLight(0xffefd5, 2); light.position.set(-3, 7, 28); scene.add(light);
  const actors = [], placements = [[0, 20.5], [-2.6, 19.2], [2.6, 19.2], [-5.1, 18.4], [5.1, 18.4]];
  players.slice(0, 5).forEach((player, place) => {
    const actor = buildOperator(scene), owned = ownResources(actor.root);
    for (const [name, value] of Object.entries(actor)) if (value?.isMaterial) actor[name] = owned.materials.get(value) || value;
    applyOperatorGear(actor, player.gear || {}); actor.gun.visible = false;
    actor.heldGun = rifle(actor.chest, player.weapon, false); actor.heldGun.scale.setScalar(.84); setRifleFinish(actor.heldGun, player.finish);
    const [x, z] = placements[place]; actor.root.position.set(x, 0, z); actor.root.rotation.y = place === 0 ? -.08 : place % 2 ? .16 : -.16;
    actor.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    animateLoadoutPose(actor, place, 0, settings.reducedMotion); actors.push({ actor, place });
  });
  let disposed = false, frame = 0, last = 0, revealAt = performance.now();
  function layout() {
    camera.updateMatrixWorld();
    onLayout?.(actors.map(({ actor, place }) => {
      const head = new T.Vector3(actor.root.position.x, 3.12, actor.root.position.z).project(camera);
      const feet = actor.root.position.clone().project(camera);
      return { place, x: (head.x + 1) * 50, top: Math.max(6, Math.min(25, (1 - head.y) * 50 - 22)), bottom: Math.max(3, Math.min(20, (feet.y + 1) * 50)) };
    }));
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const span = players.length > 3 ? 12.5 : players.length > 1 ? 7.6 : 3.4;
    const distance = Math.max(7.8, span / (2 * Math.tan(T.MathUtils.degToRad(17.5)) * camera.aspect));
    const center = players.length === 2 ? -1 : 0;
    camera.position.set(center, 2.5, 20 + distance); camera.lookAt(center, 1.63, 20); layout();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  function draw(t) {
    if (disposed) return; frame = requestAnimationFrame(draw);
    if (document.hidden || t - last < 1000 / 40) return; last = t;
    const time = (t - revealAt) / 1000;
    for (const { actor, place } of actors) {animateLoadoutPose(actor, place, time, settings.reducedMotion);updateRifleSkinEffects(actor.heldGun,t,settings);updateWardrobeEffects(actor.root,t,settings);}
    renderer.render(scene, camera);
  }
  renderer.render(scene, camera); frame = requestAnimationFrame(draw);
  return { dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    const geo = new Set(), mats = new Set(), textures = new Set();
    scene.traverse(node => { if (node.geometry) geo.add(node.geometry); for (const m of [].concat(node.material || [])) { mats.add(m); for (const key of ['map','bumpMap','normalMap','roughnessMap']) if (m[key]) textures.add(m[key]); } });
    geo.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
  } };
}
