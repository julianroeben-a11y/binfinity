// Remembers built pieces by model and parameters, so a drawer (or going back
// to earlier settings) only rebuilds what changed. Callers always get clones;
// the cached shapes stay untouched.
import type { Shape3D } from "replicad";
import type { BuildFn, BuiltPiece } from "./build-types";
import type { BuildInfo, Params } from "./types";

const LIMIT = 40;
const cache = new Map<string, { pieces: BuiltPiece[]; info: BuildInfo }>();

const clonePiece = (p: BuiltPiece): BuiltPiece => ({ ...p, shape: p.shape.clone() as Shape3D, labels: p.labels?.clone() as Shape3D | undefined });

export function cachedBuild(model: string, build: BuildFn, params: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const key = `${model}:${JSON.stringify(params, Object.keys(params).sort())}`;
  let hit = cache.get(key);
  if (hit) {
    // Most recently used goes to the end.
    cache.delete(key);
  } else {
    hit = build(params);
    while (cache.size >= LIMIT) {
      const [oldest, entry] = cache.entries().next().value!;
      entry.pieces.forEach((p) => {
        p.shape.delete();
        p.labels?.delete();
      });
      cache.delete(oldest);
    }
  }
  cache.set(key, hit);
  return { pieces: hit.pieces.map(clonePiece), info: structuredClone(hit.info) };
}
