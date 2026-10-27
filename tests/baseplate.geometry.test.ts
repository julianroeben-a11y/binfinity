// Builds real geometry with OpenCascade (WASM) in Node.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { measureVolume, setOC } from "replicad";
import { buildBaseplate } from "../src/models/baseplate/build";
import { baseplateSchema } from "../src/models/baseplate/schema";
import { defaults, sanitize } from "../src/models/types";
import { weld } from "../src/export/mesh";

const params = (over: Record<string, unknown> = {}) => sanitize(baseplateSchema, { ...defaults(baseplateSchema), ...over });

beforeAll(async () => {
  setOC(await opencascade());
}, 60_000);

/** Every edge of a closed mesh is shared by exactly two triangles. */
function isWatertight(indices: Uint32Array): boolean {
  const edges = new Map<string, number>();
  for (let i = 0; i < indices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[i + k];
      const b = indices[i + ((k + 1) % 3)];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return [...edges.values()].every((n) => n === 2);
}

/** Volume enclosed by a mesh; positive only if all triangles face outwards. */
function signedVolume(m: { positions: Float32Array; indices: Uint32Array }): number {
  const p = m.positions;
  let v = 0;
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3;
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
      - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
      + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}

describe("buildBaseplate", () => {
  it("builds a slim 2x2 plate with the standard footprint and height", () => {
    const { pieces, info } = buildBaseplate(params({ gridX: 2, gridY: 2 }));
    expect(pieces).toHaveLength(1);
    const bb = pieces[0].shape.boundingBox;
    expect(bb.width).toBeCloseTo(84, 2);
    expect(bb.height).toBeCloseTo(84, 2);
    expect(bb.depth).toBeCloseTo(4.65, 2);
    expect(info.size).toEqual([84, 84, 4.65]);
    // A slim plate is mostly air: far less than a solid slab.
    expect(measureVolume(pieces[0].shape)).toBeLessThan(84 * 84 * 4.65 * 0.4);
    const m = pieces[0].shape.mesh({ tolerance: 0.05, angularTolerance: 0.2 });
    const welded = weld(m.vertices, m.triangles);
    expect(isWatertight(welded.indices)).toBe(true);
    expect(signedVolume(welded) / measureVolume(pieces[0].shape)).toBeCloseTo(1, 1);
  }, 60_000);

  it("adds floor, magnets and screws on a solid plate", () => {
    const plain = buildBaseplate(params({ gridX: 1, gridY: 1, style: "solid", floor: 3 })).pieces[0].shape;
    const holes = buildBaseplate(params({ gridX: 1, gridY: 1, style: "solid", floor: 3, magnets: true, screws: true })).pieces[0].shape;
    expect(plain.boundingBox.depth).toBeCloseTo(7.65, 2);
    const magnetVolume = 4 * Math.PI * 3.25 ** 2 * 2.4;
    const removed = measureVolume(plain) - measureVolume(holes);
    expect(removed).toBeGreaterThan(magnetVolume);
    expect(removed).toBeLessThan(magnetVolume + 150); // magnets + one M3 countersink
    // The floor stays closed: roughly the slab minus one pocket.
    expect(measureVolume(plain)).toBeGreaterThan(42 * 42 * 3);
    const m = holes.mesh({ tolerance: 0.05, angularTolerance: 0.2 });
    expect(isWatertight(weld(m.vertices, m.triangles).indices)).toBe(true);
  }, 60_000);

  it("splits a drawer-sized plate into bed-sized pieces", () => {
    const { pieces } = buildBaseplate(params({ sizeMode: "drawer", drawerX: 300, drawerY: 200 }));
    expect(pieces.length).toBe(2);
    for (const p of pieces) {
      const bb = p.shape.boundingBox;
      expect(bb.width).toBeLessThanOrEqual(256);
      expect(bb.height).toBeLessThanOrEqual(256);
    }
    const total = pieces.reduce((a, p) => a + p.shape.boundingBox.width, 0);
    expect(total).toBeCloseTo(299.5, 1);
  }, 120_000);
});

describe("connectors", () => {
  const split = { sizeMode: "drawer", drawerX: 300, drawerY: 200, style: "solid", floor: 3 };

  it("adds dovetail tabs to one side and slots to the other", () => {
    const plain = buildBaseplate(params(split)).pieces;
    const puzzle = buildBaseplate(params({ ...split, connector: "puzzle" })).pieces;
    expect(puzzle).toHaveLength(2);
    const vol = (s: (typeof plain)[number]) => measureVolume(s.shape);
    // Left piece gains the tabs, right piece loses slightly more (clearance).
    expect(vol(puzzle[0])).toBeGreaterThan(vol(plain[0]));
    expect(vol(puzzle[1])).toBeLessThan(vol(plain[1]));
    const gained = vol(puzzle[0]) - vol(plain[0]);
    const lost = vol(plain[1]) - vol(puzzle[1]);
    expect(lost).toBeGreaterThan(gained * 0.9);
    // The tabs stick out past the seam.
    expect(puzzle[0].shape.boundingBox.width).toBeGreaterThan(plain[0].shape.boundingBox.width + 4);
    for (const pc of puzzle) {
      const m = pc.shape.mesh({ tolerance: 0.05, angularTolerance: 0.2 });
      expect(isWatertight(weld(m.vertices, m.triangles).indices)).toBe(true);
    }
  }, 120_000);

  it("drills matching pin holes on both sides", () => {
    const plain = buildBaseplate(params(split)).pieces;
    const pins = buildBaseplate(params({ ...split, connector: "pins" })).pieces;
    for (let i = 0; i < 2; i++) expect(measureVolume(pins[i].shape)).toBeLessThan(measureVolume(plain[i].shape));
  }, 120_000);

  it("ignores connectors on a plate that is not split", () => {
    const { pieces } = buildBaseplate(params({ style: "solid", connector: "puzzle" }));
    expect(pieces).toHaveLength(1);
  }, 60_000);
});
