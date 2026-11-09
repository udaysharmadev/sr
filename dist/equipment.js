// Shared client/server equipment rules. Positions and seconds use arena metres.
export const EQUIPMENT = ['rifle', 'knife', 'grenade'];
export const KNIFE_RANGE = 2.4, KNIFE_MS = 580, KNIFE_CONTACT_MS = 180, FUSE_MS = 1800, CHARGE_MS = 1200;
export const MAX_HEALTH = 100, KNIFE_DAMAGE = 50, BLAST_KILL_RADIUS = 4.5, BLAST_RADIUS = 8;
export function blastDamage(distance) {
  if (!Number.isFinite(distance) || distance < 0 || distance > BLAST_RADIUS) return 0;
  if (distance <= BLAST_KILL_RADIUS) return MAX_HEALTH;
  return Math.max(KNIFE_DAMAGE, Math.ceil(99 - (distance - BLAST_KILL_RADIUS) / (BLAST_RADIUS - BLAST_KILL_RADIUS) * 49));
}
export function damagePlayer(player, damage) {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  const before = player.health ?? MAX_HEALTH;
  player.health = Math.max(0, before - damage);
  return before - player.health;
}
export function playerAlias(value) {
  return String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 22);
}
export function eyeOrigin(pose, yaw = pose.yaw || 0) {
  return [pose.x + Math.cos(yaw) * (pose.lean || 0), pose.y + pose.eyeHeight, pose.z - Math.sin(yaw) * (pose.lean || 0)];
}
const grenadeBlocked = (g, map) => map.boxes.some((b) => Math.abs(g.x - b.x) < b.w / 2 + .12 && Math.abs(g.z - b.z) < b.d / 2 + .12 && g.y > (b.y || 0) - .12 && g.y < (b.y || 0) + b.h + .12);
export function grenadeLaunch(pose, charge = 0, map = null) {
  charge = Math.max(0, Math.min(1, Number(charge) || 0));
  const yaw = pose.yaw || 0, pitch = pose.pitch || 0, speed = 2.2 + charge * 20;
  const eye = eyeOrigin(pose, yaw), origin = { x: eye[0], y: eye[1] - .25, z: eye[2] };
  // Start at the throwing hand, but stop the short launch sweep before cover.
  for (let i = 0; i < 10; i++) {
    const next = { x: origin.x + (-Math.sin(yaw) * .45 + Math.cos(yaw) * .18) / 10,
      y: origin.y, z: origin.z + (-Math.cos(yaw) * .45 - Math.sin(yaw) * .18) / 10 };
    if (map && (grenadeBlocked(next, map) || Math.abs(next.x) > map.half - .12 || Math.abs(next.z) > map.half - .12)) break;
    Object.assign(origin, next);
  }
  return { ...origin,
    vx: -Math.sin(yaw) * Math.cos(pitch) * speed,
    vy: Math.sin(pitch) * speed + 1.5 + charge * 3.5,
    vz: -Math.cos(yaw) * Math.cos(pitch) * speed, age: 0 };
}
export function stepGrenade(g, map, seconds) {
  const elapsed = Math.min(Math.max(0, seconds), (FUSE_MS / 1000) - g.age);
  g.age += elapsed;
  let remaining = (g.physicsRemainder || 0) + elapsed;
  const radius = .12;
  while (remaining >= 1 / 120 - 1e-8 || g.age >= FUSE_MS / 1000 - 1e-8 && remaining > 1e-8) {
    const dt = Math.min(1 / 120, remaining); remaining -= dt;
    g.vy -= 14 * dt;
    for (const [axis, velocity] of [['x','vx'], ['z','vz'], ['y','vy']]) {
      const old = g[axis], end = old + g[velocity] * dt, direction = Math.sign(end-old);
      let contact = end, hit = false;
      for (const b of map.boxes) {
        const min={x:b.x-b.w/2-radius,y:(b.y||0)-radius,z:b.z-b.d/2-radius},
          max={x:b.x+b.w/2+radius,y:(b.y||0)+b.h+radius,z:b.z+b.d/2+radius};
        if (['x','y','z'].some(other=>other!==axis&&(g[other]<=min[other]+1e-7||g[other]>=max[other]-1e-7))) continue;
        const face = direction>0 ? min[axis] : max[axis];
        if(direction>0 && old<=face+1e-7 && contact>=face || direction<0 && old>=face-1e-7 && contact<=face) {
          contact=face-direction*.000001;hit=true;
        }
      }
      const low=axis==='y'?radius:-map.half+radius, high=axis==='y'?Infinity:map.half-radius;
      if(contact<low){contact=low;hit=true;}if(contact>high){contact=high;hit=true;}
      g[axis]=contact;
      if(hit) {
        const impact = Math.abs(g[velocity]);
        g[velocity] *= axis === 'y' ? -.38 : -.48;
        if (axis === 'y') {
          const drag=Math.exp(-(impact>1?18:8)*dt);g.vx*=drag;g.vz*=drag;
          if(Math.abs(g.vy)<.5)g.vy=0;
        }
      }
    }
  }
  g.physicsRemainder = Math.max(0,remaining);
  return g;
}

// One centimetre of forgiveness, shared by practice and room verification.
export const RIFLE_GRAZE = .01;
export function rifleHitboxes(p) {
  const h = p.eyeHeight || 1.62, y = p.y || 0, lean = p.lean || 0, yaw = p.yaw || 0;
  const x = p.x + Math.cos(yaw) * lean, z = p.z - Math.sin(yaw) * lean, pad = RIFLE_GRAZE;
  return { head: [[x - .20 - pad, y + h - .13 - pad, z - .20 - pad], [x + .20 + pad, y + h + .24 + pad, z + .20 + pad]],
    body: [[p.x - .32 - pad, y - pad, p.z - .32 - pad], [p.x + .32 + pad, y + h - .13 + pad, p.z + .32 + pad]] };
}
export function knifeSwing(age, side = 1, reducedMotion = false) {
  const t = Math.max(0, Math.min(1, age / KNIFE_MS));
  const contact = KNIFE_CONTACT_MS / KNIFE_MS;
  const wind = t < .18 ? Math.sin(t / .18 * Math.PI / 2) : t < contact ? Math.cos((t-.18)/(contact-.18)*Math.PI/2) : 0;
  const strike = t < .18 ? 0 : t < contact ? Math.sin((t - .18) / (contact-.18) * Math.PI / 2) : Math.pow(1 - (t - contact) / (1-contact), 2);
  const motion = reducedMotion ? .35 : 1;
  return { x: (.34 - side * strike * .27 + side * wind * .08) * motion + .34 * (1 - motion),
    y: -.26 + (wind * -.07 + strike * .08) * motion, z: -.68 + (wind * .09 - strike * .28) * motion,
    rx: -.35 + (wind * -.3 + strike * 1.05) * motion, rz: -.35 + side * (wind * .3 - strike * 1.05) * motion };
}
