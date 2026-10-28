import { describe, expect, it } from "vitest";
import { boxCompartment, boxSchema } from "../src/models/box/schema";
import { insertSchema } from "../src/models/insert/schema";
import { defaults, sanitize, type ActionField } from "../src/models/types";

const box = (over: Record<string, unknown> = {}) => sanitize(boxSchema, { ...defaults(boxSchema), ...over });
const fromBox = insertSchema.groups.flatMap((g) => g.fields).find((f): f is ActionField => f.key === "fromBox")!;

describe("loose insert from a box", () => {
  it("measures the inside of a box and of one compartment", () => {
    expect(boxCompartment(box())).toMatchObject({ w: 117, d: 77, radius: 3.5, height: 48.5 });
    const c = boxCompartment(box({ divX: 2, sizeMode: "inner", width: 100, lid: "lift", lidLip: 5 }));
    expect(c.w).toBeCloseTo((100 - 1.2) / 2);
    expect(c.d).toBe(80);
    expect(c.height).toBe(45);
  });

  it("sizes the insert with play and a matching corner", () => {
    const p = fromBox.run(defaults(insertSchema), { box: box() });
    expect(p).toEqual({ width: 116, length: 76, cornerRadius: 3.5 });
    // Without box settings the defaults are taken.
    expect(fromBox.run(defaults(insertSchema), {})).toEqual(p);
  });

  it("fits a square into a round box", () => {
    const p = fromBox.run(defaults(insertSchema), { box: box({ shape: "round", diameter: 80 }) });
    expect(p.width).toBeCloseTo(77 / Math.SQRT2 - 1, 0);
    expect(p.width).toBe(p.length);
  });
});
