import test from "node:test";
import assert from "node:assert/strict";
import { renderQuality, frameTimings } from "../dist/quality.js";

test("quality presets cap GPU resolution and shadows without lowering the default visuals", () => {
  const low = renderQuality("low", 2), balanced = renderQuality("balanced", 2), high = renderQuality("high", 2);
  assert.equal(low.pixelRatio, 1);
  assert.equal(low.shadows, false);
  assert.equal(low.antialias, false);
  assert.equal(balanced.pixelRatio, 1.25);
  assert.equal(balanced.shadowSize, 512);
  assert.equal(high.pixelRatio, 1.65);
  assert.equal(high.shadowSize, 1024);
  assert.deepEqual(renderQuality("invalid", 2), high);
  assert.equal(renderQuality("high", 1).pixelRatio, 1);
  assert.equal(renderQuality(undefined, undefined).name, "high");
});

test("frame report uses real intervals, keeps visible hitches, and bounds retained samples", () => {
  const report = frameTimings(20);
  assert.equal(report.summary(), null);
  for (let i = 0; i < 18; i++) report.record(16.7);
  report.record(200);
  report.record(300);
  report.record(NaN);
  report.record(0);
  assert.deepEqual(report.summary(), { samples: 20, p50Ms: 16.7, p95Ms: 200 });
  for (let i = 0; i < 20; i++) report.record(8.3);
  assert.deepEqual(report.summary(), { samples: 20, p50Ms: 8.3, p95Ms: 8.3 });
});

test("spectator chase camera pulls forward before walls and remains inside map bounds", async () => {
  const { spectatorView } = await import("../dist/spectator.js");
  const { clearPosition } = await import("../dist/maps.js");
  const target = { x: 0, y: 0, z: 0, yaw: 0, eyeHeight: 1.62 };
  const open = { half: 26, boxes: [] };
  const unobstructed = spectatorView(open, target);
  assert.ok(Math.abs(unobstructed.position.z - 3.4) < .001);
  const wall = { half: 26, boxes: [{ x: 0, z: 2, w: 6, d: .4, h: 5 }] };
  const blocked = spectatorView(wall, target);
  assert.ok(blocked.position.z < 1.8);
  assert.ok(clearPosition(wall, blocked.position.x, blocked.position.z, blocked.position.y, .12, .12));
  assert.deepEqual(blocked.focus, unobstructed.focus);
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const edge = spectatorView(open, { ...target, x: Math.sin(yaw) * 25,
      z: Math.cos(yaw) * 25, yaw });
    assert.ok(Math.abs(edge.position.x) <= 25);
    assert.ok(Math.abs(edge.position.z) <= 25);
  }
});

test("shot camera rotation uses the newest mouse direction before the next render frame", async () => {
  const T = await import("../dist/vendor/three.module.js");
  const { updateAimRotation } = await import("../dist/presentation.js");
  const camera = new T.PerspectiveCamera(70, 16 / 9, .05, 180);
  camera.rotation.set(0, 0, 0);
  const yaw = .72, pitch = .23;
  updateAimRotation(camera, yaw, pitch, 0, .5, .15);
  camera.updateMatrixWorld();
  const ray = new T.Raycaster();
  ray.setFromCamera(new T.Vector2(0, 0), camera);
  assert.ok(Math.abs(ray.ray.direction.x + Math.sin(yaw) * Math.cos(pitch)) < 1e-10);
  assert.ok(Math.abs(ray.ray.direction.y - Math.sin(pitch)) < 1e-10);
  assert.ok(Math.abs(ray.ray.direction.z + Math.cos(yaw) * Math.cos(pitch)) < 1e-10);
});
