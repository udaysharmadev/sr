import test from "node:test";
import assert from "node:assert/strict";
import { exposedBoxFaces } from "../dist/arena-geometry.js";
import { MAPS } from "../dist/maps.js";
import * as T from "../dist/vendor/three.module.js";

const cube = { x: 0, y: 0, z: 0, w: 2, h: 2, d: 2 };
const area = (face) => new T.Vector3(...face.vertices[1]).sub(new T.Vector3(...face.vertices[0]))
  .cross(new T.Vector3(...face.vertices[3]).sub(new T.Vector3(...face.vertices[0]))).length();
const total = (boxes) => [...exposedBoxFaces(boxes)].reduce((sum, f) => sum + area(f), 0);

test("structural surfaces omit hidden joins, nested boxes and duplicate exterior faces", () => {
  assert.equal(total([cube]), 24);
  assert.equal(total([cube, { ...cube }]), 24);
  assert.equal(total([cube, { ...cube, x: 2 }]), 40);
  assert.equal(total([cube, { ...cube, x: 1 }]), 32);
  assert.equal(total([cube, { x: 0, y: .5, z: 0, w: 1, h: 1, d: 1 }]), 24);
  assert.equal(total([cube, { ...cube, y: 1, h: 1 }]), 24, "a flush cap does not add competing faces");
});

test("all actual arenas have outward winding and no coplanar overlapping structural patches", () => {
  for (const map of MAPS) {
    const faces = [...exposedBoxFaces(map.boxes)];
    assert.ok(faces.length > 0);
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i], axis = face.normal.findIndex((n) => n !== 0);
      const u = (axis + 1) % 3, v = (axis + 2) % 3, plane = face.vertices[0][axis];
      const a = face.vertices.map((p) => p[u]), b = face.vertices.map((p) => p[v]);
      const normal = new T.Vector3(...face.vertices[1]).sub(new T.Vector3(...face.vertices[0]))
        .cross(new T.Vector3(...face.vertices[2]).sub(new T.Vector3(...face.vertices[0]))).normalize();
      assert.ok(normal.dot(new T.Vector3(...face.normal)) > .999, map.id + " outward winding");
      for (let j = i + 1; j < faces.length; j++) {
        const other = faces[j];
        if (!other.normal[axis] || Math.abs(other.vertices[0][axis] - plane) > 1e-7) continue;
        const c = other.vertices.map((p) => p[u]), d = other.vertices.map((p) => p[v]);
        const overlapU = Math.min(Math.max(...a), Math.max(...c)) - Math.max(Math.min(...a), Math.min(...c));
        const overlapV = Math.min(Math.max(...b), Math.max(...d)) - Math.max(Math.min(...b), Math.min(...d));
        assert.ok(overlapU < 1e-7 || overlapV < 1e-7, map.id + " duplicate face " + face.source + "/" + other.source);
      }
      const outside = face.vertices.reduce((p, q) => p.add(new T.Vector3(...q)), new T.Vector3()).multiplyScalar(.25)
        .addScaledVector(new T.Vector3(...face.normal), 1e-5);
      for (const box of map.boxes) {
        assert.ok(!(Math.abs(outside.x - box.x) < box.w / 2 - 1e-7 &&
          Math.abs(outside.z - box.z) < box.d / 2 - 1e-7 && outside.y > (box.y || 0) + 1e-7 &&
          outside.y < (box.y || 0) + box.h - 1e-7), map.id + " buried surface");
      }
    }
  }
});
