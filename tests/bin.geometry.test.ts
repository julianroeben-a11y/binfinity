// Builds real bin geometry with OpenCascade (WASM) in Node.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { makeBox, measureVolume, setOC, type Shape3D } from "replicad";
import { buildBin } from "../src/models/bin/build";
import { binSchema } from "../src/models/bin/schema";
import { defaults, sanitize, ParamError } from "../src/models/types";
import { weld } from "../src/export/mesh";

const params = (over: Record<string, unknown> = {}) => sanitize(binSchema, { ...defaults(binSchema), ...over });

beforeAll(async () => {
  setOC(await opencascade());
}, 60_000);

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

function checkMesh(shape: Parameters<typeof measureVolume>[0]) {
  const m = (shape as any).mesh({ tolerance: 0.05, angularTolerance: 0.2 });
  expect(isWatertight(weld(m.vertices, m.triangles).indices)).toBe(true);
}

/** Cross-section area of a shape just below `z`, from a thin slice. */
function areaBelow(shape: Shape3D, z: number): number {
  const t = 0.02;
  return measureVolume(shape.clone().intersect(makeBox([-500, -500, z - t], [500, 500, z]))) / t;
}

describe("buildBin", () => {
  it("builds a 2x1x3 bin with lip at the Gridfinity footprint", () => {
    const { pieces } = buildBin(params());
    const bb = pieces[0].shape.boundingBox;
    expect(bb.width).toBeCloseTo(83.5, 2);
    expect(bb.height).toBeCloseTo(41.5, 2);
    expect(bb.depth).toBeCloseTo(21 + 4.4, 2);
    expect(bb.bounds[0][0]).toBeCloseTo(0, 3);
    // Hollow: well below the volume of the solid envelope.
    expect(measureVolume(pieces[0].shape)).toBeLessThan(83.5 * 41.5 * 25.4 * 0.45);
    checkMesh(pieces[0].shape);
  }, 60_000);

  it("is lower without lip and keeps the height in units", () => {
    const { pieces } = buildBin(params({ lip: false, heightUnits: 4 }));
    expect(pieces[0].shape.boundingBox.depth).toBeCloseTo(28, 2);
  }, 60_000);

  it("rounds the top edges of walls and dividers", () => {
    for (const over of [{ lip: false, divX: 3, divY: 2 }, { lip: true }]) {
      const { pieces } = buildBin(params(over));
      const shape = pieces[0].shape;
      const top = shape.boundingBox.bounds[1][2];
      // With rounded edges the very top is much narrower than 1 mm below it.
      expect(areaBelow(shape, top - 0.01)).toBeLessThan(areaBelow(shape, top - 1) * 0.5);
      checkMesh(shape);
    }
  }, 120_000);

  it("rounds the divider tops below the stacking lip", () => {
    const plain = buildBin(params({ lip: true, divX: 3 })).pieces[0].shape;
    // Dividers end 0.5 mm under the lip support (21 − 1.4 − 0.5 = 19.1 mm) in a half-round.
    const near = areaBelow(plain, 19.09);
    const lower = areaBelow(plain, 18);
    // Wall ring only near the top of the dividers, wall ring plus dividers lower down.
    expect(lower - near).toBeGreaterThan(2 * 1.2 * 39 * 0.8);
    checkMesh(plain);
  }, 120_000);

  it("cuts honeycomb openings through the outer walls", () => {
    for (const over of [{ heightUnits: 6 }, { heightUnits: 6, divX: 3, divY: 2, label: true, scoop: true, lip: false }]) {
      const plain = buildBin(params(over));
      const comb = buildBin(params({ ...over, honeycomb: true }));
      const fact = comb.info.facts.find((f) => f.key === "fact.honeycomb");
      expect(fact).toBeDefined();
      const n = fact!.vars!.n as number;
      expect(n).toBeGreaterThan(4);
      const hole = (Math.sqrt(3) / 2) * 8 * 8 * 1.2;
      const removed = measureVolume(plain.pieces[0].shape) - measureVolume(comb.pieces[0].shape);
      expect(removed).toBeGreaterThan(n * hole * 0.95);
      expect(removed).toBeLessThan(n * hole * 1.4);
      checkMesh(comb.pieces[0].shape);
    }
  }, 120_000);

  it("adds dividers, scoop and label as extra material", () => {
    const plain = measureVolume(buildBin(params()).pieces[0].shape);
    const divided = buildBin(params({ divX: 3, divY: 2, scoop: true, label: true }));
    expect(measureVolume(divided.pieces[0].shape)).toBeGreaterThan(plain + 500);
    checkMesh(divided.pieces[0].shape);
  }, 60_000);

  it("cuts magnet and screw holes into every foot", () => {
    const plain = measureVolume(buildBin(params({ gridX: 1 })).pieces[0].shape);
    const holes = buildBin(params({ gridX: 1, magnets: true, screws: true })).pieces[0].shape;
    const magnets = 4 * Math.PI * 3.25 ** 2 * 2.4;
    const removed = plain - measureVolume(holes);
    expect(removed).toBeGreaterThan(magnets);
    expect(removed).toBeLessThan(magnets + 4 * Math.PI * 1.5 ** 2 * 6);
    checkMesh(holes);
  }, 60_000);

  it("rejects bins that are too low for the floor", () => {
    expect(() => buildBin(params({ heightMode: "mm", heightMm: 12, floor: 6 }))).toThrow(ParamError);
  });
});
