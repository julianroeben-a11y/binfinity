// Mixed inserts: one even block per kind, blocks spread evenly.
import { describe, expect, it } from "vitest";
import { layoutBlocks, type BlockKind } from "../src/models/insert/blocks";

// USB-A stick and SD card as the insert lays them out (long side along X), with 0.4 mm play.
const usb = (n: number, extra: Partial<BlockKind> = {}): BlockKind => ({ footX: 21.4, footY: 10.9, ox: 12.4, oy: 4.9, gapX: 2, gapY: 6, finger: 6, n, turnable: true, ...extra });
const sd = (n: number, extra: Partial<BlockKind> = {}): BlockKind => ({ footX: 24.4, footY: 2.5, ox: 24.4, oy: 2.5, gapX: 2, gapY: 8, finger: 8, n, turnable: true, ...extra });

describe("layoutBlocks", () => {
  it("places everything when it fits, centred", () => {
    const { placed, counts } = layoutBlocks(75, 33, [usb(4, { cols: 2 }), sd(2, { oneRow: true })]);
    expect(counts).toEqual([4, 2]);
    expect(placed).toHaveLength(6);
    const xs = placed.map((p) => p.x);
    const ys = placed.map((p) => p.y);
    expect(Math.min(...ys) + Math.max(...ys)).toBeCloseTo(0, 6);
    // The SD cards stand side by side (turned), not end to end.
    expect(placed.filter((p) => p.kind === 1).every((p) => p.turned)).toBe(true);
    expect(Math.max(...xs)).toBeLessThan(75 / 2);
  });

  it("shares the free room evenly between the openings and to the edges", () => {
    const ax = 75;
    const { placed } = layoutBlocks(ax, 33, [usb(4, { cols: 2 }), sd(2, { oneRow: true })]);
    const usbRight = Math.max(...placed.filter((p) => p.kind === 0).map((p) => p.x + (p.turned ? 4.9 : 12.4) / 2));
    const usbLeft = Math.min(...placed.filter((p) => p.kind === 0).map((p) => p.x - (p.turned ? 4.9 : 12.4) / 2));
    const sdXs = placed.filter((p) => p.kind === 1).map((p) => p.x);
    const sdLeft = Math.min(...sdXs) - 2.5 / 2;
    const sdRight = Math.max(...sdXs) + 2.5 / 2;
    const left = usbLeft + ax / 2;
    const between = sdLeft - usbRight;
    const right = ax / 2 - sdRight;
    // Equal where the bodies allow it; never less than the finger room between bodies.
    expect(between).toBeGreaterThanOrEqual(4.5 + 8 - 1e-6);
    expect(Math.abs(left - right)).toBeLessThan(5);
    expect(between).toBeCloseTo(Math.max(left, right, between), 6);
  });

  it("leaves out as few items as possible when not everything fits", () => {
    const { counts } = layoutBlocks(75, 33, [usb(4), sd(3)]);
    expect(counts[0] + counts[1]).toBe(6);
    expect(counts[0]).toBe(4);
  });

  it("keeps a row of cards side by side next to other blocks", () => {
    const { placed } = layoutBlocks(117, 33, [usb(4), sd(3), { footX: 11.4, footY: 1.4, ox: 11.4, oy: 1.4, gapX: 2, gapY: 6, finger: 6, n: 1, turnable: true }]);
    const ys = new Set(placed.filter((p) => p.kind === 1).map((p) => p.y.toFixed(3)));
    expect(placed).toHaveLength(8);
    expect(ys.size).toBe(1);
  });
});
