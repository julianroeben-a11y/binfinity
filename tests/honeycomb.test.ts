import { describe, expect, it } from "vitest";
import { HONEYCOMB_WEB, honeycombCentres } from "../src/models/honeycomb";

describe("honeycombCentres", () => {
  it("keeps openings inside the band and clear of corners", () => {
    const pts = honeycombCentres(100, 5, 45, 8, 6, [], 0);
    expect(pts.length).toBeGreaterThan(20);
    const halfH = 8 / Math.sqrt(3);
    for (const [u, z] of pts) {
      expect(Math.abs(u) + 4).toBeLessThanOrEqual(50 - 6 + 1e-6);
      expect(z - halfH).toBeGreaterThanOrEqual(5 - 1e-6);
      expect(z + halfH).toBeLessThanOrEqual(45 + 1e-6);
    }
  });

  it("leaves the web between neighbours", () => {
    const pts = honeycombCentres(100, 0, 40, 8, 0, [], 0);
    for (const a of pts) {
      for (const b of pts) {
        if (a === b) continue;
        // Centres of pointy-top hexagons in a honeycomb are at least one pitch apart.
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(8 + HONEYCOMB_WEB - 1e-6);
      }
    }
  });

  it("skips openings near dividers", () => {
    const pts = honeycombCentres(100, 0, 40, 8, 0, [0], 5);
    expect(pts.every(([u]) => Math.abs(u) >= 4 + 5)).toBe(true);
  });

  it("returns nothing when the wall is too small", () => {
    expect(honeycombCentres(20, 0, 5, 8, 6, [], 0)).toEqual([]);
  });
});
