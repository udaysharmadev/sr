export const COLLAPSE_MS = 1500;

// Practice action deadlines and particles share one clock, frozen by its menu.
// Online matches leave this clock running, regardless of the local menu.
export function createPlayClock(read = () => performance.now()) {
  let offset = 0, heldAt = null;
  return {
    now: () => (heldAt ?? read()) - offset,
    setPaused(value) {
      if (value && heldAt === null) heldAt = read();
      else if (!value && heldAt !== null) { offset += read() - heldAt; heldAt = null; }
    },
  };
}

export function approachAngle(current, target, dt, rate = 16) {
  const delta = Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current + delta * (1-Math.exp(-Math.max(0,dt)*rate));
}
export function landingCompression(ageMs, impactSpeed, reducedMotion = false) {
  if(reducedMotion || ageMs<0 || ageMs>360 || !Number.isFinite(ageMs))return 0;
  const t=ageMs/360;
  return Math.sin(Math.PI*t)*Math.exp(-3*t)*Math.min(.13,Math.max(0,impactSpeed-3)*.014);
}

export function mouseAim(yaw, pitch, dx, dy, settings = {}, scoped = false) {
  const finite = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  const scale = finite(settings.sensitivity, 1, .2, 3) * .0021 * (scoped ? finite(settings.adsSensitivity, .55, .1, 1.5) : 1);
  return { yaw: yaw - (Number.isFinite(dx) ? dx : 0) * scale,
    pitch: Math.max(-1.4835, Math.min(1.4835, pitch - (Number.isFinite(dy) ? dy : 0) * scale * (settings.invertY ? -1 : 1))) };
}

// Control upgrades settle the view model faster; hitscan and the center aim stay exact.
const handling = { sunbolt: [1,65], glacier: [.94,62], prism: [.90,60], cinder: [.85,58], spectre: [.80,55], volt: [.75,52], rose: [.70,49], ivory: [.65,46] };
export function shotRecoil(ageMs, weapon) {
  if (!Number.isFinite(ageMs) || ageMs < 0) return { kick: 0, flash: 0 };
  const [strength, settle] = handling[weapon] || handling.sunbolt;
  return { kick: strength * Math.exp(-ageMs / settle), flash: Math.max(0, 1 - ageMs / 85) };
}

export function matchDeadline(state, at) {
  return state.phase === 'live' && state.settings?.mode === 'duel' && state.settings.duelRule === 'points' ? Infinity : state.endsAt - at;
}
export function selectableRifles(weapons, owned) {
  return Array.isArray(owned) ? weapons.filter(weapon => owned.includes(weapon.id)) : weapons;
}

export function updateAimRotation(camera, yaw, pitch, kick = 0, shake = .5, lean = 0) {
  camera.rotation.order = "YXZ";
  camera.rotation.set(pitch + kick * .030 * shake, yaw, -lean * 1.06);
}

// View rifles point along local -Z. Converge their barrel on the center ray,
// rather than using a fixed cosmetic yaw that points away from the reticle.
export function alignRifleToCenter(gun, distance = 18) {
  const x = -gun.position.x, y = -gun.position.y;
  const z = -distance - gun.position.z, length = Math.hypot(x, y, z);
  gun.quaternion.set(y / length, -x / length, 0, 1 - z / length).normalize();
}

export function collapsePose(age) {
  const t = Math.max(0, Math.min(1, age / 520));
  const settle = 1 - Math.pow(1 - t, 3);
  return {
    visible: age < COLLAPSE_MS,
    drop: .5 * settle,
    tilt: 1.40 * settle,
    knee: -.42 * Math.sin(t * Math.PI),
    arm: .5 * settle,
    opacity: Math.min(1, Math.max(0, (COLLAPSE_MS - age) / 160)),
  };
}

export function lobbyCameraDistance(aspect, preview = false) {
  const tangent = Math.tan(35 * Math.PI / 360);
  return Math.max(
    3.08 / (2 * tangent * (preview ? .9 : .46)),
    2.8 / (2 * tangent * Math.max(.2, aspect) * .78),
  );
}
