import type { Shape3D } from "replicad";
import type { BuildInfo, Params } from "./types";

/** One printable part as produced by a model's build function (worker side). */
export interface BuiltPiece {
  /** File-name friendly name, e.g. `baseplate_1-2`. */
  name: string;
  shape: Shape3D;
  /** Where the piece sits in the assembled model (its local origin). */
  origin: [number, number, number];
  size: [number, number, number];
  /** Position in the split grid, used to explode the preview. */
  grid: [number, number];
}

export type BuildFn = (p: Params) => { pieces: BuiltPiece[]; info: BuildInfo };
