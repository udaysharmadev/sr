import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { D1Store, MemoryStore, roomApi } from "./api.mjs";
import { addPlayer, advance, command, newRoom, snapshot } from "./rooms.mjs";

function harness(store) {
  let now = 1000000;
  const api = roomApi(store, () => now);
  async function post(type, data = {}, token) {
    const res = await api(
      new Request("http://example.test/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ ...data, type }),
      }),
    );
    return { status: res.status, ...await res.json() };
  }
  return {
    post,
    step(ms) {
      now += ms;
    },
  };
}
test("15 public clients share one server clock, replace votes, and finish a full 600-second match", async () => {
  const { post, step } = harness(new MemoryStore());
  const players = await Promise.all(
    Array.from(
      { length: 15 },
      (_, i) => post("public", { name: "Pilot " + i }),
    ),
  );
  assert.equal(new Set(players.map((p) => p.code)).size, 1);
  assert.ok(players.every((p) => p.status === 200));
  const a = players[0],
    b = players[1],
    send = (p, type, data = {}) =>
      post(type, { code: p.code, ...data }, p.token);
  assert.equal((await send(a, "refresh")).state.players.length, 15);
  const overflow = await post("public", { name: "New player" });
  assert.notEqual(overflow.code, a.code);
  await send(a, "vote", { map: "overlook" });
  await send(a, "vote", { map: "switchyard" });
  await send(b, "vote", { map: "switchyard" });
  step(12001);
  let s = (await send(a, "refresh")).state;
  assert.equal(s.phase, "warmup");
  assert.equal(s.map, "switchyard");
  step(15001);
  s = (await send(a, "refresh")).state;
  assert.equal(s.phase, "live");
  const end = s.endsAt;
  await send(b, "leave");
  const late = await post("public", { name: "Late arrival" });
  assert.notEqual(late.code, a.code);
  assert.equal(late.state.phase, "waiting");
  const remaining = [a, ...players.slice(2)];
  await Promise.all(remaining.map((p) => send(p, "refresh")));
  for (let i = 0; i < 20; i++) {
    step(30000);
    await Promise.all(remaining.map((p) => send(p, "refresh")));
  }
  s = (await send(a, "refresh")).state;
  assert.equal(s.phase, "results");
  assert.equal(s.players.length, 14);
  step(18001);
  assert.equal((await send(a, "refresh")).state.phase, "waiting");
});

test("private ownership, capacity, readiness, mode switching, authentication, and removal", async () => {
  const { post } = harness(new MemoryStore());
  const a = await post("create", { device: "deviceA" });
  const code = a.code;
  const b = await post("join", { code, device: "deviceB" });
  const act = (p, type, data = {}) => post(type, { code, ...data }, p.token);
  assert.equal((await post("refresh", { code }, "fake")).status, 403);
  assert.equal(
    (await act(b, "settings", { settings: { mode: "duel" } })).status,
    403,
  );
  assert.equal((await act(a, "start")).status, 409);
  assert.equal(
    (await act(a, "settings", { settings: { mode: "duel" } })).state.settings
      .capacity,
    2,
  );
  assert.equal((await post("join", { code })).status, 409);
  await act(a, "settings", { settings: { mode: "tdm", capacity: 4 } });
  const c = await post("join", { code, device: "deviceC" }),
    d = await post("join", { code, device: "deviceD" });
  await act(a, "kick", { id: d.id });
  assert.equal((await post("join", { code, device: "deviceD" })).status, 403);
  await act(a, "leave");
  assert.equal((await act(b, "refresh")).state.host, b.id);
  await act(b, "settings", { settings: { mode: "ffa", locked: true } });
  assert.equal((await post("join", { code })).status, 409);
  await act(b, "ready", { ready: true });
  await act(c, "ready", { ready: true });
  assert.equal((await act(b, "start")).state.phase, "warmup");
  assert.equal(
    (await act(b, "settings", { settings: { duration: 20 } })).status,
    409,
  );
  const info = (await act(b, "refresh")).state;
  assert.ok(!JSON.stringify(info).includes(b.token));
  assert.ok(!JSON.stringify(info).includes("deviceC"));
});

