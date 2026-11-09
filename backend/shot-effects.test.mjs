import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../dist/vendor/three.module.js";
import { createShotEffects, traceSurface, animateMuzzleFlash } from "../dist/shot-effects.js";
import { shotRecoil, updateAimRotation } from "../dist/presentation.js";

test("muzzle sparkle ends quickly, smoke drifts briefly, and particles stay at the fired location", () => {
  const scene = new T.Scene(), effects = createShotEffects(scene, 2);
  const root = scene.getObjectByName("muzzle-effects"), position = new T.Vector3(3, 2, -4);
  effects.fire(position, new T.Vector3(0, 0, -1), 1000);
  position.set(50, 50, 50);
  effects.update(1020);
  const burst = root.children.find((g) => g.visible), [smoke, sparks] = burst.children;
  assert.deepEqual(burst.position.toArray(), [3, 2, -4]);
  assert.equal(sparks.visible, true);
  assert.ok(smoke.material.opacity > .4 && smoke.material.opacity < .48);
  const initialY = smoke.geometry.attributes.position.getY(0);
  effects.update(1200);
  assert.equal(sparks.visible, false);
  assert.ok(smoke.geometry.attributes.position.getY(0) > initialY);
  assert.ok([...smoke.geometry.attributes.position.array].every(Number.isFinite));
  effects.update(1799); assert.equal(burst.visible, true);
  effects.update(1800); assert.equal(burst.visible, false);
  effects.dispose(); assert.equal(scene.children.length, 0);
});

test("rapid shots reuse bounded particle resources and disposal releases each resource once", () => {
  const scene = new T.Scene(), effects = createShotEffects(scene, 2);
  const root = scene.getObjectByName("muzzle-effects"), owned = new Set();
  let released = 0;
  root.traverse((node) => {
    if (node.geometry) owned.add(node.geometry);
    if (node.material) { owned.add(node.material); if (node.material.map) owned.add(node.material.map); }
  });
  owned.forEach((resource) => resource.addEventListener("dispose", () => released++));
  for (let i = 0; i < 100; i++) effects.fire(new T.Vector3(i, 1, 0), new T.Vector3(0, 1, 0), i);
  effects.update(120);
  assert.equal(root.children.length, 2);
  root.traverse((node) => {
    if (node.geometry) assert.ok(owned.has(node.geometry));
    if (node.geometry) assert.ok([...node.geometry.attributes.position.array].every(Number.isFinite));
  });
  effects.dispose(); effects.dispose();
  effects.fire(new T.Vector3(), new T.Vector3(0, 0, -1), 2000);
  assert.equal(released, owned.size);
  assert.equal(scene.children.length, 0);
});

test("shot kick is immediate, settles in real time and cannot roll the centred aim", () => {
  assert.equal(shotRecoil(0).kick, 1);
  assert.equal(shotRecoil(0).flash, 1);
  assert.ok(shotRecoil(45).flash > 0);
  assert.equal(shotRecoil(85).flash, 0);
  assert.ok(shotRecoil(65).kick < .37);
  assert.ok(shotRecoil(500).kick < .001);
  assert.ok(shotRecoil(1500).kick < 1e-9);
  assert.deepEqual(shotRecoil(Infinity), { kick: 0, flash: 0 });
  const camera = new T.PerspectiveCamera();
  updateAimRotation(camera, .4, .2, shotRecoil(0).kick, .45);
  assert.equal(camera.rotation.y, .4); assert.equal(Math.abs(camera.rotation.z), 0);
  assert.ok(camera.rotation.x > .21 && camera.rotation.x < .22);
  updateAimRotation(camera, .4, .2, 1, 0);
  assert.equal(camera.rotation.x, .2, "zero shake retains the exact camera aim");
});

