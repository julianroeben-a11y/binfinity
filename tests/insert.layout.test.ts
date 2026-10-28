import { describe, expect, it } from "vitest";
import { layoutItems, layoutShelves, layoutSizes, parseSizes } from "../src/models/insert/layout";

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("layoutItems", () => {
  it("fills a grid and stays inside the area", () => {
    const { centres, pitch } = layoutItems(80, 40, 10, 10, 5);
    expect(pitch).toEqual([15, 15]);
    expect(centres.length).toBe(5 * 3);
    for (const [x, y] of centres) {
      expect(Math.abs(x) + 5).toBeLessThanOrEqual(40 + 1e-9);
      expect(Math.abs(y) + 5).toBeLessThanOrEqual(20 + 1e-9);
    }
  });

  it("centres the pattern", () => {
    const { centres } = layoutItems(50, 50, 10, 10, 5, true);
    const xs = centres.map(([x]) => x);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
  });

  it("keeps the pitch between staggered neighbours", () => {
    const { centres } = layoutItems(100, 100, 14, 14, 5, true);
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) expect(dist(centres[i], centres[j])).toBeGreaterThanOrEqual(19 - 1e-6);
    }
  });

  it("returns nothing when one item does not fit", () => {
    expect(layoutItems(10, 50, 12, 12, 2).centres).toEqual([]);
  });
});

describe("parseSizes", () => {
  it("reads lists, ranges and steps", () => {
    expect(parseSizes("2 3, 4.5;6", 0.5, 100)).toEqual([2, 3, 4.5, 6]);
    expect(parseSizes("2-5", 0.5, 100)).toEqual([2, 3, 4, 5]);
    expect(parseSizes("1-2/0.5 8 1.5", 0.5, 100)).toEqual([1, 1.5, 2, 8]);
    expect(parseSizes("abc 0.1 200 7", 0.5, 100)).toEqual([7]);
  });
});

describe("layoutSizes", () => {
  it("places items in rows without overlap and reports the rest", () => {
    const sizes = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const { items, missing } = layoutSizes(75, 33, sizes, 4);
    expect(items.length + missing.length).toBe(sizes.length);
    expect(missing.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(Math.abs(it.x) + it.size / 2).toBeLessThanOrEqual(37.5 + 1e-9);
      expect(Math.abs(it.y) + it.size / 2).toBeLessThanOrEqual(16.5 + 1e-9);
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        expect(dist([a.x, a.y], [b.x, b.y])).toBeGreaterThanOrEqual((a.size + b.size) / 2 + 4 - 1e-6);
      }
    }
  });
});

describe("layoutShelves", () => {
  it("keeps more room between items of different kinds", () => {
    const item = (kind: string) => ({ w: 3, d: 20, gap: 6, kind, kindGap: 14 });
    const { placed } = layoutShelves(100, 30, [item("sd"), item("sd"), item("usb")]);
    const [a, b, c] = placed.sort((p, q) => p.index - q.index);
    expect(b.x - a.x).toBeCloseTo(3 + 6);
    expect(c.x - b.x).toBeCloseTo(3 + 14);
  });
});
