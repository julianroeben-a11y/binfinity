// Drawer: baseplate plus placed parts, and the placement maths.
import { beforeAll, describe, expect, it } from "vitest";
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { buildDrawer } from "../src/models/drawer/build";
import { conflicts, drawerSchema, freeSpot, itemDiff, itemSchema, parseItems, type DrawerItem } from "../src/models/drawer/schema";
import { binSchema } from "../src/models/bin/schema";
import { defaults, sanitize } from "../src/models/types";
import { loadTestFont } from "./font";

const params = (items: DrawerItem[], over: Record<string, unknown> = {}) =>
  sanitize(drawerSchema, { ...defaults(drawerSchema), drawerX: 200, drawerY: 140, ...over, items: JSON.stringify(items) });

beforeAll(async () => {
  setOC(await opencascade());
  await loadTestFont();
}, 60_000);

describe("drawer placement", () => {
  const drawer = params([]);
  it("finds the first free spot row by row", () => {
    const items: DrawerItem[] = [{ m: "bin", x: 0, y: 0, p: { gridX: 2, gridY: 1 } }];
    expect(freeSpot(items, drawer, 4, 3, 2, 1)).toEqual([2, 0]);
    expect(freeSpot(items, drawer, 4, 3, 3, 1)).toEqual([0, 1]);
    expect(freeSpot(items, drawer, 2, 1, 1, 1)).toBeNull();
  });

  it("flags parts outside the grid or on top of others", () => {
    const items: DrawerItem[] = [
      { m: "bin", x: 0, y: 0, p: { gridX: 2 } },
      { m: "bin", x: 1, y: 0, p: {} },
      { m: "bin", x: 3, y: 2, p: { gridX: 2 } },
    ];
    expect(conflicts(items, drawer, 4, 3)).toEqual({ outside: [2], overlap: [1] });
  });

  it("keeps only changed settings and reads untrusted lists safely", () => {
    const p = sanitize(binSchema, { ...defaults(binSchema), gridX: 3, accent: true });
    expect(itemDiff("bin", p)).toEqual({ gridX: 3 });
    expect(parseItems("nonsense")).toEqual([]);
    expect(parseItems('[{"m":"bin","x":1.2,"y":0},{"m":"evil","x":0,"y":0}]')).toEqual([{ m: "bin", x: 1, y: 0, p: {} }]);
  });

  it("leaves drawer settings out of a part's form", () => {
    const keys = itemSchema("insert").groups.flatMap((g) => g.fields.map((f) => f.key));
    expect(keys).toContain("gridX");
    expect(keys).not.toContain("form");
    expect(keys).not.toContain("accent");
    expect(keys).not.toContain("fromBox");
  });
});

describe("buildDrawer", () => {
  it("places the parts on the baseplate cells", () => {
    // 200 × 140 mm minus 0.5 mm clearance: 4 × 3 cells, 31.5 and 13.5 mm left over, centred.
    const items: DrawerItem[] = [
      { m: "bin", x: 0, y: 0, p: { gridX: 2, heightUnits: 3 } },
      { m: "insert", x: 2, y: 1, p: { gridX: 2, gridY: 2 } },
    ];
    const { pieces, info } = buildDrawer(params(items));
    expect(pieces.map((p) => p.name)).toEqual(["drawer_baseplate", "bin_2x1x3u", expect.stringMatching(/^insert_2x2/)]);
    const [[x0, y0]] = pieces[1].shape.boundingBox.bounds;
    expect(x0).toBeCloseTo(15.75 + 0.25, 1);
    expect(y0).toBeCloseTo(6.75 + 0.25, 1);
    const [[ix0, iy0]] = pieces[2].shape.boundingBox.bounds;
    expect(ix0).toBeCloseTo(15.75 + 84 + 0.25, 1);
    expect(iy0).toBeCloseTo(6.75 + 42 + 0.25, 1);
    expect(info.facts[0]).toMatchObject({ key: "fact.drawer", vars: { x: 4, y: 3, n: 2, free: 6 } });
    expect(info.warnings).toEqual([]);
  }, 60_000);

  it("warns about parts taller than the drawer", () => {
    const { info } = buildDrawer(params([{ m: "bin", x: 0, y: 0, p: { heightUnits: 10 } }], { drawerZ: 40 }));
    expect(info.warnings.some((w) => w.key === "warn.drawerTooTall")).toBe(true);
  }, 60_000);
});