test("validated hitscan, shielding, moving targets, cover, retry, ammunition, respawn, and reload", () => {
  const r = newRoom("TESTAA", false);
  let t = 1000000;
  const p1 = addPlayer(r, { name: "Alpha" }, t),
    p2 = addPlayer(r, { name: "Bravo" }, t),
    p3 = addPlayer(r, { name: "Charlie" }, t);
  const [a, b, c] = r.players;
  r.phase = "live";
  r.endsAt = t + 600000;
  Object.assign(a, { x: 0, y: 0, z: 12, yaw: 0, lean: 0 });
  Object.assign(b, { x: 0, y: 0, z: -12, history: [], shieldUntil: 0 });
  Object.assign(c, { x: 10, y: 0, z: 8, history: [], shieldUntil: 0 });
  const fire = (seq, yaw = 0) => {
    advance(r, t);
    command(r, p1.token, {
      type: "shoot",
      seq,
      at: t,
      yaw,
      pitch: 0,
      victim: p3.id,
    }, t);
  };
  fire(1);
  assert.equal(a.kills, 0, "center cover blocks shot");
  fire(1);
  assert.equal(a.ammo, 0, "retry ignored");
  t += 1500;
  b.z = 6;
  b.shieldUntil = t + 1000;
  fire(2);
  assert.equal(a.kills, 0);
  t += 1500;
  c.x = 0;
  c.z = 4;
  b.y = .26;
  fire(3);
  assert.equal(a.kills, 1);
  assert.equal(b.alive, false);
  assert.equal(c.alive, true);
  assert.equal(a.hits, 1);
  command(r, p2.token, { type: "shoot", seq: 1, yaw: Math.PI, pitch: 0 }, t);
  assert.equal(b.kills, 0);
  t += 2001;
  advance(r, t);
  assert.equal(b.alive, true);
  assert.ok(b.shieldUntil > t);
  command(r, p1.token, { type: "reload" }, t);
  fire(4);
  assert.equal(a.ammo, 0);
  t += 1801;
  advance(r, t);
  assert.equal(a.ammo, 1);
  const x = a.x;
  command(r, p1.token, {
    type: "input",
    seq: 1,
    frames: Array.from({ length: 100 }, () => ({ dt: 1, strafe: 1, yaw: 0 })),
  }, t);
  assert.ok(a.x - x < 3);
  assert.equal(
    snapshot(r, t).events.filter((e) => e.type === "kill").length,
    2, // The second shot is ready by the new 2s respawn boundary.
  );
});

test("D1 optimistic updates run against migrated SQLite and preserve concurrent joins", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    await readFile(
      new URL("../drizzle/0000_rooms.sql", import.meta.url),
      "utf8",
    ),
  );
  const binding = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: () => db.prepare(sql).get(...args),
            all: () => ({results:db.prepare(sql).all(...args)}),
            run: () => ({ meta: db.prepare(sql).run(...args) }),
          };
        },
      };
    },
  };
  const { post } = harness(new D1Store(binding));
  const users = await Promise.all([
    post("public", { name: "A" }),
    post("public", { name: "B" }),
    post("public", { name: "C" }),
  ]);
  assert.ok(users.every((p) => p.status === 200));
  assert.equal(
    (await post("refresh", { code: users[0].code }, users[0].token)).state
      .players.length,
    3,
  );
  db.close();
});

test("elevated walls block jumping and support landing, with no movement through roofs", async () => {
  const { movePlayer } = await import("../dist/movement.js");
  const { clearPosition } = await import("../dist/maps.js");
  const map = { half: 20, boxes: [{ x: 0, z: 0, w: 6, d: 6, y: 2.2, h: .4 }] };
  const p = { x: 0, y: 0, z: 0, yaw: 0, grounded: true, eyeHeight: 1.62 };
  assert.equal(clearPosition(map, 0, 0, 0), true);
  assert.equal(clearPosition(map, 0, 0, 1), false);
  for (let i = 0; i < 80; i++) {
    movePlayer(p, { jump: i === 0 }, 1 / 60, map);
    assert.ok(p.y <= .351, "a jumping head cannot cross the slab");
    assert.ok(p.y >= 0);
  }
  Object.assign(p, { y: 4, vy: 0, grounded: false });
  for (let i = 0; i < 80; i++) movePlayer(p, {}, 1 / 60, map);
  assert.equal(p.y, 2.6);
  assert.equal(p.grounded, true);
});

