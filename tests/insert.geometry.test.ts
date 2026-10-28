// Builds real insert geometry with OpenCascade (WASM) in Node.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { measureVolume, setOC, type Shape3D } from "replicad";
import { buildInsert } from "../src/models/insert/build";
import { insertSchema } from "../src/models/insert/schema";
import { defaults, sanitize, ParamError } from "../src/models/types";
import { weld } from "../src/export/mesh";

const preset = (name: string) => {
  const sel = insertSchema.groups[0].fields[0];
  return sel.type === "select" ? sel.presets![name] : {};
};
const params = (over: Record<string, unknown> = {}) => sanitize(insertSchema, { ...defaults(insertSchema), ...over });

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

const count = (info: { facts: { key: string; vars?: Record<string, string | number> }[] }) =>
  Number(info.facts.find((f) => f.key === "fact.insertItems")!.vars!.n);

describe("buildInsert", () => {
  it("defaults schema matches the default preset", () => {
    const d = defaults(insertSchema);
    for (const [k, v] of Object.entries(preset("hexbit"))) expect(d[k]).toBe(v);
  });

  it("builds a hex bit bin with the expected number of holes", () => {
    const { pieces, info } = buildInsert(params({ ...preset("hexbit"), gridX: 2, gridY: 1, heightMode: "units", heightUnits: 3 }));
    const n = count(info);
    expect(n).toBe(10);
    const solid = buildInsert(params({ ...preset("hexbit"), gridX: 2, gridY: 1, heightMode: "units", heightUnits: 3, holeDepth: 2 }));
    // Volume removed by the holes matches n hexagonal prisms (plus chamfers).
    const s = 6.35 + 0.4;
    const hex = (Math.sqrt(3) / 2) * s * s;
    const removed = measureVolume(solid.pieces[0].shape) - measureVolume(pieces[0].shape);
    expect(removed).toBeGreaterThan(n * hex * 8 * 0.95);
    expect(removed).toBeLessThan(n * hex * 8 * 1.3);
    expect(watertight(pieces[0].shape)).toBe(true);
  });

  it("keeps router bit heads apart", () => {
    const { info } = buildInsert(params({ ...preset("shank8"), gridX: 3, gridY: 3 }));
    const pitch = Number(info.facts.find((f) => f.key === "fact.insertItems")!.vars!.x);
    expect(pitch).toBeGreaterThanOrEqual(20 + 8);
    expect(count(info)).toBe(16);
  }, 60_000);

  it("sizes from 1x1 to large", () => {
    expect(count(buildInsert(params({ ...preset("aa"), gridX: 1, gridY: 1 })).info)).toBeGreaterThan(0);
    const big = buildInsert(params({ ...preset("microsd"), gridX: 4, gridY: 3, magnets: true }));
    expect(watertight(big.pieces[0].shape)).toBe(true);
  }, 120_000);

  it("builds slots as a loose insert", () => {
    const { pieces, info } = buildInsert(params({ ...preset("sd"), form: "loose", width: 80, length: 60 }));
    expect(count(info)).toBeGreaterThan(5);
    const [min, max] = pieces[0].shape.boundingBox.bounds;
    expect(max[0] - min[0]).toBeCloseTo(80, 1);
    expect(max[2] - min[2]).toBeCloseTo(1.5 + 14, 1);
    expect(watertight(pieces[0].shape)).toBe(true);
  }, 60_000);

  it("builds a drill set with one hole per size", () => {
    const { pieces, info } = buildInsert(params({ ...preset("drills"), sizes: "2-20", gridX: 4, gridY: 2 }));
    const set = info.facts.find((f) => f.key === "fact.insertSet")!;
    expect(set.vars).toMatchObject({ n: 19, from: 2, to: 20 });
    expect(info.warnings).toEqual([]);
    expect(watertight(pieces[0].shape)).toBe(true);
    const small = buildInsert(params({ ...preset("drills"), sizes: "2-20", gridX: 1, gridY: 1 }));
    expect(small.info.warnings.some((w) => w.key === "warn.insertMissing")).toBe(true);
  }, 60_000);

  it("warns when the chosen height is too low", () => {
    const { info } = buildInsert(params({ ...preset("aa"), heightMode: "units", heightUnits: 2 }));
    expect(info.warnings.some((w) => w.key === "warn.insertShallow")).toBe(true);
  }, 60_000);

  it("rejects an insert where nothing fits", () => {
    expect(() => buildInsert(params({ form: "loose", width: 10, length: 10, ...preset("shank12") }))).toThrow(ParamError);
  });
});

describe("buildInsert mix", () => {
  it("fits every item into the smallest bin", () => {
    const { pieces, info } = buildInsert(params({ preset: "mix", opening: "mix" }));
    expect(info.facts.find((f) => f.key === "fact.insertMix")!.vars).toMatchObject({ n: 8, kinds: 3 });
    expect(info.warnings).toEqual([]);
    expect(pieces[0].name.startsWith("insert_")).toBe(true);
    expect(watertight(pieces[0].shape)).toBe(true);
    // One unit less in either direction would not take everything.
    const [gx, gy] = pieces[0].name.split("_")[1].split("x").map(Number);
    for (const [x, y] of [[gx - 1, gy], [gx, gy - 1]]) {
      if (x < 1 || y < 1) continue;
      const smaller = buildInsert(params({ opening: "mix", autoSize: false, gridX: x, gridY: y }));
      expect(smaller.info.warnings.some((w) => w.key === "warn.insertMixMissing")).toBe(true);
    }
  }, 120_000);

  it("reports items that do not fit a fixed size", () => {
    const { info } = buildInsert(params({ opening: "mix", autoSize: false, gridX: 1, gridY: 1, count_aa: 10 }));
    expect(info.warnings.some((w) => w.key === "warn.insertMixMissing")).toBe(true);
  }, 60_000);

  it("asks for items when all counts are zero", () => {
    expect(() => buildInsert(params({ opening: "mix", count_usba: 0, count_sd: 0, count_microsd: 0 }))).toThrow(ParamError);
  });
});