test("flash stays aligned to the bore on every shot, while traces end at the actual aim hit", () => {
  const flash = new T.Mesh(new T.ConeGeometry(.045, .17, 6), new T.MeshBasicMaterial());
  for (let shot = 0; shot < 30; shot++) {
    animateMuzzleFlash(flash, 1, shot);
    assert.ok(new T.Vector3(0, 1, 0).applyQuaternion(flash.quaternion).distanceTo(new T.Vector3(0, 0, -1)) < 1e-8);
  }
  animateMuzzleFlash(flash, 0, 31); assert.equal(flash.visible, false);
  flash.geometry.dispose(); flash.material.dispose();
  const scene = new T.Scene(), effects = createShotEffects(scene, 2);
  effects.fire(new T.Vector3(1, 2, 3), new T.Vector3(0, 0, -1), 1000, true, new T.Vector3(0, 2, -10));
  effects.update(1020);
  const trace = scene.getObjectByName("bullet-trace");
  assert.equal(trace.visible, true);
  assert.deepEqual([...trace.geometry.attributes.position.array], [0, 0, 0, -1, 0, -13]);
  effects.fire(new T.Vector3(5, 2, 3), new T.Vector3(0, 0, -1), 1025);
  effects.update(1040, true);
  assert.equal(scene.getObjectByName("muzzle-effects").children[0].visible, false, "entering scope clears the local muzzle puff");
  assert.equal(scene.getObjectByName("muzzle-effects").children[1].visible, true, "remote muzzle smoke remains in the world");
  effects.update(1100); assert.equal(scene.getObjectByName("muzzle-effects").children[1].getObjectByName("bullet-trace").visible, false);
  effects.dispose();
});

test("surface feedback uses the nearest obstruction and the actual face normal", () => {
  const box = { x: 0, z: 0, y: 1, w: 2, d: 2, h: 2 };
  const map = { boxes: [box, { ...box, z: -5 }] };
  for (const normal of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const n = new T.Vector3(...normal), origin = n.clone().multiplyScalar(4).add(new T.Vector3(0, 2, 0));
    // Bottom-face rays start above the arena floor, below this suspended box.
    if (normal[1] === -1) origin.y = .5;
    const hit = traceSurface({ boxes: [box] }, new T.Ray(origin, n.clone().negate()));
    assert.ok(hit);
    assert.deepEqual(hit.normal.toArray(), normal);
    assert.ok(hit.position.distanceTo(new T.Vector3(0, 2, 0).add(n)) < 1e-8);
  }
  const ray = new T.Ray(new T.Vector3(0, 2, 5), new T.Vector3(0, 0, -1));
  assert.equal(traceSurface(map, ray).distance, 4);
  assert.equal(traceSurface(map, ray, 3), null, "do not mark cover behind a closer hit");
  const floor = traceSurface({ boxes: [] }, new T.Ray(new T.Vector3(3, 2, 4), new T.Vector3(0, -1, 0)));
  assert.deepEqual(floor.position.toArray(), [3, 0, 4]);
  assert.deepEqual(floor.normal.toArray(), [0, 1, 0]);
  assert.equal(traceSurface({ boxes: [] }, new T.Ray(new T.Vector3(0, 2, 0), new T.Vector3(0, 1, 0))), null);
  assert.equal(traceSurface({ boxes: [], half: 26 }, new T.Ray(new T.Vector3(30, 2, 0), new T.Vector3(0, -1, 0))), null,
    "never leave floating floor marks outside the arena");
});

test("impacts face the surface, fade away, and reuse the muzzle pool without leaving marks on new bursts", () => {
  const scene = new T.Scene(), effects = createShotEffects(scene, 1);
  const root = scene.getObjectByName("muzzle-effects");
  effects.impact(new T.Vector3(2, 1, -4), new T.Vector3(1, 0, 0), 1000);
  effects.update(1100);
  const burst = root.children[0], mark = burst.getObjectByName("bullet-impact");
  assert.equal(mark.visible, true);
  assert.ok(new T.Vector3(0, 0, 1).applyQuaternion(mark.quaternion).distanceTo(new T.Vector3(1, 0, 0)) < 1e-8);
  assert.ok(burst.position.x > 2, "offset along the surface normal prevents z-fighting");
  assert.equal(burst.children[1].visible, false, "concrete dust has no persistent fiery sparks");
  effects.update(1500); assert.equal(burst.children[0].material.opacity, 0);
  effects.update(5500); assert.ok(mark.material.opacity > 0 && mark.material.opacity < .7);
  effects.update(6000); assert.equal(burst.visible, false);
  effects.impact(new T.Vector3(), new T.Vector3(0, 1, 0), 7000);
  effects.fire(new T.Vector3(), new T.Vector3(0, 0, -1), 7010);
  effects.update(7020); assert.equal(mark.visible, false);
  assert.equal(root.children.length, 1);
  effects.dispose(); assert.equal(scene.children.length, 0);
});
