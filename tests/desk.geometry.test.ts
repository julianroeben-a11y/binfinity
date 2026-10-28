// Desk organizer: sloped block with module pockets and printed inlays.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { measureVolume, setOC, type Shape3D } from "replicad";
import { buildDesk } from "../src/models/desk/build";
import { deskSchema } from "../src/models/desk/schema";
import { defaults, sanitize, ParamError } from "../src/models/types";
import { weld } from "../src/export/mesh";

const params = (over: Record<string, unknown> = {}) => sanitize(deskSchema, { ...defaults(deskSchema), ...over });

beforeAll(async () => {
  setOC(await opencascade());
}, 60_000);

function watertight(shape: Shape3D): boolean {
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
  return [...edges.values()].every((n) => n === 2);
}

describe("buildDesk", () => {
  it("builds the body and one inlay per filled module", () => {
    const { pieces, info } = buildDesk(params());
    expect(pieces.map((p) => p.name)).toEqual(["desk", "desk_inlay_1_pens", "desk_inlay_2_pocket", "desk_inlay_3_cards", "desk_inlay_4_holes"]);
    expect(info.warnings).toEqual([]);
    const [[, , z0], [x1, y1, z1]] = pieces[0].shape.boundingBox.bounds;
    expect(z0).toBeCloseTo(0, 1);
    expect(x1).toBeCloseTo(200, 1);
    expect(y1).toBeCloseTo(110, 1);
    // 55 mm at the front, rising by tan(20°) over 110 mm (a little less with the rounded edge).
    const back = 55 + 110 * Math.tan((20 * Math.PI) / 180);
    expect(z1).toBeLessThanOrEqual(back + 0.01);
    expect(z1).toBeGreaterThan(back - 1.5);
    expect(watertight(pieces[0].shape)).toBe(true);
    for (const inlay of pieces.slice(1)) {
      // Flat on the bed for printing, as high as the pocket is deep.
      const [[, , iz0], [, , iz1]] = inlay.shape.boundingBox.bounds;
      expect(iz0).toBeCloseTo(0, 2);
      expect(iz1).toBeCloseTo(40, 1);
      expect(measureVolume(inlay.shape), inlay.name).toBeGreaterThan(1000);
      expect(inlay.placement?.rotX).toBeCloseTo((20 * Math.PI) / 180);
    }
  }, 120_000);

  it("leaves empty modules as open pockets and makes pockets shallower when needed", () => {
    const { pieces, info } = buildDesk(params({ cols: 1, rows: 1, module1: "empty", frontHeight: 30, angle: 0, ribs: false }));
    expect(pieces).toHaveLength(1);
    expect(info.warnings.some((w) => w.key === "warn.deskShallow")).toBe(true);
  }, 60_000);

  it("rejects modules that get too small", () => {
    expect(() => buildDesk(params({ width: 60, cols: 4 }))).toThrow(ParamError);
  });
});
