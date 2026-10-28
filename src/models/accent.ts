// Colour accent: splits a piece into the body and a second-colour part (the
// top or bed-side millimetres plus engraved labels), printed with filament 2.
import { makeCompound, type Shape3D } from "replicad";
import type { BuiltPiece } from "./build-types";

export interface SplitPiece {
  body: Shape3D;
  /** Second-colour part, or null without an accent. */
  accent: Shape3D | null;
}

/** Split `piece` at `height` below its top (or above its bottom). */
export function splitAccent(piece: BuiltPiece, enabled: boolean, height: number): SplitPiece {
  if (!enabled) {
    // Without a second colour the engraving stays empty.
    piece.labels?.delete();
    return { body: piece.shape, accent: null };
  }
  const [[, , z0], [, , z1]] = piece.shape.boundingBox.bounds;
  const parts: Shape3D[] = [];
  let body = piece.shape;
  if (height < z1 - z0) {
    const z = piece.accentSide === "bottom" ? z0 + height : z1 - height;
    const [lower, upper] = [piece.shape.clone().cutPlane("XY", z, "negative"), piece.shape.clone().cutPlane("XY", z, "positive")];
    if (lower && upper) {
      const [b, a] = piece.accentSide === "bottom" ? [upper, lower] : [lower, upper];
      body = b as Shape3D;
      parts.push(a as Shape3D);
      piece.shape.delete();
    } else {
      lower?.delete();
      upper?.delete();
    }
  }
  if (piece.labels) parts.push(piece.labels);
  if (!parts.length) return { body, accent: null };
  return { body, accent: parts.length === 1 ? parts[0] : (makeCompound(parts) as unknown as Shape3D) };
}
