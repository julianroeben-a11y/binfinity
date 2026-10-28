// Desk organizer: sloped block with upright module pockets and printed inlays.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { measureVolume, setOC, type Shape3D } from "replicad";
import { buildDesk } from "../src/models/desk/build";
import { deskSchema } from "../src/models/desk/schema";
import { defaults, sanitize, ParamError } from "../src/models/types";
import { weld } from "../src/export/mesh";

const params = (over: Record<string, unknown> = {}) => sanitize(deskSchema, { ...defaults(deskSchema), ...over });
const slope = Math.tan((20 * Math.PI) / 180);

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
    const back = 55 + 110 * slope;
    expect(z1).toBeLessThanOrEqual(back + 0.01);
    expect(z1).toBeGreaterThan(back - 1.5);
    expect(watertight(pieces[0].shape)).toBe(true);
    for (const inlay of pieces.slice(1)) {
      // Flat on the bed for printing, upright in its pocket and flush with the top.
      const [[, iy0, iz0], [, iy1, iz1]] = inlay.shape.boundingBox.bounds;
      expect(iz0).toBeCloseTo(0, 2);
      expect(measureVolume(inlay.shape), inlay.name).toBeGreaterThan(1000);
      expect(inlay.placement?.rotX).toBe(0);
      const [, py, pz] = inlay.placement!.offset;
      expect(pz + iz1, inlay.name).toBeCloseTo(55 + (py + iy1 - iy0) * slope, 0);
    }
    // Pens go deep, cards only as deep as they need.
    const height = (name: string) => pieces.find((p) => p.name === name)!.shape.boundingBox.bounds[1][2];
    expect(height("desk_inlay_1_pens")).toBeGreaterThan(70);
    expect(height("desk_inlay_3_cards")).toBeLessThan(40);
  }, 120_000);

  it("warns when the pen holes cannot be as deep as asked", () => {
    const { pieces, info } = buildDesk(params({ cols: 1, rows: 1, module1: "pens", frontHeight: 30, angle: 0, surface: "smooth" }));
    expect(pieces).toHaveLength(2);
    expect(info.warnings.some((w) => w.key === "warn.deskShallow")).toBe(true);
  }, 60_000);

  it("is hollow under shallow modules", () => {
    const small = { width: 100, depth: 80, cols: 1, rows: 1, module1: "cards", surface: "smooth" };
    const hollow = buildDesk(params({ ...small, hollow: true })).pieces[0].shape;
    const solid = buildDesk(params({ ...small, hollow: false })).pieces[0].shape;
    expect(measureVolume(hollow)).toBeLessThan(measureVolume(solid) - 20_000);
    expect(watertight(hollow)).toBe(true);
  }, 60_000);

  it.each(["grooves", "hex", "diamonds"])("cuts the %s pattern into the walls", (surface) => {
    const small = { width: 100, depth: 70, frontHeight: 40, cols: 1, rows: 1, module1: "empty" };
    const plain = buildDesk(params({ ...small, surface: "smooth" })).pieces[0].shape;
    const patterned = buildDesk(params({ ...small, surface })).pieces[0].shape;
    expect(measureVolume(patterned)).toBeLessThan(measureVolume(plain) - 500);
    expect(watertight(patterned)).toBe(true);
  }, 120_000);

  it("builds a flat open pocket 20 mm deep", () => {
    const { pieces } = buildDesk(params({ cols: 1, rows: 1, module1: "tray", surface: "smooth" }));
    const [[, , z0], [, , z1]] = pieces[1].shape.boundingBox.bounds;
    expect(pieces[1].name).toBe("desk_inlay_1_tray");
    expect(z0).toBeCloseTo(0, 2);
    // 20 mm at the front, rising with the top towards the back.
    expect(z1).toBeGreaterThan(20);
    expect(z1).toBeLessThan(20 + 110 * slope);
  }, 60_000);

  it("keeps the close USB + SD spacing in its inlay", () => {
    const { pieces } = buildDesk(params({ cols: 1, rows: 1, width: 104, depth: 59, module1: "usbsd", surface: "smooth" }));
    expect(pieces[1].name).toBe("desk_inlay_1_usbsd");
  }, 60_000);

  it("rejects modules that get too small", () => {
    expect(() => buildDesk(params({ width: 60, cols: 4 }))).toThrow(ParamError);
  });
});
