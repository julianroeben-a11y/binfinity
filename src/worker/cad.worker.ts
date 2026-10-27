/// <reference lib="webworker" />
// Runs OpenCascade (via replicad) off the main thread: builds the selected
// model, sends preview meshes back and produces export files on request.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import { setOC } from "replicad";
import { buildBaseplate } from "../models/baseplate/build";
import type { BuildFn, BuiltPiece } from "../models/build-types";
import { ParamError } from "../models/types";
import { translateMesh, weld, type Mesh } from "../export/mesh";
import { write3mf } from "../export/threemf";
import { writeStl } from "../export/stl";
import type { ExportFile, PreviewPiece, Request, Response } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const models: Record<string, BuildFn> = {
  baseplate: buildBaseplate,
};

/** Gap between split pieces in the preview and in the exported 3MF. */
const EXPLODE_GAP = 6;

let current: { model: string; pieces: BuiltPiece[] } | null = null;

const ready = (async () => {
  const OC = await opencascade({ locateFile: () => wasmUrl });
  setOC(OC);
  post({ type: "ready" });
})();

function post(msg: Response, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

/** Offsets that move every piece so its corner sits at its exploded position. */
function explodedOffsets(pieces: BuiltPiece[]): [number, number, number][] {
  return pieces.map((p) => [p.grid[0] * EXPLODE_GAP, p.grid[1] * EXPLODE_GAP, 0]);
}

function meshOf(piece: BuiltPiece, tolerance: number, angularTolerance: number): Mesh {
  const m = piece.shape.mesh({ tolerance, angularTolerance });
  return weld(m.vertices, m.triangles);
}

function freeCurrent() {
  current?.pieces.forEach((p) => p.shape.delete());
  current = null;
}

async function handle(req: Request) {
  await ready;
  if (req.type === "generate") {
    const build = models[req.model];
    if (!build) throw new ParamError({ key: "err.unknownModel" });
    const t0 = performance.now();
    post({ type: "progress", id: req.id, stage: "building" });
    const { pieces, info } = build(req.params);
    freeCurrent();
    current = { model: req.model, pieces };
    post({ type: "progress", id: req.id, stage: "meshing" });
    const offsets = explodedOffsets(pieces);
    const preview: PreviewPiece[] = pieces.map((p, i) => {
      const m = p.shape.mesh({ tolerance: 0.1, angularTolerance: 0.3 });
      return {
        name: p.name,
        offset: offsets[i],
        positions: new Float32Array(m.vertices),
        normals: new Float32Array(m.normals),
        indices: new Uint32Array(m.triangles),
      };
    });
    const transfer = preview.flatMap((p) => [p.positions.buffer, p.normals.buffer, p.indices.buffer]);
    post({ type: "generated", id: req.id, pieces: preview, info, ms: Math.round(performance.now() - t0) }, transfer);
    return;
  }

  if (!current) throw new ParamError({ key: "err.nothingToExport" });
  post({ type: "progress", id: req.id, stage: "exporting" });
  const [tol, ang] = req.quality === "fine" ? [0.01, 0.05] : [0.03, 0.15];
  const offsets = explodedOffsets(current.pieces);
  const meshes = current.pieces.map((p, i) => translateMesh(meshOf(p, tol, ang), ...offsets[i]));
  const base = current.model === "baseplate" ? "binfinity_baseplate" : `binfinity_${current.model}`;
  let files: ExportFile[];
  if (req.format === "3mf") {
    const parts = current.pieces.map((p, i) => ({ name: p.name, mesh: meshes[i] }));
    files = [{ name: `${base}.3mf`, bytes: write3mf(parts, base) }];
  } else {
    // STL has no notion of separate objects, so write one file per piece and
    // let the UI zip them when there is more than one.
    files = current.pieces.map((p, i) => ({
      name: current!.pieces.length > 1 ? `binfinity_${p.name}.stl` : `${base}.stl`,
      bytes: writeStl(meshes[i], p.name),
    }));
  }
  post({ type: "exported", id: req.id, files }, files.map((f) => f.bytes.buffer as ArrayBuffer));
}

// Requests are processed strictly one after another; OpenCascade is single
// threaded and the UI only cares about the newest generate request anyway.
let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data;
  queue = queue.then(() =>
    handle(req).catch((err: unknown) => {
      const error = err instanceof ParamError ? err.msg : { key: "err.internal", vars: { detail: String((err as Error)?.message ?? err) } };
      post({ type: "error", id: req.id, error });
    }),
  );
};
