// Pure layout maths for baseplates: how many cells, how much padding, and how
// to split the plate into pieces that fit the print bed. No CAD in here, so it
// is cheap to unit-test.

import { GRID } from "../gridfinity";
import { ParamError, type Params } from "../types";

export interface AxisLayout {
  cells: number;
  /** Solid filler before the first and after the last cell. */
  padStart: number;
  padEnd: number;
  /** Cells per piece along this axis, in order. */
  split: number[];
}

export interface PieceLayout {
  /** Column / row index of the piece. */
  ix: number;
  iy: number;
  /** First cell index covered by this piece. */
  cellX0: number;
  cellY0: number;
  cellsX: number;
  cellsY: number;
  /** Piece rectangle in plate coordinates (plate origin = outer bottom-left corner). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BaseplateLayout {
  x: AxisLayout;
  y: AxisLayout;
  width: number;
  depth: number;
  pieces: PieceLayout[];
}

function axisFromDrawer(length: number, clearance: number, align: string): Omit<AxisLayout, "split"> {
  const usable = length - clearance;
  const cells = Math.floor(usable / GRID + 1e-9);
  if (cells < 1) throw new ParamError({ key: "err.drawerTooSmall", vars: { min: GRID + clearance } });
  const pad = Math.max(0, usable - cells * GRID);
  if (align === "start") return { cells, padStart: 0, padEnd: pad };
  if (align === "end") return { cells, padStart: pad, padEnd: 0 };
  return { cells, padStart: pad / 2, padEnd: pad / 2 };
}

/**
 * Split `cells` into as few pieces as possible so that every piece, including
 * the padding on the outer pieces, is at most `bed` long. Cells are spread as
 * evenly as possible; leftover cells go to the inner pieces first, which keeps
 * the padded outer pieces smaller.
 */
export function splitAxis(cells: number, padStart: number, padEnd: number, bed: number): number[] {
  for (let k = 1; k <= cells; k++) {
    const base = Math.floor(cells / k);
    const extra = cells % k;
    const counts = new Array<number>(k).fill(base);
    // Hand out extra cells starting from the middle.
    const order = [...counts.keys()].sort((a, b) => Math.abs(a - (k - 1) / 2) - Math.abs(b - (k - 1) / 2));
    for (let i = 0; i < extra; i++) counts[order[i]]++;
    const fits = counts.every((c, i) => {
      const len = c * GRID + (i === 0 ? padStart : 0) + (i === k - 1 ? padEnd : 0);
      return len <= bed + 1e-6;
    });
    if (fits) return counts;
  }
  throw new ParamError({ key: "err.bedTooSmall", vars: { size: Math.ceil(GRID + Math.max(padStart, padEnd)) } });
}

export function layoutBaseplate(p: Params): BaseplateLayout {
  let ax: Omit<AxisLayout, "split">;
  let ay: Omit<AxisLayout, "split">;
  if (p.sizeMode === "drawer") {
    ax = axisFromDrawer(p.drawerX as number, p.clearance as number, p.alignX as string);
    ay = axisFromDrawer(p.drawerY as number, p.clearance as number, p.alignY as string);
  } else {
    ax = { cells: Math.round(p.gridX as number), padStart: 0, padEnd: 0 };
    ay = { cells: Math.round(p.gridY as number), padStart: 0, padEnd: 0 };
  }
  const x: AxisLayout = { ...ax, split: splitAxis(ax.cells, ax.padStart, ax.padEnd, p.bedX as number) };
  const y: AxisLayout = { ...ay, split: splitAxis(ay.cells, ay.padStart, ay.padEnd, p.bedY as number) };

  const width = ax.padStart + ax.cells * GRID + ax.padEnd;
  const depth = ay.padStart + ay.cells * GRID + ay.padEnd;

  const edges = (a: AxisLayout) => {
    const out: { cell0: number; cells: number; from: number; to: number }[] = [];
    let cell = 0;
    a.split.forEach((c, i) => {
      const from = i === 0 ? 0 : a.padStart + cell * GRID;
      const to = i === a.split.length - 1 ? a.padStart + a.cells * GRID + a.padEnd : a.padStart + (cell + c) * GRID;
      out.push({ cell0: cell, cells: c, from, to });
      cell += c;
    });
    return out;
  };

  const pieces: PieceLayout[] = [];
  edges(y).forEach((ey, iy) =>
    edges(x).forEach((ex, ix) =>
      pieces.push({
        ix,
        iy,
        cellX0: ex.cell0,
        cellY0: ey.cell0,
        cellsX: ex.cells,
        cellsY: ey.cells,
        x0: ex.from,
        y0: ey.from,
        x1: ex.to,
        y1: ey.to,
      }),
    ),
  );
  return { x, y, width, depth, pieces };
}
