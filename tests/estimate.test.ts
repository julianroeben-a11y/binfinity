import { describe, expect, it } from "vitest";
import { colourChanges, estimate } from "../src/models/estimate";

describe("print estimate", () => {
  it("is in the range a slicer gives for a 1x1x3 bin", () => {
    // Volume and surface area of the default 1x1x3 bin.
    const { grams, seconds } = estimate([{ volume: 14056, area: 10059, height: 25.4, changes: 0 }]);
    expect(grams).toBeGreaterThan(9);
    expect(grams).toBeLessThan(14);
    expect(seconds / 60).toBeGreaterThan(15);
    expect(seconds / 60).toBeLessThan(35);
  });

  it("prints thin walls solid and fills thick parts at 20 %", () => {
    expect(estimate([{ volume: 1000, area: 2000, height: 1, changes: 0 }]).grams).toBeCloseTo(1.24);
    const block = estimate([{ volume: 1e6, area: 6e4, height: 100, changes: 0 }]).grams;
    expect(block).toBeCloseTo((48000 + 0.2 * 952000) * 1.24e-3);
  });

  it("counts the colour changes", () => {
    expect(colourChanges(false, true, 0.6)).toBe(0);
    expect(colourChanges(true, false, 0.6)).toBe(1);
    expect(colourChanges(true, true, 0.6)).toBe(7);
  });
});
