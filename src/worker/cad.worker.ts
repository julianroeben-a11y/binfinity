/// <reference lib="webworker" />
// Runs OpenCascade (via replicad) off the main thread: builds the selected
// model, sends preview meshes back and produces export files on request.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import { measureArea, measureVolume, setOC, type Shape3D } from "replicad";
import { colourChanges, estimate, INFILL } from "../models/estimate";
import { TEXT_DEPTH } from "../models/text";
import { buildBaseplate } from "../models/baseplate/build";
import { buildBin } from "../models/bin/build";
import { buildBox } from "../models/box/build";
import { buildInsert } from "../models/insert/build";
import { buildDrawer } from "../models/drawer/build";
import { buildDesk } from "../models/desk/build";
import { cachedBuild } from "../models/cache";
import type { BuildFn, BuiltPiece } from "../models/build-types";
import { splitAccent } from "../models/accent";
import { initFont } from "../models/text";
import fontUrl from "../assets/fonts/inter-bold.woff?url";
import { ParamError } from "../models/types";
import { translateMesh, weld, type Mesh } from "../export/mesh";
import { write3mf } from "../export/threemf";
import { writeStl } from "../export/stl";
import { arrangeOnPlates } from "../models/plates";
import type { Params } from "../models/types";
import type { ExportFile, Plate, PreviewMesh, PreviewPiece, Request, Response } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const models: Record<string, BuildFn> = {
  baseplate: buildBaseplate,
  bin: buildBin,
  box: buildBox,
  insert: buildInsert,
  drawer: buildDrawer,
  desk: buildDesk,
};

/** Gap between split pieces in the assembled preview. */
const EXPLODE_GAP = 6;

/** A built piece with its second-colour part split off. */
interface Piece extends BuiltPiece {
  accent: Shape3D | null;
}

let current: { model: string; pieces: Piece[]; plateOffsets: [number, number, number][] } | null = null;

const ready = (async () => {
  const OC = await opencascade({ locateFile: () => wasmUrl });
  setOC(OC);
  // Without the font everything still works, just without engraved text.
  try {
    await initFont(await (await fetch(fontUrl)).arrayBuffer());
  } catch (e) {
    console.warn("Font not loaded, labels are left out", e);
  }
  post({ type: "ready" });
})();

