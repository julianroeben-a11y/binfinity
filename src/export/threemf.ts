// Minimal 3MF (core spec) writer. Each part becomes its own object and build
// item, so Bambu Studio / PrusaSlicer / Orca import them as separate objects
// that can be arranged on one or more plates.

import { strToU8, zipSync } from "fflate";
import type { Mesh } from "./mesh";

export interface ThreeMfPart {
  name: string;
  mesh: Mesh;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** Format a coordinate compactly: 4 decimals is 0.1 µm, far below printer resolution. */
function num(v: number): string {
  return (Math.round(v * 1e4) / 1e4).toString();
}

export function modelXml(parts: ThreeMfPart[], title = "Binfinity"): string {
  const out: string[] = [];
  out.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">`,
    `<metadata name="Title">${escapeXml(title)}</metadata>`,
    `<metadata name="Application">Binfinity</metadata>`,
    `<resources>`,
  );
  parts.forEach((part, i) => {
    out.push(`<object id="${i + 1}" type="model" name="${escapeXml(part.name)}"><mesh><vertices>`);
    const p = part.mesh.positions;
    for (let v = 0; v < p.length; v += 3) out.push(`<vertex x="${num(p[v])}" y="${num(p[v + 1])}" z="${num(p[v + 2])}"/>`);
    out.push(`</vertices><triangles>`);
    const t = part.mesh.indices;
    for (let k = 0; k < t.length; k += 3) out.push(`<triangle v1="${t[k]}" v2="${t[k + 1]}" v3="${t[k + 2]}"/>`);
    out.push(`</triangles></mesh></object>`);
  });
  out.push(`</resources><build>`);
  parts.forEach((_, i) => out.push(`<item objectid="${i + 1}"/>`));
  out.push(`</build></model>`);
  return out.join("\n");
}

export function write3mf(parts: ThreeMfPart[], title?: string): Uint8Array {
  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      // Flat paths, so the archive has no directory entries (some readers choke on them).
      "_rels/.rels": strToU8(RELS),
      "3D/3dmodel.model": strToU8(modelXml(parts, title)),
    },
    { level: 6 },
  );
}
