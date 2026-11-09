import * as T from "./vendor/three.module.js";

export function animateMuzzleFlash(flash, strength, shot) {
  flash.visible = strength > 0;
  flash.material.opacity = strength;
  // Spin around the cone's own Y axis before pointing it down the barrel.
  flash.rotation.set(-Math.PI / 2, shot * 2.39996, 0);
}

export function traceSurface(map, ray, limit = 100) {
  const point = new T.Vector3(), bounds = new T.Box3();
  let hit = null, distance = limit;
  if (ray.direction.y < -1e-8 && ray.origin.y >= 0) {
    const t = -ray.origin.y / ray.direction.y;
    const position = ray.at(t, new T.Vector3()), half = map.half ?? 26;
    if (t > .001 && t <= distance && Math.abs(position.x) <= half && Math.abs(position.z) <= half) {
      hit = { position, normal: new T.Vector3(0, 1, 0), distance: t };
      distance = t;
    }
  }
  for (const b of map.boxes) {
    bounds.min.set(b.x - b.w / 2, b.y || 0, b.z - b.d / 2);
    bounds.max.set(b.x + b.w / 2, (b.y || 0) + b.h, b.z + b.d / 2);
    if (!ray.intersectBox(bounds, point)) continue;
    const d = point.distanceTo(ray.origin);
    if (d < .001 || d > distance) continue;
    const faces = [[Math.abs(point.x - bounds.min.x), -1, 0, 0],
      [Math.abs(point.x - bounds.max.x), 1, 0, 0],
      [Math.abs(point.y - bounds.min.y), 0, -1, 0],
      [Math.abs(point.y - bounds.max.y), 0, 1, 0],
      [Math.abs(point.z - bounds.min.z), 0, 0, -1],
      [Math.abs(point.z - bounds.max.z), 0, 0, 1]];
    faces.sort((a, b) => a[0] - b[0]);
    hit = { position: point.clone(), normal: new T.Vector3(...faces[0].slice(1)), distance: d };
    distance = d;
  }
  return hit;
}

