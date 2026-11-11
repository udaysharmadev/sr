import * as T from './vendor/three.module.js';

// Merge direct static children by material; animated groups remain independent.
export function batchStaticMeshes(root, exclude = null) {
  const groups = new Map();
  for (const item of [...root.children]) {
    if (!item.isMesh || item === exclude || Array.isArray(item.material)) continue;
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
