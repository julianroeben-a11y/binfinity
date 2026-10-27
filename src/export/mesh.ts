// Plain triangle meshes, independent of replicad and three.js, so they can be
// passed between the worker and the main thread and fed to the exporters.

export interface Mesh {
  /** xyz per vertex. */
  positions: Float32Array;
  /** Three vertex indices per triangle, counter-clockwise seen from outside. */
  indices: Uint32Array;
}

/**
 * Merge vertices that share a position (within `tolerance` mm). OpenCascade
 * meshes every face separately, which leaves duplicated vertices along edges;
 * slicers want a watertight, indexed mesh. Degenerate triangles are dropped.
 */
export function weld(positions: ArrayLike<number>, indices: ArrayLike<number>, tolerance = 1e-4): Mesh {
  const inv = 1 / tolerance;
  const map = new Map<string, number>();
  const remap = new Uint32Array(positions.length / 3);
  const out: number[] = [];
  for (let i = 0; i < remap.length; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = out.length / 3;
      map.set(key, idx);
      out.push(x, y, z);
    }
    remap[i] = idx;
  }
  const tris: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]];
    const b = remap[indices[t + 1]];
    const c = remap[indices[t + 2]];
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return { positions: new Float32Array(out), indices: new Uint32Array(tris) };
}

export function translateMesh(m: Mesh, dx: number, dy: number, dz: number): Mesh {
  const p = new Float32Array(m.positions.length);
  for (let i = 0; i < p.length; i += 3) {
    p[i] = m.positions[i] + dx;
    p[i + 1] = m.positions[i + 1] + dy;
    p[i + 2] = m.positions[i + 2] + dz;
  }
  return { positions: p, indices: m.indices };
}