export function createShotEffects(scene, capacity = 12) {
  const root = new T.Group(); root.name = "muzzle-effects"; scene.add(root);
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4, radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.max(0, 1 - radius * radius) ** 2 * 255;
  }
  const texture = new T.DataTexture(pixels, 32, 32, T.RGBAFormat);
  texture.minFilter = texture.magFilter = T.LinearFilter; texture.needsUpdate = true;
  const up = new T.Vector3(0, 1, 0), forwardAxis = new T.Vector3(0, 0, 1);
  let serial = 0, disposed = false;
  const slots = Array.from({ length: capacity }, () => {
    const group = new T.Group(); group.visible = false; root.add(group);
    const smokeGeometry = new T.BufferGeometry();
    smokeGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(9), 3).setUsage(T.DynamicDrawUsage));
    const smoke = new T.Points(smokeGeometry, new T.PointsMaterial({
      color: 0xb5bdc3, map: texture, size: .1, transparent: true, opacity: 0, depthWrite: false,
    }));
    const sparkGeometry = new T.BufferGeometry();
    sparkGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(24), 3).setUsage(T.DynamicDrawUsage));
    const sparks = new T.LineSegments(sparkGeometry, new T.LineBasicMaterial({
      color: 0xffdfa0, transparent: true, opacity: .8, depthWrite: false, blending: T.AdditiveBlending,
    }));
    // Dynamic particle positions must not keep the initial zero-size bounds.
    smoke.frustumCulled = sparks.frustumCulled = false;
    const mark = new T.Mesh(new T.CircleGeometry(.055, 7), new T.MeshBasicMaterial({
      color: 0x34434a, transparent: true, opacity: .7, depthWrite: false,
    }));
    mark.name = "bullet-impact"; mark.visible = false;
    const traceGeometry = new T.BufferGeometry();
    traceGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(6), 3).setUsage(T.DynamicDrawUsage));
    const tracer = new T.Line(traceGeometry, new T.LineBasicMaterial({
      color: 0xffe3b0, transparent: true, opacity: .3, depthWrite: false, blending: T.AdditiveBlending,
    }));
    tracer.name = "bullet-trace"; tracer.frustumCulled = false;
    group.add(smoke, sparks, mark, tracer);
    return { group, smoke, sparks, mark, tracer, local: false, kind: "muzzle", born: -Infinity, phase: 0,
      direction: new T.Vector3(), right: new T.Vector3(), vertical: new T.Vector3() };
  });
  function begin(position, direction, at, kind) {
    if (disposed) return;
    const slot = slots.find((s) => !s.group.visible) || slots.reduce((a, b) => a.born < b.born ? a : b);
    slot.group.position.copy(position); slot.group.visible = true;
    slot.born = at; slot.phase = ++serial * 2.39996; slot.kind = kind;
    slot.direction.copy(direction).normalize();
    slot.right.crossVectors(slot.direction, up);
    if (slot.right.lengthSq() < .001) slot.right.set(1, 0, 0);
    else slot.right.normalize();
    slot.vertical.crossVectors(slot.right, slot.direction).normalize();
    slot.mark.visible = kind === "impact";
    slot.local = false; slot.tracer.visible = false;
    slot.smoke.material.color.setHex(kind === "impact" ? 0xc6bda9 : 0xd4d8da);
    return slot;
  }
  return {
    fire(position, direction, at, local = false, target = null) {
      const slot = begin(position, direction, at, "muzzle");
      if (!slot) return;
      slot.local = local;
      const endpoint = target ? target.clone().sub(position) : direction.clone().multiplyScalar(40);
      const p = slot.tracer.geometry.attributes.position;
      p.setXYZ(0, 0, 0, 0); p.setXYZ(1, endpoint.x, endpoint.y, endpoint.z); p.needsUpdate = true;
      slot.tracer.visible = true;
    },
    impact(position, normal, at) {
      const slot = begin(position, normal, at, "impact");
      if (!slot) return;
      slot.group.position.addScaledVector(normal, .006);
      slot.mark.quaternion.setFromUnitVectors(forwardAxis, slot.direction);
      slot.mark.rotateZ(slot.phase);
    },
    update(at, scoped = false) {
      if (disposed) return;
      for (const s of slots) {
        if (!s.group.visible) continue;
        const age = Math.max(0, (at - s.born) / 1000);
        const impact = s.kind === "impact", life = impact ? 5 : .8, smokeLife = impact ? .35 : .8;
        if (age >= life || scoped && s.local) { s.group.visible = false; continue; }
        s.mark.material.opacity = .7 * Math.min(1, (life - age) / .8);
        s.smoke.material.opacity = (impact ? .15 : .48) * Math.min(1, age / .015) * Math.max(0, 1 - age / smokeLife);
        s.smoke.material.size = (impact ? .09 : .13) + age * .45;
        const p = s.smoke.geometry.attributes.position;
        for (let i = 0; i < 3; i++) {
          const forward = (impact ? .04 : .12) + age * (.30 + i * .04), side = Math.sin(s.phase + i * 2) * (.015 + age * .09);
          p.setXYZ(i, s.direction.x * forward + s.right.x * side,
            s.direction.y * forward + (impact ? 0 : .04) + age * ((impact ? .20 : .55) + i * .035), s.direction.z * forward + s.right.z * side);
        }
        p.needsUpdate = true;
        s.tracer.visible = !impact && age < .07;
        s.tracer.material.opacity = .3 * Math.max(0, 1 - age / .07);
        s.sparks.visible = !impact && age < .07;
        if (s.sparks.visible) {
          s.sparks.material.opacity = .8 * (1 - age / .07);
          const points = s.sparks.geometry.attributes.position;
          for (let i = 0; i < 4; i++) {
            const angle = s.phase + i * Math.PI / 2, radius = .025 + age * 1.1;
            const dx = s.right.x * Math.cos(angle) + s.vertical.x * Math.sin(angle);
            const dy = s.right.y * Math.cos(angle) + s.vertical.y * Math.sin(angle);
            const dz = s.right.z * Math.cos(angle) + s.vertical.z * Math.sin(angle);
            for (let end = 0; end < 2; end++) {
              const r = radius * (end ? 1 : .45), forward = .035 + age * 1.5;
              points.setXYZ(i * 2 + end, s.direction.x * forward + dx * r,
                s.direction.y * forward + dy * r, s.direction.z * forward + dz * r);
            }
          }
          points.needsUpdate = true;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent();
      for (const s of slots) for (const node of [s.smoke, s.sparks, s.mark, s.tracer]) {
        node.geometry.dispose(); node.material.dispose();
      }
      texture.dispose();
    },
  };
}