test("unlimited shots automatically rechamber exactly 1500 ms after every shot", () => {
  const r = newRoom("CYCLEA", false);
  let t = 1000000;
  const a = addPlayer(r, { name: "Alpha" }, t);
  addPlayer(r, { name: "Bravo" }, t);
  r.phase = "live";
  r.endsAt = t + 600000;
  const p = r.players.find((p) => p.id === a.id);
  for (let i = 0; i < 30; i++) {
    advance(r, t);
    command(
      r,
      a.token,
      { type: "shoot", seq: i * 2 + 1, yaw: 0, pitch: 1.2 },
      t,
    );
    assert.equal(p.shots, i + 1);
    assert.equal(p.ammo, 0);
    assert.equal(p.reloadUntil, t + 1500);
    advance(r, t + 1499);
    command(
      r,
      a.token,
      { type: "shoot", seq: i * 2 + 2, yaw: 0, pitch: 1.2 },
      t + 1499,
    );
    assert.equal(p.shots, i + 1, "early shot must be rejected");
    t += 1500;
    advance(r, t);
    assert.equal(p.ammo, 1);
    assert.equal(p.reloadUntil, 0);
  }
});

test("standings reorder by kills, then deaths and server scoring time", () => {
  const room = newRoom("RANKAA", false), at = 1000000;
  addPlayer(room, { name: "Alpha" }, at);
  addPlayer(room, { name: "Bravo" }, at);
  addPlayer(room, { name: "Charlie" }, at);
  const [a, b, c] = room.players;
  Object.assign(a, { kills: 3, deaths: 2, scoreAt: at + 4 });
  Object.assign(b, { kills: 4, deaths: 8, scoreAt: at + 3 });
  Object.assign(c, { kills: 3, deaths: 1, scoreAt: at + 5 });
  assert.deepEqual(snapshot(room, at + 10).players.map((p) => p.name), [
    "Bravo",
    "Charlie",
    "Alpha",
  ]);
  a.kills = 5;
  assert.deepEqual(snapshot(room, at + 10).players.map((p) => p.name), [
    "Alpha",
    "Bravo",
    "Charlie",
  ]);
  c.kills = 5;
  c.deaths = 2;
  assert.deepEqual(snapshot(room, at + 10).players.map((p) => p.name), [
    "Alpha",
    "Charlie",
    "Bravo",
  ]);
});

test("walking up stairs stays grounded and eases camera rise at 60/90/144 Hz", async () => {
  const { movePlayer, smoothCameraHeight } = await import(
    "../dist/movement.js"
  );
  for (const hz of [60, 90, 144]) {
    const map = {
      half: 30,
      boxes: Array.from(
        { length: 8 },
        (_, i) => ({
          x: 0,
          z: 6 - i * .8,
          w: 2,
          d: .85,
          y: 0,
          h: (i + 1) * .4,
        }),
      ),
    };
    const p = { x: 0, y: 0, z: 8, yaw: 0, grounded: true, eyeHeight: 1.62 },
      dt = 1 / hz;
    let viewY = 0, frames = 0;
    while (p.z > .4 && frames++ < hz * 3) {
      const z = p.z, oldView = viewY;
      movePlayer(p, { forward: 1 }, dt, map);
      viewY = smoothCameraHeight(viewY, p.y, dt, p.grounded);
      assert.equal(
        p.grounded,
        true,
        "a step edge must not unground the player at " + hz + "Hz",
      );
      if (frames > hz * .3) {
        assert.ok(
          p.z < z - .09 * 60 / hz,
          "stairs must not stall horizontal movement",
        );
      }
      assert.ok(
        viewY - oldView < .15,
        "camera must ease a riser rather than snap .4m",
      );
    }
    assert.ok(p.z <= .4);
    assert.ok(Math.abs(p.y - 3.2) < .001);
    for (let i = 0; i < hz * .3; i++) {
      viewY = smoothCameraHeight(viewY, p.y, dt, true);
    }
    assert.ok(Math.abs(viewY - p.y) < .003);
  }
});

