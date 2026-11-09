import * as T from './vendor/three.module.js';
import { buildArena } from './arena.js';
import { MAPS } from './maps.js';

// Render the actual playable arena, with no player, view weapon or HUD.
export function createMapPreview(canvas, id) {
  const map = MAPS.find(m => m.id === id) || MAPS[0];
  const renderer = new T.WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(66,1,.1,180);
  buildArena(scene,map,{shadows:false,shadowSize:256});
  camera.position.set(20,3.2,23); camera.lookAt(0,2,-3);
  const render = () => { const {width,height} = canvas.getBoundingClientRect(); if(!width||!height)return; renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera); };
  const observer = new ResizeObserver(render);observer.observe(canvas);render();
  return {dispose(){observer.disconnect();const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();renderer.dispose();}};
}

// Capture each actual arena once for voting; no weapon, player or HUD is rendered.
const thumbnailCache = new Map();
export function mapThumbnail(id) {
  if (thumbnailCache.has(id)) return thumbnailCache.get(id);
  const result = new Promise((resolve, reject) => setTimeout(() => {
    let renderer, scene;
    try {
      const map = MAPS.find(m => m.id === id);
      if (!map) throw new Error('Unknown arena');
      const canvas = document.createElement('canvas');
      renderer = new T.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
      renderer.setPixelRatio(1); renderer.setSize(640,400,false);
      scene = new T.Scene();
      buildArena(scene,map,{shadows:false,shadowSize:256});
      const camera = new T.PerspectiveCamera(66,640/400,.1,180);
      camera.position.set(20,3.2,23); camera.lookAt(0,2,-3);
      renderer.render(scene,camera);
      resolve(canvas.toDataURL('image/jpeg',.82));
    } catch(error) { thumbnailCache.delete(id); reject(error); }
    finally {
      if(scene){const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const resource of resources)resource.dispose();}
      if(renderer){renderer.dispose();renderer.forceContextLoss();}
    }
  },0));
  thumbnailCache.set(id,result);
  return result;
}
