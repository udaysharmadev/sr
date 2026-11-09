import test from "node:test";
import assert from "node:assert/strict";
import { MAPS, clearPosition } from "../dist/maps.js";
import { movePlayer } from "../dist/movement.js";
import { addPlayer, command, newRoom } from "./rooms.mjs";

const arena = MAPS.find((m) => m.id === "crosswind");
const player = (x, z) => ({ x, y: 0, z, yaw: 0, eyeHeight: 1.62, grounded: true });
function walk(p, map, x, z, hz) {
  for (let frame = 0; frame < hz * 6; frame++) {
    const distance = Math.hypot(x - p.x, z - p.z);
    if (distance < .12) {
      for (let i = 0; i < hz * .25; i++) movePlayer(p, { forward: 0 }, 1 / hz, map);
      return;
    }
    movePlayer(p, { yaw: Math.atan2(p.x - x, p.z - z), forward: Math.min(1, distance * 2) }, 1 / hz, map);
    assert.equal(p.grounded, true, "walkable routes should not require a jump at " + hz + "Hz");
  }
  assert.fail("route stalled before " + x + "," + z + ": " + JSON.stringify({ x: p.x, y: p.y, z: p.z }));
}

test("every redesigned arena keeps clear spawns and structural boxes inside its boundary", () => {
  assert.equal(MAPS.length, 4);
  for (const map of MAPS) {
    for (const spawn of map.spawns) assert.ok(clearPosition(map, spawn.x, spawn.z), map.name + " spawn remains usable");
    for (const b of map.boxes) {
      assert.ok(b.w > 0 && b.d > 0 && b.h > 0);
      assert.ok(Math.abs(b.x) + b.w / 2 < map.half);
      assert.ok(Math.abs(b.z) + b.d / 2 < map.half);
    }
  }
});

test("every arena spawn is connected by ground routes and every upper shooting room has usable stairs", () => {
  for (const map of MAPS) {
    const visited = new Set(), queue = [[0, 23]], key = (x, z) => x + "," + z;
    visited.add(key(0, 23));
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i];
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, nz = z + dz, k = key(nx, nz);
        if (visited.has(k) || !clearPosition(map, nx, nz) || !clearPosition(map, x + dx / 2, z + dz / 2)) continue;
        visited.add(k); queue.push([nx, nz]);
      }
    }
    for (const p of map.spawns) assert.ok(visited.has(key(p.x, p.z)), map.id + " disconnected spawn");
    for (const slab of map.boxes.filter((b) => b.style === "walkway" && b.y === 2.8)) {
      for (const hz of [60, 144]) {
        const x = slab.x + slab.w / 2 - 2, p = player(x, slab.z + slab.d / 2 + 7);
        walk(p, map, x, slab.z, hz);
        assert.ok(p.y >= 3.09, map.id + " upper room inaccessible");
      }
    }
  }
});

test("both landmark buildings have real ground passages at standing height", () => {
  for (const hz of [60, 144]) {
    for (const [x, start, end] of [[13, 13.5, 2.5], [-13, -12.5, -1.5]]) {
      const p = player(x, start);
      walk(p, arena, x, end, hz);
      assert.equal(p.y, 0);
      assert.ok(clearPosition(arena, p.x, p.z, p.y));
    }
  }
});

test("east staircase connects to the tower, guarded walkway and centre deck without jumps", () => {
  for (const hz of [60, 144]) {
    const p = player(15.5, 18);
    for (const [x, z] of [[15.5, 8], [6, 8], [3, 8], [3, 3], [1, .5]]) walk(p, arena, x, z, hz);
    assert.ok(Math.abs(p.y - 3.2) < .001);
    assert.ok(clearPosition(arena, p.x, p.z, p.y));
  }
});

test("the elevated connector leaves ground-level shots clear beneath it", () => {
  const at = 1000000, room = newRoom("MAPAAA", false);
  const shooter = addPlayer(room, { name: "Underpass" }, at);
  addPlayer(room, { name: "Opponent" }, at);
  room.phase = "live"; room.endsAt = at + 600000;
  const [a, b] = room.players;
  Object.assign(a, { x: 6, y: 0, z: 8, lean: 0, eyeHeight: 1.62, alive: true, ammo: 1, reloadUntil: 0, shieldUntil: 0, history: [] });
  Object.assign(b, { x: 6, y: 0, z: 4, lean: 0, eyeHeight: 1.62, alive: true, shieldUntil: 0, history: [] });
  assert.ok(clearPosition(arena, a.x, a.z)); assert.ok(clearPosition(arena, b.x, b.z));
  command(room, shooter.token, { type: "shoot", seq: 1, at, yaw: 0, pitch: 0 }, at);
  assert.equal(b.alive, false);
  assert.equal(a.kills, 1);
});

test("reference hybrids have continuous upper routes and descend without a jump at 60/144 Hz", () => {
  const routes = {
    switchyard: [-1, 1].map((side) => [[side * 19, -17], [side * 19, -7], [side * 19, 0], [side * 14, 0], [side * 15.5, 0], [side * 15.5, 11]]),
    overlook: [
      [[-24, -10], [-13, -10], [0, -10], [13, -10], [13, 10], [0, 10], [-13, 10], [-13, -10], [-24, -10]],
      [[24, -10], [13, -10], [24, -10]], [[-24, 10], [-13, 10], [-24, 10]], [[24, 10], [13, 10], [24, 10]],
      [[0, -20], [0, -10], [0, -20]], [[0, 20], [0, 10], [0, 20]],
    ],
    foundry: [[[14.5, 13], [14.5, 6], [12, 6], [7, 6], [2.5, 6], [2.5, 1.5], [-5, 1.5], [-5, -1], [-13, -1], [-13, -11]]],
  };
  for (const [id, paths] of Object.entries(routes)) for (const path of paths) for (const hz of [60, 144]) {
    const map = MAPS.find((m) => m.id === id), p = player(...path[0]);
    let highest = 0;
    for (const [x, z] of [...path.slice(1), ...path.slice(0, -1).reverse()]) {
      walk(p, map, x, z, hz); highest = Math.max(highest, p.y);
      assert.ok(clearPosition(map, p.x, p.z, p.y), id + " blocked standing clearance");
    }
    assert.ok(highest >= 3.09, id + " never reached the upper route");
    assert.equal(p.y, 0, id + " failed to return to the ground");
  }
});

test("practice target patrols remain clear of arena cover throughout their movement", () => {
  for (const map of MAPS) for (const anchor of map.spawns.slice(1)) for (let step = 0; step < 64; step++) {
    assert.ok(clearPosition(map, anchor.x + Math.sin(step / 64 * Math.PI * 2) * .7, anchor.z), map.id + " target inside cover");
  }
});
