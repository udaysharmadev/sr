import * as T from "./vendor/three.module.js";

// Cache immutable CPU pixels. Each material owner gets its own GPU texture, so
// disposing a wardrobe preview cannot dispose the persistent lobby's texture.
const templates = new Map();
export function surfaceTexture(kind = "cloth", repeatX = 1, repeatY = 1) {
  const size = 128;
  if (!templates.has(kind)) {
    const pixels = new Uint8Array(size * size * 4);
    let seed = 4919;
    const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let shade = 246;
        if (kind === "cloth") {
          const weave = (x % 4 < 2) === (y % 4 < 2) ? 3 : -3;
          shade = 245 + weave + (random() - .5) * 4;
          // Double stitched edge and a faint folded seam.
          if (x === 6 || x === 10 || y === 6 || y === 10) {
            shade = (x + y) % 7 < 4 ? 211 : 238;
          }
          if (x === 3 || y === 3) shade = 229;
        } else if (kind === "leather") {
          shade = 239 + (random() - .5) * 13;
          if (x === 7 || x === 11) shade = y % 8 < 5 ? 200 : 236;
          if (y > 113 && y < 117) shade = 221;
        } else if (kind === "rubber") {
          shade = 236 + (random() - .5) * 7;
          if ((x + y) % 14 < 2) shade = 213;
        } else {
          const pore = random();
          shade = 246 + (random() - .5) * 7;
          if (pore > .985) shade = 224;
          if ((x * 3 + y * 5) % 107 === 0) shade = 235;
        }
        const i = (y * size + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = Math.max(
          0,
          Math.min(255, Math.round(shade)),
        );
        pixels[i + 3] = 255;
      }
    }
    templates.set(kind, pixels);
  }
  const texture = new T.DataTexture(
    templates.get(kind),
    size,
    size,
    T.RGBAFormat,
  );
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function applyFabric(material, kind = "cloth") {
  const texture = surfaceTexture(kind);
  material.map = texture;
  material.bumpMap = texture;
  material.bumpScale = kind === "cloth" ? .008 : .004;
  material.roughness = kind === "cloth" ? .88 : .76;
  material.needsUpdate = true;
  return material;
}
