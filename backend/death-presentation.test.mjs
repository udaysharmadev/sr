import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../dist/vendor/three.module.js";
import { operator } from "../dist/arena.js";
import { rifle, disposeRifle } from "../dist/rifle-models.js";
import { createDeathEffects } from "../dist/death-animation.js";
import { addPlayer, advance, command, newRoom } from "./rooms.mjs";

function killFixture() {
  const room = newRoom("DEATHA", false), at = 1000000;
  const shooter = addPlayer(room, { name: "Shooter" }, at);
  const victim = addPlayer(room, { name: "Victim", weapon: "glacier" }, at);
  room.phase = "live"; room.endsAt = at + 600000;
  const [a, b] = room.players;
  Object.assign(a, { x: 10, y: 4, z: 0, alive: true, ammo: 1, reloadUntil: 0, lean: 0, eyeHeight: 1.62, history: [], shieldUntil: 0 });
  Object.assign(b, { x: 10, y: 4, z: -6, alive: true, yaw: .9, lean: 0, eyeHeight: 1.02, history: [], shieldUntil: 0 });
  command(room, shooter.token, { type: "shoot", seq: 1, at, yaw: 0, pitch: Math.atan2(-.6, 6),
    victimPose: { x: 999, y: 999, z: 999, weapon: "ivory" } }, at);
  assert.equal(b.alive, false);
  return { room, at, victim, player: b, event: room.events.find((e) => e.type === "kill") };
}

test("accepted kills retain the authoritative death pose after a loadout change and respawn", () => {
  const { room, at, victim, player, event } = killFixture();
  assert.deepEqual(event.victimPose, { x: 10, y: 4, z: -6, yaw: .9, eyeHeight: 1.02,
    weapon: "glacier",finish:'field', impactX: 0, impactZ: -Math.cos(Math.atan2(-.6, 6)) });
  const before = structuredClone(event.victimPose);
  command(room, victim.token, { type: "loadout", weapon: "prism" }, at + 200);
  advance(room, at + 2000);
  assert.equal(player.alive, true);
  assert.equal(player.weapon, "prism");
  assert.notDeepEqual([player.x, player.y, player.z], [10, 4, -6]);
  assert.deepEqual(event.victimPose, before);
});

const vertices = (group) => {
  let count = 0;
  group.traverse((node) => count += node.geometry?.attributes.position.count || 0);
  return count;
};

test("a late corpse uses the death location, crouch and rifle independently of the respawned actor", () => {
  const scene = new T.Scene(), live = operator(scene, 0xf4664c, "prism");
  live.position.set(-20, 0, 20);
  live.rotation.y = Math.PI;
  const pose = { x: 10, y: 4, z: -6, yaw: .9, eyeHeight: 1.02, weapon: "glacier", impactX: 0, impactZ: -1 };
  const effects = createDeathEffects(scene, { boxes: [] }, () => 1300);
  effects.add(live, 1300, pose);
  const corpse = scene.children.find((o) => o !== live);
  assert.deepEqual(corpse.position.toArray(), [10, 4, -6]);
  assert.equal(corpse.rotation.y, .9);
  assert.equal(corpse.scale.y, .77);
  const gun = corpse.children.find((o) => o !== corpse.children[0]);
  const expected = rifle(new T.Group(), "glacier", false);
  assert.equal(vertices(gun), vertices(expected));
  assert.notEqual(vertices(gun), vertices(live.userData.gun));
  disposeRifle(expected);
  const owned = new Set(), original = new Set();
  let released = 0, liveReleased = 0;
  gun.traverse((o) => { if (o.geometry) owned.add(o.geometry); });
  live.traverse((o) => { if (o.geometry) original.add(o.geometry); });
  owned.forEach((g) => g.addEventListener("dispose", () => released++));
  original.forEach((g) => g.addEventListener("dispose", () => liveReleased++));
  effects.update(1300);
  assert.equal(corpse.position.x, 10); assert.equal(corpse.position.z, -6);
  assert.ok(new T.Box3().setFromObject(corpse).min.y >= -1e-8);
  effects.update(1499); assert.equal(scene.children.length, 2);
  effects.update(1500); assert.equal(scene.children.length, 1);
  assert.equal(released, owned.size);
  assert.equal(liveReleased, 0);
  assert.deepEqual(live.position.toArray(), [-20, 0, 20]);
});

test("bodies fall with the shot direction in world space and settle above the floor", () => {
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2]]) {
    const scene = new T.Scene(), live = operator(scene);
    const effects = createDeathEffects(scene, { boxes: [] }, () => 0);
    effects.add(live, 0, { x: 0, y: 0, z: 0, yaw: .7, eyeHeight: 1.62, impactX: x, impactZ: z });
    effects.update(700);
    const corpse = scene.children.find((o) => o !== live), hip = corpse.children[0];
    const fall = new T.Vector3(0, 1, 0).applyQuaternion(hip.quaternion).applyAxisAngle(new T.Vector3(0, 1, 0), corpse.rotation.y);
    const projected = new T.Vector2(fall.x, fall.z).normalize();
    assert.ok(projected.dot(new T.Vector2(x, z)) > .999);
    const bounds = new T.Box3().setFromObject(corpse);
    assert.ok(bounds.min.y >= -1e-8);
    assert.ok(bounds.max.y - bounds.min.y < 1.35);
    effects.dispose();
  }
});

test("practice impacts keep the current actor pose while applying shot direction", () => {
  const scene = new T.Scene(), live = operator(scene);
  live.position.set(4, 0, -7); live.rotation.y = .4; live.scale.y = .77;
  const effects = createDeathEffects(scene, { boxes: [] }, () => 0);
  effects.add(live, 0, { impactX: -1, impactZ: 0 });
  const corpse = scene.children.find((o) => o !== live);
  assert.deepEqual(corpse.position.toArray(), [4, 0, -7]);
  assert.equal(corpse.rotation.y, .4); assert.equal(corpse.scale.y, .77);
  effects.update(700);
  const fall = new T.Vector3(0, 1, 0).applyQuaternion(corpse.children[0].quaternion)
    .applyAxisAngle(new T.Vector3(0, 1, 0), corpse.rotation.y);
  assert.ok(fall.x < -.9);
  effects.dispose();
});
