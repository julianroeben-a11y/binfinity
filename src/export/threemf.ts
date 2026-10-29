// Minimal 3MF (core spec) writer. Each part becomes its own object and build
// item, so Bambu Studio / PrusaSlicer / Orca import them as separate objects
// that can be arranged on one or more plates. Colours use the standard
// materials extension (a colour group), which Bambu Studio maps to filaments
// on import. A Bambu project file (Metadata/model_settings.config) is not
// written: Bambu Studio rejects it from other apps ("invalid config, load
// geometry data only") and then drops the colours too.

import { strToU8, zipSync } from "fflate";
import type { Mesh } from "./mesh";

export interface ThreeMfColors {
  /** CSS hex colours (#rrggbb) of the body and of the accent part. */
  body: string;
  accent: string;
}

const DEFAULT_COLORS: ThreeMfColors = { body: "#4f8fd6", accent: "#e3a33b" };

/** #rgb or #rrggbb to the 3MF form #RRGGBBAA; anything else falls back. */
function color3mf(c: string, fallback: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return color3mf(fallback, "#808080");
  const hex = m[1].length === 3 ? [...m[1]].map((h) => h + h).join("") : m[1];
  return `#${hex.toUpperCase()}FF`;
}

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

/** Id of the colour group; object ids start after it. */
const COLORS_ID = 1;

/** `color` is an index into the colour group, or null for no colour. */
function meshObject(out: string[], id: number, name: string, mesh: Mesh, color: number | null) {
  const pid = color === null ? "" : ` pid="${COLORS_ID}" pindex="${color}"`;
  out.push(`<object id="${id}" type="model" name="${escapeXml(name)}"${pid}><mesh><vertices>`);
  const p = mesh.positions;
  for (let v = 0; v < p.length; v += 3) out.push(`<vertex x="${num(p[v])}" y="${num(p[v + 1])}" z="${num(p[v + 2])}"/>`);
  out.push(`</vertices><triangles>`);
  const t = mesh.indices;
  // The colour on every triangle too: some readers ignore the object default.
  const tri = color === null ? "" : ` pid="${COLORS_ID}" p1="${color}"`;
  for (let k = 0; k < t.length; k += 3) out.push(`<triangle v1="${t[k]}" v2="${t[k + 1]}" v3="${t[k + 2]}"${tri}/>`);
  out.push(`</triangles></mesh></object>`);
}

/** Object ids: a part with an accent becomes two mesh objects plus one object made of both. */
function layout(parts: ThreeMfPart[]) {
  let next = COLORS_ID + 1;
  return parts.map((part) => {
    const body = next++;
    if (!part.accent) return { body, accent: 0, item: body };
    const accent = next++;
    return { body, accent, item: next++ };
  });
}

export function modelXml(parts: ThreeMfPart[], title = "Binfinity", colors: ThreeMfColors = DEFAULT_COLORS): string {
  const out: string[] = [];
  out.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">`,
    `<metadata name="Title">${escapeXml(title)}</metadata>`,
    `<metadata name="Application">Binfinity</metadata>`,
    `<resources>`,
  );
  // Colours only for a two-colour print; a plain part stays plain.
  const colored = parts.some((p) => p.accent);
  if (colored) {
    out.push(
      `<m:colorgroup id="${COLORS_ID}">`,
      `<m:color color="${color3mf(colors.body, DEFAULT_COLORS.body)}"/>`,
      `<m:color color="${color3mf(colors.accent, DEFAULT_COLORS.accent)}"/>`,
      `</m:colorgroup>`,
    );
  }
  const ids = layout(parts);
  parts.forEach((part, i) => {
    const id = ids[i];
    meshObject(out, id.body, part.name, part.mesh, colored ? 0 : null);
    if (part.accent) {
      meshObject(out, id.accent, `${part.name}_accent`, part.accent, 1);
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

export function write3mf(parts: ThreeMfPart[], title?: string, colors?: ThreeMfColors): Uint8Array {
  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      // Flat paths, so the archive has no directory entries (some readers choke on them).
      "_rels/.rels": strToU8(RELS),
      "3D/3dmodel.model": strToU8(modelXml(parts, title, colors)),
    },
    { level: 6 },
  );
}
