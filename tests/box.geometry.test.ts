// Builds real box geometry with OpenCascade (WASM) in Node.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { makeBox, measureVolume, setOC, type Shape3D } from "replicad";
import { buildBox } from "../src/models/box/build";
import { boxSchema } from "../src/models/box/schema";
import { defaults, sanitize, ParamError } from "../src/models/types";
import { weld } from "../src/export/mesh";

const params = (over: Record<string, unknown> = {}) => sanitize(boxSchema, { ...defaults(boxSchema), ...over });

beforeAll(async () => {
  setOC(await opencascade());
}, 60_000);

function expectWatertight(shape: Shape3D) {
  const m = shape.mesh({ tolerance: 0.05, angularTolerance: 0.2 });
  const { indices } = weld(m.vertices, m.triangles);
  const edges = new Map<string, number>();
  for (let i = 0; i < indices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[i + k];
      const b = indices[i + ((k + 1) % 3)];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((n) => n === 2)).toBe(true);
}

/** Cross-section area of a shape just below `z`, from a thin slice. */
function areaBelow(shape: Shape3D, z: number): number {
  const t = 0.02;
  return measureVolume(shape.clone().intersect(makeBox([-500, -500, z - t], [500, 500, z]))) / t;
}

describe("buildBox", () => {
  it("builds a rectangular box with the given outer size", () => {
    const { pieces } = buildBox(params());
    const bb = pieces[0].shape.boundingBox;
    expect([bb.width, bb.height, bb.depth].map((v) => Math.round(v * 100) / 100)).toEqual([120, 80, 50]);
    const shell = 120 * 80 * 50 - (120 - 3.2) * (80 - 3.2) * (50 - 1.6);
    // Rounded corners make it a little lighter than the square estimate.
    expect(measureVolume(pieces[0].shape) / shell).toBeGreaterThan(0.95);
    expect(measureVolume(pieces[0].shape) / shell).toBeLessThan(1);
    expectWatertight(pieces[0].shape);
  }, 60_000);

  it("adds the walls when sized by the inside", () => {
    const bb = buildBox(params({ sizeMode: "inner", width: 100, depth: 60, height: 40 })).pieces[0].shape.boundingBox;
    expect(bb.width).toBeCloseTo(103.2, 2);
    expect(bb.height).toBeCloseTo(63.2, 2);
    expect(bb.depth).toBeCloseTo(41.6, 2);
  }, 60_000);

  it("builds round and hexagonal boxes", () => {
    for (const shape of ["round", "hex"]) {
      const { pieces } = buildBox(params({ shape, diameter: 70, height: 30 }));
      expect(pieces[0].shape.boundingBox.depth).toBeCloseTo(30, 2);
      expectWatertight(pieces[0].shape);
    }
  }, 60_000);

  it("makes a stackable box whose foot fits into its own opening", () => {
    const { pieces } = buildBox(params({ stackable: true, divX: 2, divY: 2 }));
    const box = pieces[0].shape;
    // The bottom slice is narrower than the opening: outer minus 2 × (wall + clearance).
    const foot = box.clone().intersect(makeBox([-1, -1, 1], [200, 200, 1.5])).boundingBox;
    expect(foot.width).toBeCloseTo(120 - 2 * (1.6 + 0.3), 2);
    expect(foot.height).toBeCloseTo(80 - 2 * (1.6 + 0.3), 2);
    expectWatertight(box);
  }, 60_000);

  it("adds a lift-off lid as a second piece", () => {
    const { pieces } = buildBox(params({ lid: "lift" }));
    expect(pieces.map((p) => p.name)).toEqual(["box_120x80x50", "box_120x80x50_lid"]);
    const lid = pieces[1].shape.boundingBox;
    expect(lid.depth).toBeCloseTo(2 + 5, 2);
    expect(lid.bounds[0][0]).toBeGreaterThan(120);
    expectWatertight(pieces[1].shape);
  }, 60_000);

  it("rounds the rim and the divider tops and chamfers the bed edge", () => {
    for (const over of [{}, { divX: 3, divY: 2 }, { divX: 3, lid: "lift" }, { shape: "hex", diameter: 70 }]) {
      const { pieces } = buildBox(params(over));
      const box = pieces[0].shape;
      const h = box.boundingBox.bounds[1][2];
      expect(areaBelow(box, h - 0.01)).toBeLessThan(areaBelow(box, h - 1) * 0.6);
      // Bottom slab: the chamfer makes the very bottom smaller than 1 mm up.
      expect(areaBelow(box, 0.02)).toBeLessThan(areaBelow(box, 1.02));
      expectWatertight(box);
    }
  }, 120_000);

  it("rounds the dividers below a lid", () => {
    const { pieces } = buildBox(params({ divX: 3, lid: "lift" }));
    // Lid lip 5 mm, clearance 0.5: dividers end at 44.5 mm.
    const box = pieces[0].shape;
    expect(areaBelow(box, 44.49)).toBeLessThan(areaBelow(box, 43) - 2 * 1.2 * 76 * 0.8);
  }, 120_000);

  it("cuts honeycomb openings through the outer walls", () => {
    for (const over of [{}, { divX: 3, lid: "lift", stackable: true }]) {
      const plain = buildBox(params(over));
      const comb = buildBox(params({ ...over, honeycomb: true }));
      const n = comb.info.facts.find((f) => f.key === "fact.honeycomb")!.vars!.n as number;
      expect(n).toBeGreaterThan(10);
      const hole = (Math.sqrt(3) / 2) * 8 * 8 * 1.6;
      const removed = measureVolume(plain.pieces[0].shape) - measureVolume(comb.pieces[0].shape);
      expect(removed).toBeGreaterThan(n * hole * 0.95);
      expect(removed).toBeLessThan(n * hole * 1.4);
      expectWatertight(comb.pieces[0].shape);
    }
  }, 120_000);

  it("rejects boxes that are too low", () => {
    expect(() => buildBox(params({ height: 5, floor: 4 }))).toThrow(ParamError);
  });
});
