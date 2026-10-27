import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { weld } from "../src/export/mesh";
import { write3mf } from "../src/export/threemf";
import { writeStl } from "../src/export/stl";

// Two triangles of a unit square with duplicated corner vertices, as OCCT emits them.
const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0];
const indices = [0, 1, 2, 3, 4, 5];

describe("weld", () => {
  it("merges duplicate vertices", () => {
    const m = weld(positions, indices);
    expect(m.positions.length / 3).toBe(4);
    expect(Array.from(m.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it("drops degenerate triangles", () => {
    const m = weld([0, 0, 0, 0, 0, 0, 1, 0, 0], [0, 1, 2]);
    expect(m.indices.length).toBe(0);
  });
});

describe("3MF", () => {
  it("writes a valid package with one object per part", () => {
    const m = weld(positions, indices);
    const zip = unzipSync(write3mf([{ name: "a", mesh: m }, { name: "b<&>", mesh: m }]));
    expect(Object.keys(zip).sort()).toEqual(["3D/3dmodel.model", "[Content_Types].xml", "_rels/.rels"]);
    const xml = strFromU8(zip["3D/3dmodel.model"]);
    expect(xml).toContain('unit="millimeter"');
    expect(xml.match(/<object /g)?.length).toBe(2);
    expect(xml.match(/<item /g)?.length).toBe(2);
    expect(xml).toContain('name="b&lt;&amp;&gt;"');
    expect(xml.match(/<vertex /g)?.length).toBe(8);
  });
});

describe("STL", () => {
  it("writes a binary STL with the right size and normals", () => {
    const m = weld(positions, indices);
    const bytes = writeStl(m);
    expect(bytes.length).toBe(84 + 2 * 50);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(80, true)).toBe(2);
    expect(view.getFloat32(84 + 8, true)).toBeCloseTo(1); // normal z of first triangle
  });
});
