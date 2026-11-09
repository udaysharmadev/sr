import { clearPosition } from "./maps.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const axis = (v) => Number.isFinite(v) ? clamp(v, -1, 1) : 0;
const approach = (a, b, step) => a + clamp(b - a, -step, step);

export function resetPlayerMotion(player, spawn) {
  Object.assign(player, spawn, {y:0,vx:0,vy:0,vz:0,pitch:0,grounded:true,slideTime:0,slideCooldown:0,coyote:.09,jumpBuffer:0,eyeHeight:1.62,lean:0});
}

export function movePlayer(p, input, dt, map) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  let remaining = Math.min(dt, .05), first = true;
  while (remaining > 1e-8) {
    const step = Math.min(1 / 120, remaining);
    moveStep(p, first ? input : { ...input, jump:false, slide:false }, step, map);
    remaining -= step; first = false;
  }
}
function moveStep(p, input, dt, map) {
  if (Number.isFinite(input.yaw)) p.yaw = input.yaw % (Math.PI * 2);
  if (Number.isFinite(input.pitch)) {
    p.pitch = clamp(input.pitch, -1.4835, 1.4835);
  }
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const f = axis(input.forward),
    s = axis(input.strafe),
    norm = Math.max(1, Math.hypot(f, s));
  // Releasing crouch beneath a low roof must not expand the capsule through it.
  const crouch = !!input.crouch ||
    !clearPosition(map, p.x, p.z, p.y, .36, 1.85);
  p.vx ||= 0;
  p.vy ||= 0;
  p.vz ||= 0;
  p.slideCooldown = Math.max(0, (p.slideCooldown || 0) - dt);
  p.slideTime = Math.max(0, (p.slideTime || 0) - dt);
  if (
    input.slide && input.sprint && p.grounded && p.slideCooldown === 0 &&
    Math.hypot(p.vx, p.vz) > 6
  ) {
    p.slideTime = .55;
    p.slideCooldown = 1.1;
    const boost = 11 / Math.hypot(p.vx, p.vz);
    p.vx *= boost;
    p.vz *= boost;
  }
  if (p.slideTime > 0) {
    p.vx *= Math.exp(-1.8 * dt);
    p.vz *= Math.exp(-1.8 * dt);
  } else {
    const speed = crouch ? 3.4 : input.sprint && f > 0 ? 9 : f < 0 ? 6.5 : 7;
    const accel = p.grounded ? (f || s ? 42 : 48) : 12;
    const dx = (s * cos - f * sin) / norm * speed - p.vx,
      dz = (-f * cos - s * sin) / norm * speed - p.vz;
    const blend = Math.min(1, accel * dt / (Math.hypot(dx, dz) || 1));
    p.vx += dx * blend;
    p.vz += dz * blend;
  }
  p.jumpBuffer = input.jump ? .09 : Math.max(0, (p.jumpBuffer || 0) - dt);
  p.coyote = p.grounded ? .09 : Math.max(0, (p.coyote || 0) - dt);
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = 7.22;
    p.grounded = false;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.slideTime = 0;
  }
  const height = crouch || p.slideTime > 0 ? 1.25 : 1.85;
  function canMove(x, z) {
    if (clearPosition(map, x, z, p.y, .36, height)) return true;
    if (!p.grounded || p.vy > 0) return false;
    const step = map.boxes.filter((b) =>
      Math.abs(x - b.x) < b.w / 2 + .36 && Math.abs(z - b.z) < b.d / 2 + .36
    )
      .map((b) => (b.y || 0) + b.h).filter((top) =>
        top > p.y && top <= p.y + .46
      );
    const top = Math.max(p.y, ...step);
    if (top === p.y || !clearPosition(map, x, z, top, .36, height)) {
      return false;
    }
    p.y = top;
    return true;
  }
  if (canMove(p.x + p.vx * dt, p.z)) p.x += p.vx * dt;
  else p.vx = 0;
  if (canMove(p.x, p.z + p.vz * dt)) p.z += p.vz * dt;
  else p.vz = 0;
  let floor = 0;
  let ceiling = Infinity;
  for (const b of map.boxes) {
    if (
      Math.abs(p.x - b.x) >= b.w / 2 + .36 ||
      Math.abs(p.z - b.z) >= b.d / 2 + .36
    ) continue;
    const bottom = b.y || 0, top = bottom + b.h;
    if (p.y >= top - .015) floor = Math.max(floor, top);
    if (bottom > p.y) ceiling = Math.min(ceiling, bottom);
  }
  // Keep the capsule grounded across small downward stair risers.
  if (p.grounded && p.vy <= 0 && p.y >= floor && p.y - floor <= .46) {
    p.y = floor;
  }
  p.vy -= 20 * dt;
  p.y += p.vy * dt;
  if (p.y + height > ceiling) {
    p.y = ceiling - height;
    p.vy = Math.min(0, p.vy);
  }
  if (p.y <= floor && p.vy <= 0) {
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  } else p.grounded = false;
  p.eyeHeight = Math.min(approach(
    p.eyeHeight || 1.62,
    crouch || p.slideTime > 0 ? 1.02 : 1.62,
    dt * 5.5,
  ), ceiling - p.y - .08);
  const desired = .15 * axis(input.lean);
  const lean = approach(p.lean || 0, desired, dt * 1.5);
  p.lean = clearPosition(map, p.x + cos * lean, p.z - sin * lean, p.y, .17, height)
    ? lean
    : 0;
}

// Stair smoothing must not leave the rendered eye inside a lower ceiling.
export function clampCameraEyeY(map, feet, desiredY) {
  let ceiling = Infinity;
  for(const b of map.boxes) {
    if((b.y||0)>feet.y && Math.abs(feet.x-b.x)<b.w/2+.08 && Math.abs(feet.z-b.z)<b.d/2+.08) ceiling=Math.min(ceiling,b.y);
  }
  return Math.min(desiredY,ceiling-.08);
}

// Only the camera eases across a stair riser. Collision and hitboxes stay exact.
export function smoothCameraHeight(
  current,
  target,
  dt,
  grounded,
  reducedMotion = false,
) {
  if (!grounded || reducedMotion || Math.abs(target - current) > .6) {
    return target;
  }
  return current + (target - current) * (1 - Math.exp(-Math.min(.05, dt) * 18));
}
