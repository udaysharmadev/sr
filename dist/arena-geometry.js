const EPS = 1e-7;

// Subtract overlapping solids before batching. Exact coplanar caps and stair
// sides otherwise compete in the depth buffer, especially from inside towers.
export function* exposedBoxFaces(boxes) {
  const bounds = boxes.map((b) => ({
    min: [b.x - b.w / 2, b.y || 0, b.z - b.d / 2],
    max: [b.x + b.w / 2, (b.y || 0) + b.h, b.z + b.d / 2],
  }));
  for (let source = 0; source < boxes.length; source++) {
    const own = bounds[source];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      const plane = sign > 0 ? own.max[axis] : own.min[axis];
      let patches = [[own.min[u], own.max[u], own.min[v], own.max[v]]];
      for (let j = 0; j < boxes.length && patches.length; j++) {
        if (j === source) continue;
        const other = bounds[j];
        const extendsOut = sign > 0
          ? other.min[axis] <= plane + EPS && other.max[axis] > plane + EPS
          : other.max[axis] >= plane - EPS && other.min[axis] < plane - EPS;
        const sameFace = Math.abs((sign > 0 ? other.max[axis] : other.min[axis]) - plane) < EPS;
        if (!extendsOut && !(sameFace && j < source)) continue;
        patches = patches.flatMap(([a, b, c, d]) => {
          const left = Math.max(a, other.min[u]), right = Math.min(b, other.max[u]);
          const bottom = Math.max(c, other.min[v]), top = Math.min(d, other.max[v]);
          if (right - left <= EPS || top - bottom <= EPS) return [[a, b, c, d]];
          return [[a, left, c, d], [right, b, c, d], [left, right, c, bottom], [left, right, top, d]]
            .filter(([x0, x1, y0, y1]) => x1 - x0 > EPS && y1 - y0 > EPS);
        });
      }
      for (const [a, b, c, d] of patches) {
        const normal = [0, 0, 0]; normal[axis] = sign;
        const vertices = [[a, c], [b, c], [b, d], [a, d]].map(([x, y]) => {
          const p = [0, 0, 0]; p[axis] = plane; p[u] = x; p[v] = y; return p;
        });
        if (sign < 0) vertices.reverse();
        yield { source, normal, vertices };
      }
    }
  }
}
