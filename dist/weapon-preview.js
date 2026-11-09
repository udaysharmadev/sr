import { updateRifleSkinEffects } from './rifle-skin-effects.js';
import { studioEnvironment } from "./lighting.js";
import * as T from "./vendor/three.module.js";
import { rifle } from "./arena.js";
import { renderQuality } from "./quality.js";
import { WEAPONS } from "./weapons.js";
import { disposeRifle, setRifleFinish } from "./rifle-models.js";

let thumbnails;
export function rifleThumbnails() {
  return thumbnails ||= (async () => {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(384, 160); renderer.setPixelRatio(1);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 2.4, .01, 20);
    const environment = studioEnvironment(renderer); scene.environment = environment.texture;
    scene.add(new T.HemisphereLight(0xffffff, 0x718799, 3));
    const key = new T.DirectionalLight(0xffffff, 4); key.position.set(-2, 4, 3); scene.add(key);
    const images = {};
    try {
      for (const spec of WEAPONS) {
        await new Promise(requestAnimationFrame);
        const model = rifle(scene, spec.id, false);
        try {
          model.rotation.set(.08, -Math.PI / 2 + .16, -.07);
          const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
          model.position.sub(bounds.getCenter(new T.Vector3()));
          const tangent = Math.tan(T.MathUtils.degToRad(15));
          camera.position.set(0, 0, Math.max(size.y / (2 * tangent), size.x / (2 * tangent * camera.aspect)) * 1.12 + size.z / 2);
          camera.lookAt(0, 0, 0); renderer.render(scene, camera);
          images[spec.id] = renderer.domElement.toDataURL("image/webp");
        } finally { model.removeFromParent(); disposeRifle(model); }
      }
      return images;
    } finally { environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  })().catch((error) => { thumbnails = null; throw error; });
}

export async function fillRifleThumbnails(root) {
  try {
    const images = await rifleThumbnails();
    for (const image of root.querySelectorAll("img[data-rifle-thumb]")) image.src = images[image.dataset.rifleThumb];
  } catch {} // The main live rifle preview and selection remain usable.
}

export function createWeaponPreview(canvas, id, settings = {}) {
  const quality = renderQuality(settings.quality, devicePixelRatio);
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: quality.antialias,
  });
  renderer.setPixelRatio(quality.pixelRatio);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, .01, 20);
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.add(new T.HemisphereLight(0xffffff, 0x7f96ae, 3));
  const key = new T.DirectionalLight(0xffffff, 3);
  key.position.set(-2, 4, 3);
  scene.add(key);
  const fill = new T.DirectionalLight(0xcce9ff, 2.1);
  fill.position.set(3, 1.5, 4);
  scene.add(fill);
  const group = rifle(scene, id, false);
  setRifleFinish(group, settings.finishes?.[id]);
  group.rotation.set(.12, -1.17, -.08);
  const bounds = new T.Box3().setFromObject(group),
    center = bounds.getCenter(new T.Vector3()),
    size = bounds.getSize(new T.Vector3());
  group.position.sub(center);
  camera.position.set(0, .28, 3.2);
  camera.lookAt(0, .08, 0);
  let frame, last = 0, rotation = -1.17, drag = null, disposed = false;
  const resize = new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tangent = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(
      0,
      .05,
      Math.max(size.y / (2 * tangent), size.x / (2 * tangent * camera.aspect)) *
          1.2 + size.z * .5,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });
  resize.observe(canvas);
  const abort = new AbortController();
  canvas.addEventListener("pointerdown", (e) => {
    drag = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  }, { signal: abort.signal });
  canvas.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    rotation += (e.clientX - drag) * .012;
    drag = e.clientX;
  }, { signal: abort.signal });
  canvas.addEventListener("pointerup", () => drag = null, {
    signal: abort.signal,
  });
  canvas.addEventListener("lostpointercapture", () => drag = null, {
    signal: abort.signal,
  });
  function draw(t) {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || t - last < 1000 / 40) return;
    last = t;
    group.rotation.y = rotation;
    updateRifleSkinEffects(group,t,settings);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(draw);
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      abort.abort();
      resize.disconnect();
      disposeRifle(group);
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
