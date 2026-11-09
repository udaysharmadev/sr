import { clearPosition } from "./maps.js";

export function spectatorView(map, target) {
  const focus = { x: target.x, y: target.y + (target.eyeHeight || 1.62) * .85, z: target.z };
  const desired = { x: focus.x + Math.sin(target.yaw || 0) * 3.4,
    y: focus.y + .9, z: focus.z + Math.cos(target.yaw || 0) * 3.4 };
  let position = { ...focus };
  // Stay in front of decorative perimeter banners as well as solid map walls.
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    const next = { x: focus.x + (desired.x - focus.x) * t,
      y: focus.y + (desired.y - focus.y) * t, z: focus.z + (desired.z - focus.z) * t };
    if (Math.abs(next.x) > map.half - 1 || Math.abs(next.z) > map.half - 1 ||
      !clearPosition(map, next.x, next.z, next.y, .12, .12)) break;
    position = next;
  }
  return { position, focus };
}
