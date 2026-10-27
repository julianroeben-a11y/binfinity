import { describe, expect, it } from "vitest";
import { arrangeOnPlates, PLATE_GAP } from "../src/models/plates";

describe("arrangeOnPlates", () => {
  it("centres a single piece on the bed", () => {
    const l = arrangeOnPlates([[100, 50]], 256, 256);
    expect(l.plates).toEqual([[0, 0]]);
    expect(l.placements[0]).toEqual({ plate: 0, x: 78, y: 103 });
  });

  it("puts pieces side by side while they fit", () => {
    const l = arrangeOnPlates([[100, 80], [100, 80]], 256, 256);
    expect(l.plates).toHaveLength(1);
    expect(l.placements[1].x - l.placements[0].x).toBe(105);
  });

  it("opens more beds when needed", () => {
    const l = arrangeOnPlates([[250, 250], [250, 250], [250, 250]], 256, 256);
    expect(l.plates).toHaveLength(3);
    expect(l.plates[1][0]).toBeCloseTo(256 * (1 + PLATE_GAP));
    expect(l.placements.map((p) => p.plate)).toEqual([0, 1, 2]);
    // Every piece sits fully on its bed.
    l.placements.forEach((p) => {
      const [ox, oy] = l.plates[p.plate];
      expect(p.x).toBeGreaterThanOrEqual(ox);
      expect(p.y).toBeGreaterThanOrEqual(oy);
      expect(p.x + 250).toBeLessThanOrEqual(ox + 256);
    });
  });

  it("flags pieces larger than the bed", () => {
    const l = arrangeOnPlates([[300, 100]], 256, 256);
    expect(l.oversized).toEqual([0]);
  });
});