test("mouse input delivers fire while the scope button remains held", async () => {
  const { listenMouseButtons } = await import("../dist/mouse-input.js");
  const canvas = new EventTarget(),
    window = new EventTarget(),
    abort = new AbortController();
  let scoped = false, shots = 0;
  listenMouseButtons(canvas, window, (e) => {
    if (e.button === 2) scoped = true;
    if (e.button === 0) {
      assert.equal(scoped, true);
      shots++;
    }
  }, (e) => {
    if (e.button === 2) scoped = false;
  }, abort.signal);
  const send = (target, type, button, buttons) => {
    const event = new Event(type);
    Object.assign(event, { button, buttons });
    target.dispatchEvent(event);
  };
  send(canvas, "mousedown", 2, 2);
  send(canvas, "mousedown", 0, 3);
  send(window, "mouseup", 0, 2);
  assert.equal(scoped, true);
  send(canvas, "mousedown", 0, 3);
  send(window, "mouseup", 0, 2);
  assert.equal(shots, 2);
  assert.equal(scoped, true);
  send(window, "mouseup", 2, 0);
  assert.equal(scoped, false);
  abort.abort();
  send(canvas, "mousedown", 0, 1);
  assert.equal(shots, 2);
});

test("death presentation settles a body and removes it only after 1.5 seconds", async () => {
  const { collapsePose, COLLAPSE_MS } = await import("../dist/presentation.js");
  assert.equal(COLLAPSE_MS, 1500);
  assert.equal(collapsePose(0).tilt, 0);
  assert.equal(collapsePose(0).drop, 0);
  assert.ok(collapsePose(220).tilt > 0);
  assert.ok(collapsePose(220).tilt < collapsePose(520).tilt);
  assert.equal(collapsePose(1499).visible, true);
  assert.equal(collapsePose(1500).visible, false);
  assert.equal(collapsePose(1600).opacity, 0);
  assert.ok(collapsePose(520).tilt > 1.3);
});

test("lobby camera fits the full character in narrow and wide browser frames", async () => {
  const { lobbyCameraDistance } = await import("../dist/presentation.js");
  const tangent = Math.tan(35 * Math.PI / 360);
  for (
    const [w, h] of [[1920, 1080], [907, 510], [821, 462], [390, 844], [
      1280,
      360,
    ]]
  ) {
    const distance = lobbyCameraDistance(w / h);
    const projectedHeight = 3.08 / (2 * tangent * distance);
    const projectedWidth = 2.8 / (2 * tangent * distance * w / h);
    assert.ok(projectedHeight <= .461, "full body fits vertically");
    assert.ok(projectedWidth <= .781, "rifle and arms fit horizontally");
  }
});

test("actual corpse rig falls separately from a respawned player and cleans up at 1500ms", async () => {
  const T = await import("../dist/vendor/three.module.js");
  const { operator } = await import("../dist/arena.js");
  const { createDeathEffects } = await import("../dist/death-animation.js");
  const scene = new T.Scene(), model = operator(scene);
  model.scale.y = .77;
  const effects = createDeathEffects(scene, { boxes: [] }, () => 1000);
  const originalChildren = model.children.length, originalMaterials = [];
  model.traverse((node) => {
    if (node.material) originalMaterials.push([node.material, node.material.opacity]);
  });
  effects.add(model);
  assert.equal(scene.children.length, 2);
  effects.update(1000);
  const corpse = scene.children.find((item) => item !== model);
  assert.equal(corpse.scale.y, .77, "crouched body keeps its proportions");
  const standing = new T.Box3().setFromObject(corpse).getSize(new T.Vector3());
  model.position.set(10, 0, 10);
  effects.update(1520);
  const fallen = new T.Box3().setFromObject(corpse).getSize(new T.Vector3());
  assert.ok(new T.Box3().setFromObject(corpse).min.y >= -.00001, "fallen body rests above the floor");
  assert.ok(fallen.y < standing.y * .65);
  assert.equal(corpse.position.x, 0);
  assert.equal(model.children.length, originalChildren);
  assert.ok(originalMaterials.every(([material, opacity]) => material.opacity === opacity));
  effects.update(2499);
  assert.equal(scene.children.length, 2);
  assert.ok(originalMaterials.every(([material, opacity]) => material.opacity === opacity));
  effects.update(2500);
  assert.equal(scene.children.length, 1);
  effects.add(model);
  effects.dispose();
  assert.equal(scene.children.length, 1);
});

test("every view rifle points along the centered aim ray despite weapon bob", async () => {
  const T = await import("../dist/vendor/three.module.js");
  const { rifle } = await import("../dist/rifle-models.js");
  const { WEAPONS } = await import("../dist/weapons.js");
  const { alignRifleToCenter } = await import("../dist/presentation.js");
  for (const spec of WEAPONS) {
    const gun = rifle(new T.Scene(), spec.id);
    for (const [x, y, z] of [[.38, -.34, -.91], [.391, -.334, -.91], [0, -.26, -.91]]) {
      gun.position.set(x, y, z);
      alignRifleToCenter(gun);
      const direction = new T.Vector3(0, 0, -1).applyQuaternion(gun.quaternion);
      const point = direction.multiplyScalar((-18 - z) / direction.z).add(gun.position);
      assert.ok(Math.abs(point.x) < 1e-10, spec.name + " horizontal convergence");
      assert.ok(Math.abs(point.y) < 1e-10, spec.name + " vertical convergence");
    }
  }
});

