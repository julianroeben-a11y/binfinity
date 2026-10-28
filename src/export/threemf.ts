// Minimal 3MF (core spec) writer. Each part becomes its own object and build
// item, so Bambu Studio / PrusaSlicer / Orca import them as separate objects
// that can be arranged on one or more plates.

import { strToU8, zipSync } from "fflate";
import type { Mesh } from "./mesh";

export interface ThreeMfPart {
  name: string;
  mesh: Mesh;
  /** Second-colour part of the same object (filament 2), e.g. a colour accent. */
  accent?: Mesh;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
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

function meshObject(out: string[], id: number, name: string, mesh: Mesh) {
  out.push(`<object id="${id}" type="model" name="${escapeXml(name)}"><mesh><vertices>`);
  const p = mesh.positions;
  for (let v = 0; v < p.length; v += 3) out.push(`<vertex x="${num(p[v])}" y="${num(p[v + 1])}" z="${num(p[v + 2])}"/>`);
  out.push(`</vertices><triangles>`);
  const t = mesh.indices;
  for (let k = 0; k < t.length; k += 3) out.push(`<triangle v1="${t[k]}" v2="${t[k + 1]}" v3="${t[k + 2]}"/>`);
  out.push(`</triangles></mesh></object>`);
}

/** Object ids: a part with an accent becomes two mesh objects plus one object made of both. */
function layout(parts: ThreeMfPart[]) {
  let next = 1;
  return parts.map((part) => {
    const body = next++;
    if (!part.accent) return { body, accent: 0, item: body };
    const accent = next++;
    return { body, accent, item: next++ };
  });
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
  const ids = layout(parts);
  parts.forEach((part, i) => {
    const id = ids[i];
    meshObject(out, id.body, part.name, part.mesh);
    if (part.accent) {
      meshObject(out, id.accent, `${part.name}_accent`, part.accent);
      out.push(
        `<object id="${id.item}" type="model" name="${escapeXml(part.name)}"><components>`,
        `<component objectid="${id.body}"/><component objectid="${id.accent}"/>`,
        `</components></object>`,
      );
    }
  });
  out.push(`</resources><build>`);
  ids.forEach((id) => out.push(`<item objectid="${id.item}"/>`));
  out.push(`</build></model>`);
  return out.join("\n");
}

/**
 * Bambu Studio / Orca part settings: the accent part of each object prints
 * with filament 2. Other slicers ignore this file and show two parts.
 */
export function modelSettings(parts: ThreeMfPart[]): string | null {
  if (!parts.some((p) => p.accent)) return null;
  const ids = layout(parts);
  const out = [`<?xml version="1.0" encoding="UTF-8"?>`, `<config>`];
  parts.forEach((part, i) => {
    const id = ids[i];
    if (!part.accent) return;
    out.push(
      `  <object id="${id.item}">`,
      `    <metadata key="name" value="${escapeXml(part.name)}"/>`,
      `    <metadata key="extruder" value="1"/>`,
      `    <part id="${id.body}" subtype="normal_part">`,
      `      <metadata key="name" value="${escapeXml(part.name)}"/>`,
      `      <metadata key="extruder" value="1"/>`,
      `    </part>`,
      `    <part id="${id.accent}" subtype="normal_part">`,
      `      <metadata key="name" value="${escapeXml(part.name)}_accent"/>`,
      `      <metadata key="extruder" value="2"/>`,
      `    </part>`,
      `  </object>`,
    );
  });
  out.push(`</config>`);
  return out.join("\n");
}

export function write3mf(parts: ThreeMfPart[], title?: string): Uint8Array {
  const settings = modelSettings(parts);
  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      // Flat paths, so the archive has no directory entries (some readers choke on them).
      "_rels/.rels": strToU8(RELS),
      "3D/3dmodel.model": strToU8(modelXml(parts, title)),
      ...(settings ? { "Metadata/model_settings.config": strToU8(settings) } : {}),
    },
    { level: 6 },
  );
}
