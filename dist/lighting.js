import * as T from "./vendor/three.module.js";

// Broad sky illumination and narrow light panels reveal brushed steel surfaces.
export function studioEnvironment(renderer) {
  const width = 128, height = 64, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sky = 1 - y / (height - 1);
      const panel = (x > 15 && x < 25 || x > 80 && x < 95) && y > 10 && y < 43;
      const value = panel ? 250 : Math.round(70 + sky * 145);
      const i = (y * width + x) * 4;
      data[i] = value;
      data[i + 1] = Math.min(255, value + 3);
      data[i + 2] = Math.min(255, value + 9);
      data[i + 3] = 255;
    }
  }
  const source = new T.DataTexture(data, width, height, T.RGBAFormat);
  source.colorSpace = T.SRGBColorSpace;
  source.mapping = T.EquirectangularReflectionMapping;
  source.needsUpdate = true;
  const generator = new T.PMREMGenerator(renderer),
    target = generator.fromEquirectangular(source);
  source.dispose();
  generator.dispose();
  return target;
}