test("sampled sniper audio decodes once, repeats immediately and releases sources", async () => {
  const { createShotAudio } = await import("../dist/shot-audio.js");
  const savedFetch = globalThis.fetch;
  let requests = 0, decodes = 0;
  const sample = {}, sources = [], gains = [], panners = [];
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  const context = {
    destination: {},
    async decodeAudioData() { decodes++; return sample; },
    createStereoPanner() {
      const panner = { pan: {}, connect() {}, disconnect() { this.disconnected = true; } };
      panners.push(panner);
      return panner;
    },
    createGain() {
      const gain = { gain: {}, connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(gain);
      return gain;
    },
    createBufferSource() {
      const source = {
        connect() {},
        disconnect() { this.disconnected = true; },
        start() { this.started = true; },
        stop() { this.stopped = true; this.onended(); },
      };
      sources.push(source);
      return source;
    },
  };
  try {
    const audio = createShotAudio(context, "/shot.mp3", .5);
    await Promise.all([audio.load(), audio.load()]);
    audio.play();
    audio.play();
    assert.equal(requests, 1);
    assert.equal(decodes, 1);
    assert.equal(sources.length, 2);
    assert.ok(sources.every((s) => s.started && s.buffer === sample));
    assert.ok(gains.every((g) => g.gain.value === .425));
    audio.play(.25, -1);
    assert.equal(gains[2].gain.value, .10625);
    assert.equal(panners[0].pan.value, -1);
    audio.play(0, 1);
    assert.equal(sources.length, 3, "inaudible shots create no source");
    sources[0].onended();
    assert.equal(sources[0].disconnected, true);
    audio.dispose();
    assert.equal(sources[1].stopped, true);
    assert.equal(sources[2].stopped, true);
    assert.equal(panners[0].disconnected, true);
    assert.ok(gains.every((g) => g.disconnected));
    audio.play();
    await Promise.resolve();
    assert.equal(sources.length, 3);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("releasing crouch inside a tunnel preserves floor position until standing clearance", async () => {
  const { movePlayer } = await import("../dist/movement.js");
  const map = { half: 15, boxes: [{ x: 0, z: 0, w: 4, d: 4, y: 1.35, h: .3 }] };
  for (const hz of [60, 144]) {
    const p = { x: 0, y: 0, z: 0, yaw: 0, eyeHeight: 1.02, grounded: true };
    for (let i = 0; i < hz * .5; i++) {
      movePlayer(p, {}, 1 / hz, map);
      assert.equal(p.y, 0, "standing attempt must not push feet below the floor");
      assert.equal(p.grounded, true);
      assert.ok(p.eyeHeight <= 1.03);
    }
    for (let i = 0; i < hz * 2; i++) movePlayer(p, { forward: 1 }, 1 / hz, map);
    assert.ok(p.z < -3, "crouched capsule can leave the tunnel");
    assert.equal(p.y, 0);
    assert.ok(p.eyeHeight > 1.60, "stands automatically once the ceiling clears");
  }
});

test("operator legs stride in opposition and settle to their original pose", async () => {
  const T = await import("../dist/vendor/three.module.js");
  const { operator, animateOperator } = await import("../dist/arena.js");
  for (const hz of [60, 144]) {
    const model = operator(new T.Scene());
    const legs = model.userData.legs;
    const left = legs.find((q) => q.side < 0), right = legs.find((q) => q.side > 0);
    for (let i = 0; i < hz * .4; i++) animateOperator(model, 7, 1 / hz);
    assert.ok(Math.abs(left.node.position.z - left.z) > .03);
    assert.ok((left.node.position.z - left.z) * (right.node.position.z - right.z) < 0);
    assert.ok(new T.Box3().setFromObject(model).min.y < .15, "boots stay near ground");
    for (let i = 0; i < hz; i++) animateOperator(model, 0, 1 / hz);
    for (const leg of legs) {
      assert.ok(Math.abs(leg.node.position.y - leg.y) < .00001);
      assert.ok(Math.abs(leg.node.position.z - leg.z) < .00001);
    }
    assert.equal(model.position.y, 0);
  }
});

test("remote gunshots pan relative to the view and become quieter with distance", async () => {
  const { remoteShotMix } = await import("../dist/shot-audio.js");
  const ear = { x: 0, y: 0, z: 0 };
  const right = remoteShotMix(ear, { x: 10, y: 0, z: 0 }, 0);
  const left = remoteShotMix(ear, { x: -10, y: 0, z: 0 }, 0);
  assert.equal(right.pan, 1);
  assert.equal(left.pan, -1);
  assert.equal(right.level, left.level);
  assert.ok(remoteShotMix(ear, { x: 30, y: 0, z: 0 }, 0).level < right.level);
  assert.equal(remoteShotMix(ear, { x: 81, y: 0, z: 0 }, 0).level, 0);
  assert.ok(Math.abs(remoteShotMix(ear, { x: 10, y: 0, z: 0 }, Math.PI).pan + 1) < 1e-10);
  assert.deepEqual(remoteShotMix(ear, ear, 0), { level: .7, pan: 0 });
});

test("preload completes real stages in order and never claims ready after a failure", async () => {
  const { runPreload } = await import("../dist/preload.js");
  const completed = [], percentages = [];
  await runPreload(["fonts", "audio", "first rendered scene"].map((label) => ({
    label, run: async () => { completed.push(label); },
  })), (value) => percentages.push([value, completed.length]));
  assert.deepEqual(completed, ["fonts", "audio", "first rendered scene"]);
  assert.equal(percentages.find(([value]) => value === 100)[1], 3);
  let afterFailure = false;
  const failed = [];
  await assert.rejects(runPreload([
    { label: "audio", run: () => { throw Error("decode failed"); } },
    { label: "scene", run: () => { afterFailure = true; } },
  ], (value) => failed.push(value)), /decode failed/);
  assert.equal(afterFailure, false);
  assert.ok(!failed.includes(100));
});

test("authoritative rifle loadout preserves chamber timing, rejects live swaps and survives respawn", () => {
  const r = newRoom("GEARAA", false), t = 1000000;
  const a = addPlayer(r, { name: "Alpha", weapon: "prism" }, t);
  const b = addPlayer(r, { name: "Bravo", weapon: "glacier" }, t);
  const [p, q] = r.players;
  r.phase = "warmup";
  r.endsAt = t + 15000;
  command(r, a.token, { type: "shoot", seq: 1, yaw: 0, pitch: 0 }, t);
  const recovery = p.reloadUntil;
  command(r, a.token, { type: "loadout", weapon: "volt" }, t + 100);
  assert.equal(p.weapon, "volt");
  assert.equal(p.ammo, 0);
  assert.equal(p.reloadUntil, recovery, "cosmetic change cannot bypass chamber");
  assert.equal(r.events.find((e) => e.type === "shot").weapon, "prism");
  assert.throws(() => command(r, a.token, { type: "loadout", weapon: "invalid" }, t + 100), /valid rifle/);
  assert.equal(p.weapon, "volt");
  r.phase = "live";
  r.endsAt = t + 600000;
  assert.throws(() => command(r, a.token, { type: "loadout", weapon: "cinder" }, t + 100), /while eliminated/);
  q.alive = false;
  q.respawnAt = t + 1200;
  command(r, b.token, { type: "loadout", weapon: "ivory" }, t + 200);
  advance(r, t + 1201);
  assert.equal(q.alive, true);
  assert.equal(q.weapon, "ivory");
  r.phase = "warmup";
  q.spectator = true;
  assert.throws(() => command(r, b.token, { type: "loadout", weapon: "rose" }, t + 1300), /while eliminated/);
  assert.equal(snapshot(r, t + 1300).players.find((v) => v.id === p.id).weapon, "volt");
});

test("room API accepts a selected rifle and rejects fabricated IDs", async () => {
  const { post } = harness(new MemoryStore());
  const bad = await post("public", { name: "Invalid", weapon: "pay-to-win" });
  assert.equal(bad.status, 400);
  const joined = await post("public", { name: "Valid", weapon: "cinder" });
  assert.equal(joined.status, 200);
  assert.equal(joined.state.players.find((q) => q.id === joined.id).weapon, "cinder");
});

test("corpse rifles own resources and settle even when the respawned player changes weapon", async () => {
  const T = await import("../dist/vendor/three.module.js");
  const { operator, setOperatorWeapon } = await import("../dist/arena.js");
  const { createDeathEffects } = await import("../dist/death-animation.js");
  const { WEAPONS } = await import("../dist/weapons.js");
  for (const weapon of WEAPONS) {
    const scene = new T.Scene(), model = operator(scene, 0xf4664c, weapon.id);
    model.userData.gun.userData.flash.visible = true;
    const liveGeometry = new Set(), liveTextures = new Set();
    model.userData.gun.traverse((node) => {
      if (node.geometry) liveGeometry.add(node.geometry);
      if (node.material?.map) liveTextures.add(node.material.map);
    });
    const effects = createDeathEffects(scene, { boxes: [] }, () => 0);
    effects.add(model);
    const corpse = scene.children.find((o) => o !== model);
    const droppedGun = corpse.children.find((o) => o.isGroup && o.children.some((n) => n.name === "muzzle-flash"));
    assert.ok(droppedGun, weapon.name + " has a dropped rifle");
    droppedGun.traverse((node) => {
      if (node.geometry) assert.ok(!liveGeometry.has(node.geometry));
      if (node.material?.map) assert.ok(!liveTextures.has(node.material.map));
      if (node.name === "muzzle-flash") assert.equal(node.visible, false);
    });
    setOperatorWeapon(model, weapon.id === "sunbolt" ? "prism" : "sunbolt");
    effects.update(700);
    const bounds = new T.Box3().setFromObject(corpse);
    assert.ok(bounds.min.y >= -.00001);
    assert.ok(bounds.max.y - bounds.min.y < 1.3, weapon.name + " settles near the floor");
    effects.update(1500);
    assert.equal(scene.children.length, 1);
  }
});

test("a shallow cover peek requires a legal exposed eye origin and dead players cannot return fire", () => {
  const r = newRoom("PEEKAA", false), t = 1000000;
  const a = addPlayer(r, { name: "Peeker", weapon: "rose" }, t);
  const b = addPlayer(r, { name: "Opponent" }, t);
  const [p, q] = r.players;
  r.phase = "live";
  r.endsAt = t + 600000;
  Object.assign(p, { x: 2.8, y: 0, z: 8, lean: 0, shieldUntil: 0, history: [] });
  Object.assign(q, { x: 3.26, y: 0, z: -6, lean: 0, shieldUntil: 0, history: [] });
  const fire = (seq, at) => command(r, a.token, {
    type: "shoot", seq, at, pitch: 0,
    yaw: Math.atan2(-(q.x - p.x - p.lean), p.z - q.z),
  }, at);
  fire(1, t);
  assert.equal(q.alive, true, "unleaned ray intersects the cover edge");
  advance(r, t + 1500);
  p.lean = .15;
  fire(2, t + 1500);
  assert.equal(q.alive, false, "legal peek can expose the eye past cover");
  const kill = r.events.find((e) => e.type === "kill");
  assert.equal(kill.weapon, "rose");
  command(r, b.token, { type: "shoot", seq: 1, at: t + 1500, yaw: Math.PI, pitch: 0 }, t + 1500);
  assert.equal(q.shots, 0, "a command processed after death cannot grant a retaliatory kill");
  assert.equal(p.alive, true);
});

test("spawn protection ends on leaving its radius and airborne headshots use elevated hitboxes", () => {
  const r = newRoom("AIRAAA", false), t = 1000000;
  const a = addPlayer(r, { name: "Shooter" }, t);
  const b = addPlayer(r, { name: "Jumper" }, t);
  const [p, q] = r.players;
  r.phase = "live";
  r.endsAt = t + 600000;
  Object.assign(p, { x: 23, y: 0, z: 12, lean: 0, shieldUntil: 0 });
  Object.assign(q, { x: 23, y: 0, z: 0, yaw: 0, spawnX: 23, spawnZ: 0,
    lean: 0, shieldUntil: t + 1000, history: [] });
  for (let i = 1; i <= 10; i++) {
    command(r, b.token, { type: "input", seq: i, frames: [{ forward: 1, yaw: 0, dt: .05 }] }, t + i * 50);
  }
  assert.equal(q.shieldUntil, 0);
  Object.assign(q, { y: 2, grounded: false, history: [] });
  const pitch = Math.atan2(q.y + q.eyeHeight - p.eyeHeight, p.z - q.z);
  command(r, a.token, { type: "shoot", seq: 1, at: t + 500, yaw: 0, pitch }, t + 500);
  assert.equal(q.alive, false);
  assert.equal(r.events.find((e) => e.type === "kill").headshot, true);
});

test("completed public rewards apply once across saved guest profiles and exclude private/practice", async () => {
  const { awardRound } = await import("../dist/progression.js");
  let profile = { kills: 0, deaths: 0, rounds: 0, xp: 0, coins: 0, best: 0 };
  const result = { roundId: "room-instance:1", completed: true, practice: false,
    kills: 4, deaths: 2, streak: 3 };
  assert.deepEqual(awardRound(profile, result, true), { applied: true, xp: 400, coins: 100 });
  profile = JSON.parse(JSON.stringify(profile));
  assert.deepEqual(awardRound(profile, result, true), { applied: false, xp: 0, coins: 0 });
  assert.equal(profile.rounds, 1);
  assert.equal(profile.kills, 4);
  assert.equal(profile.best, 3);
  for (const [data, isPublic] of [
    [{ ...result, roundId: "practice:1", practice: true }, true],
    [{ ...result, roundId: "private:1" }, false],
    [{ ...result, roundId: "unfinished:1", completed: false }, true],
    [{ ...result, roundId: null }, true],
  ]) assert.equal(awardRound(profile, data, isPublic).applied, false);
  assert.equal(profile.coins, 100);
  assert.equal(awardRound(profile, { ...result, roundId: "room-instance:2" }, true).applied, true);
  assert.equal(profile.coins, 200);
});

test("round identity survives live-to-results and changes on rematch or recreated room", () => {
  const t = 1000000, r = newRoom("P00000", true);
  addPlayer(r, { name: "One" }, t);
  for(let i=0;i<14;i++)addPlayer(r,{name:"Pilot "+i},t);
  advance(r, t + 10000 + 15000);
  const live = snapshot(r, t + 27000);
  assert.equal(live.phase, "live");
  assert.equal(live.startedAt, t + 20000);
  for (let at = t + 27000; at <= t + 627000; at += 30000) {
    r.players.forEach((p) => p.seen = at);
    advance(r, at);
  }
  const results = snapshot(r, t + 627000);
  assert.equal(results.roundId, live.roundId);
  assert.equal(results.finishedAt, t + 620000);
  // Keep the two clients present so the public room proceeds to another vote.
  r.players.forEach((p) => p.seen = t + 627000);
  advance(r, t + 627000 + 18000);
  advance(r, t + 627000 + 18000);
  assert.notEqual(snapshot(r, t + 645000).roundId, results.roundId);
  assert.notEqual(snapshot(newRoom("P00000", true), t).roundId, live.roundId);
});

test("spectators do not consume player slots, readiness, scoring or host privileges", () => {
  const t = 1000000, r = newRoom("WATCHA", false);
  const host = addPlayer(r, { name: "Host" }, t);
  command(r, host.token, { type: "settings", settings: { mode: "duel", spectators: true } }, t);
  const other = addPlayer(r, { name: "Opponent" }, t);
  const watcher = addPlayer(r, { name: "Watcher", spectator: true }, t);
  assert.equal(r.players.filter((p) => !p.spectator).length, 2);
  assert.throws(() => command(r, watcher.token, { type: "ready", ready: true }, t), /configuration is closed/);
  command(r, host.token, { type: "ready", ready: true }, t);
  command(r, other.token, { type: "ready", ready: true }, t);
  command(r, host.token, { type: "start" }, t);
  advance(r, t + 15000);
  const before = snapshot(r, t + 15000).players.find((p) => p.id === watcher.id);
  command(r, watcher.token, { type: "shoot", seq: 1, yaw: 0, pitch: 0 }, t + 15000);
  command(r, watcher.token, { type: "input", seq: 1, frames: [{ forward: 1, dt: .05 }] }, t + 15000);
  const after = snapshot(r, t + 15000).players.find((p) => p.id === watcher.id);
  assert.equal(after.kills, 0);
  assert.equal(after.shots, before.shots);
  assert.equal(after.inputSeq, before.inputSeq);
  assert.equal(after.alive, false);
  command(r, host.token, { type: "leave" }, t + 15000);
  assert.equal(r.host, other.id);
});