function post(msg: Response, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

/** Offsets that move every piece so its corner sits at its exploded position. */
function explodedOffsets(pieces: BuiltPiece[]): [number, number, number][] {
  return pieces.map((p) => [p.grid[0] * EXPLODE_GAP, p.grid[1] * EXPLODE_GAP, 0]);
}

/** Lay the pieces out on print beds; returns per-piece translations plus the beds. */
function plateLayout(pieces: BuiltPiece[], params: Params) {
  const bedX = params.bedX as number;
  const bedY = params.bedY as number;
  const boxes = pieces.map((p) => p.shape.boundingBox.bounds);
  const layout = arrangeOnPlates(boxes.map(([min, max]) => [max[0] - min[0], max[1] - min[1]]), bedX, bedY);
  const offsets = layout.placements.map((pl, i): [number, number, number] => [pl.x - boxes[i][0][0], pl.y - boxes[i][0][1], -boxes[i][0][2]]);
  return { offsets, plates: layout.plates.map(([x, y]): Plate => ({ x, y, w: bedX, d: bedY })), oversized: layout.oversized.length > 0 };
}

/** "25 min" or "2 h 05 min", rounded to 5 minutes. */
function duration(seconds: number): string {
  const min = Math.max(5, Math.round(seconds / 300) * 5);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function meshOf(shape: Shape3D, tolerance: number, angularTolerance: number): Mesh {
  const m = shape.mesh({ tolerance, angularTolerance });
  return weld(m.vertices, m.triangles);
}

function previewMesh(shape: Shape3D): PreviewMesh {
  const m = shape.mesh({ tolerance: 0.1, angularTolerance: 0.3 });
  return { positions: new Float32Array(m.vertices), normals: new Float32Array(m.normals), indices: new Uint32Array(m.triangles) };
}

function freeCurrent() {
  current?.pieces.forEach((p) => {
    p.shape.delete();
    p.accent?.delete();
  });
  current = null;
}

async function handle(req: Request) {
  await ready;
  if (req.type === "generate") {
    const build = models[req.model];
    if (!build) throw new ParamError({ key: "err.unknownModel" });
    const t0 = performance.now();
    post({ type: "progress", id: req.id, stage: "building" });
    // A drawer caches its parts itself.
    const { pieces, info } = req.model === "drawer" ? build(req.params) : cachedBuild(req.model, build, req.params);
    freeCurrent();
    const plates = plateLayout(pieces, req.params);
    if (plates.oversized && !info.warnings.some((w) => w.key === "warn.largerThanBed")) {
      info.warnings.push({ key: "warn.largerThanBed", vars: { size: req.params.bedX as number } });
    }
    if (plates.plates.length > 1) info.facts.push({ key: "fact.plates", vars: { n: plates.plates.length } });
    const withAccent = req.params.accent === true;
    const changes = pieces.map((p) => colourChanges(withAccent, !!p.labels, TEXT_DEPTH));
    const split: Piece[] = pieces.map((p) => {
      const { body, accent } = splitAccent(p, withAccent, req.params.accentHeight as number);
      return { ...p, shape: body, accent };
    });
    const est = estimate(
      split.map((p, i) => {
        const parts = p.accent ? [p.shape, p.accent] : [p.shape];
        return {
          volume: parts.reduce((v, s) => v + measureVolume(s), 0),
          area: parts.reduce((a, s) => a + measureArea(s), 0),
          height: p.size[2],
          changes: changes[i],
        };
      }),
    );
    info.facts.push({ key: "fact.estimate", vars: { g: Math.max(1, Math.round(est.grams)), time: duration(est.seconds), infill: INFILL * 100 } });
    const totalChanges = changes.reduce((a, b) => a + b, 0);
    if (totalChanges) info.facts.push({ key: "fact.colourChanges", vars: { n: totalChanges } });
    current = { model: req.model, pieces: split, plateOffsets: plates.offsets };
    post({ type: "progress", id: req.id, stage: "meshing" });
    // A drawer is shown as it goes together, without gaps between the plate pieces.
    const offsets = req.model === "drawer" ? split.map((): [number, number, number] => [0, 0, 0]) : explodedOffsets(split);
    split.forEach((p, i) => p.placement && (offsets[i] = p.placement.offset));
    const preview: PreviewPiece[] = split.map((p, i) => ({
      name: p.name,
      assembled: offsets[i],
      assembledRotX: p.placement?.rotX,
      onPlate: plates.offsets[i],
      ...previewMesh(p.shape),
      accent: p.accent ? previewMesh(p.accent) : undefined,
    }));
    const transfer = preview.flatMap((p) => [p, ...(p.accent ? [p.accent] : [])].flatMap((m) => [m.positions.buffer, m.normals.buffer, m.indices.buffer]));
    post({ type: "generated", id: req.id, pieces: preview, plates: plates.plates, info, ms: Math.round(performance.now() - t0) }, transfer);
    return;
  }

  if (!current) throw new ParamError({ key: "err.nothingToExport" });
  post({ type: "progress", id: req.id, stage: "exporting" });
  const [tol, ang] = req.quality === "fine" ? [0.01, 0.05] : [0.03, 0.15];
  // Exported parts sit where they are shown on the print beds: centred on the
  // first bed, further beds next to it (like Bambu Studio's plate grid).
  const offsets = current.plateOffsets;
  const meshes = current.pieces.map((p, i) => translateMesh(meshOf(p.shape, tol, ang), ...offsets[i]));
  const accents = current.pieces.map((p, i) => (p.accent ? translateMesh(meshOf(p.accent, tol, ang), ...offsets[i]) : null));
  const base = `binfinity_${current.pieces.length === 1 ? current.pieces[0].name : current.model}`;
  let files: ExportFile[];
  if (req.format === "3mf") {
    const parts = current.pieces.map((p, i) => ({ name: p.name, mesh: meshes[i], accent: accents[i] ?? undefined }));
    files = [{ name: `${base}.3mf`, bytes: write3mf(parts, base, req.colors) }];
  } else {
    // STL has no notion of separate objects, so write one file per piece and
    // let the UI zip them when there is more than one.
    // The accent goes into its own file; slicers load both as parts of one object.
    const many = current.pieces.length > 1 || accents.some(Boolean);
    files = current.pieces.flatMap((p, i) => {
      const name = many ? `binfinity_${p.name}` : base;
      const accent = accents[i];
      return [
        { name: `${name}.stl`, bytes: writeStl(meshes[i], p.name) },
        ...(accent ? [{ name: `${name}_accent.stl`, bytes: writeStl(accent, `${p.name}_accent`) }] : []),
      ];
    });
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
