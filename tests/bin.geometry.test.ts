// Builds real bin geometry with OpenCascade (WASM) in Node.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { measureVolume, setOC } from "replicad";
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
