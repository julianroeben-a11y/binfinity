import { describe, expect, it } from "vitest";
import { baseplateSchema } from "../src/models/baseplate/schema";
import { layoutBaseplate, splitAxis } from "../src/models/baseplate/layout";
import { defaults, sanitize, ParamError } from "../src/models/types";

const params = (over: Record<string, unknown> = {}) => sanitize(baseplateSchema, { ...defaults(baseplateSchema), ...over });

describe("splitAxis", () => {
  it("keeps a plate that fits the bed in one piece", () => {
    expect(splitAxis(6, 0, 0, 256)).toEqual([6]); // 252 mm
  });

  it("splits evenly when the plate is larger than the bed", () => {
    const s = splitAxis(7, 0, 0, 256);
    expect(s.reduce((a, b) => a + b)).toBe(7);
    expect(s.length).toBe(2);
    expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1);
  });

  it("accounts for padding on the outer pieces", () => {
    // 6 cells = 252 mm, plus 10 mm padding no longer fits 256 mm.
    const s = splitAxis(6, 10, 0, 256);
    expect(s.length).toBe(2);
    expect(s[0] * 42 + 10).toBeLessThanOrEqual(256);
  });

  it("throws when not even one cell fits", () => {
    expect(() => splitAxis(2, 0, 0, 40)).toThrow(ParamError);
  });
});

describe("layoutBaseplate", () => {
  it("computes cells and padding from a drawer size", () => {
    const l = layoutBaseplate(params({ sizeMode: "drawer", drawerX: 300, drawerY: 400, clearance: 0.5 }));
    expect(l.x.cells).toBe(7); // 299.5 / 42
    expect(l.y.cells).toBe(9); // 399.5 / 42
    expect(l.x.padStart).toBeCloseTo((299.5 - 294) / 2);
    expect(l.width).toBeCloseTo(299.5);
    expect(l.depth).toBeCloseTo(399.5);
  });

  it("puts all padding on one side when aligned", () => {
    const l = layoutBaseplate(params({ sizeMode: "drawer", drawerX: 300, alignX: "start" }));
    expect(l.x.padStart).toBe(0);
    expect(l.x.padEnd).toBeCloseTo(5.5);
  });

  it("produces pieces that tile the plate and fit the bed", () => {
    const l = layoutBaseplate(params({ sizeMode: "drawer", drawerX: 600, drawerY: 450 }));
    expect(l.pieces.length).toBe(l.x.split.length * l.y.split.length);
    for (const p of l.pieces) {
      expect(p.x1 - p.x0).toBeLessThanOrEqual(256);
      expect(p.y1 - p.y0).toBeLessThanOrEqual(256);
    }
    const area = l.pieces.reduce((a, p) => a + (p.x1 - p.x0) * (p.y1 - p.y0), 0);
    expect(area).toBeCloseTo(l.width * l.depth);
  });

  it("rejects drawers smaller than one cell", () => {
    expect(() => layoutBaseplate(params({ sizeMode: "drawer", drawerX: 42, clearance: 1 }))).toThrow(ParamError);
  });
});

describe("sanitize", () => {
  it("clamps numbers and ignores unknown options", () => {
    const p = sanitize(baseplateSchema, { gridX: "999", style: "bogus", magnets: "true" });
    expect(p.gridX).toBe(40);
    expect(p.style).toBe("slim");
    expect(p.magnets).toBe(true);
  });
});
