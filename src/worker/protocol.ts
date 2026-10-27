import type { BuildInfo, Message, Params } from "../models/types";

export type ExportFormat = "3mf" | "stl";

export type Request =
  | { type: "generate"; id: number; model: string; params: Params }
  | { type: "export"; id: number; format: ExportFormat; quality: "normal" | "fine" };

export interface PreviewPiece {
  name: string;
  /** Translation that places the piece in the exploded preview. */
  offset: [number, number, number];
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface ExportFile {
  name: string;
  bytes: Uint8Array;
}

export type Response =
  | { type: "ready" }
  | { type: "progress"; id: number; stage: "building" | "meshing" | "exporting" }
  | { type: "generated"; id: number; pieces: PreviewPiece[]; info: BuildInfo; ms: number }
  | { type: "exported"; id: number; files: ExportFile[] }
  | { type: "error"; id: number; error: Message };
