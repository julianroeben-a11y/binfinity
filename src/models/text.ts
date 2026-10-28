// Engraved text (labels). The font is loaded once per OpenCascade instance:
// the worker does it at startup, tests from the file.
import { drawText, loadFont, makeCompound, type Drawing, type Shape3D } from "replicad";

/** How deep text is engraved; with a colour accent it is filled in again. */
export const TEXT_DEPTH = 0.6;
/** Smallest cap height that still prints legibly with a 0.4 mm nozzle. */
export const MIN_CAP = 2;
/** Cap height of Inter relative to the font size. */
const CAP_RATIO = 0.727;

let fontLoaded = false;

export async function initFont(font: string | ArrayBuffer): Promise<void> {
  await loadFont(font);
  fontLoaded = true;
}

export interface TextItem {
  text: string;
  /** Centre of the text and the face it is engraved into. */
  x: number;
  y: number;
  z: number;
  /** Room for the text; it shrinks to fit, down to `MIN_CAP`. */
  maxW: number;
  cap: number;
}

/** Width of `text` at a cap height of `cap`. */
export function textWidth(text: string, cap: number): number {
  if (!fontLoaded || !text.trim()) return 0;
  return drawText(text, { fontSize: cap / CAP_RATIO }).boundingBox.width;
}

/** The text fitted into its room and centred on its position, or null if too small. */
function fitted(item: TextItem): Drawing | null {
  const text = item.text.trim();
  if (!text) return null;
  let cap = item.cap;
  let d = drawText(text, { fontSize: cap / CAP_RATIO });
  const w = d.boundingBox.width;
  if (w > item.maxW) {
    cap *= item.maxW / w;
    if (cap < MIN_CAP) return null;
    d = drawText(text, { fontSize: cap / CAP_RATIO });
  }
  const [cx, cy] = d.boundingBox.center;
  return d.translate(item.x - cx, item.y - cy);
}

/**
 * Engrave the texts into the top faces they sit on. Returns the engraved
 * shape, the solids that fill the engraving again (for the colour accent)
 * and the texts that did not fit.
 */
export function engrave(shape: Shape3D, items: TextItem[], depth = TEXT_DEPTH): { shape: Shape3D; labels?: Shape3D; skipped: string[] } {
  if (!fontLoaded) return { shape, skipped: [] };
  const tools: Shape3D[] = [];
  const fills: Shape3D[] = [];
  const skipped: string[] = [];
  for (const item of items) {
    const d = fitted(item);
    if (!d) {
      if (item.text.trim()) skipped.push(item.text.trim());
      continue;
    }
    // The tool pokes out of the face, the fill ends flush with it.
    tools.push(d.clone().sketchOnPlane("XY", item.z - depth).extrude(depth + 0.3) as Shape3D);
    fills.push(d.sketchOnPlane("XY", item.z - depth).extrude(depth) as Shape3D);
  }
  if (!tools.length) return { shape, skipped };
  const cut = shape.cut(makeCompound(tools) as unknown as Shape3D);
  return { shape: cut, labels: makeCompound(fills) as unknown as Shape3D, skipped };
}
