// Layout for inserts that hold several kinds of items. Every kind gets its
// own block: an even grid of identical openings. The blocks stand in one row
// (or two), centred on each other, and the free room is shared out evenly:
// the gaps between the openings of neighbouring blocks and to the edges are
// as equal as the items' finger room allows.

export interface BlockKind {
  /** Room one item takes along X and Y (its body above the insert). */
  footX: number;
  footY: number;
  /** Size of its opening along X and Y. */
  ox: number;
  oy: number;
  /** Free room between neighbouring items of this kind along X and Y. */
  gapX: number;
  gapY: number;
  /** Free room it wants towards items of other kinds. */
  finger: number;
  n: number;
  /** Slots may be turned by 90°. */
  turnable: boolean;
  /** Fixed number of columns (as given, before turning). */
  cols?: number;
  /** All items in one line. */
  oneRow?: boolean;
}

export interface PlacedItem {
  kind: number;
  x: number;
  y: number;
  turned: boolean;
}

export interface BlockLayout {
  placed: PlacedItem[];
  /** Items of each kind that fit. */
  counts: number[];
}

interface Shape {
  kind: number;
  turned: boolean;
  cols: number;
  rows: number;
  n: number;
  fx: number;
  fy: number;
  gx: number;
  gy: number;
  /** Body size of the block, and how far the bodies reach past the openings. */
  w: number;
  d: number;
  ex: number;
  ey: number;
  empty: number;
  /** Slots placed end to end (a line of them along their long side). */
  endToEnd: boolean;
  /** Direction of the thin side of a slot: 0 along X, 1 along Y; -1 for round and hex. */
  thin: number;
}

const EPS = 1e-9;
/** Exhaustive search up to this many shape combinations per row split. */
const MAX_COMBOS = 800;
/** Score bonus and penalties, in mm of free room they are worth. */
const ONE_ROW = 4;
const END_TO_END = 3;
const MIXED = 1.5;

function shapes(k: BlockKind, index: number, ax: number, ay: number): Shape[] {
  const out: Shape[] = [];
  const n = k.n;
  for (const turned of k.turnable ? [false, true] : [false]) {
    const [fx, fy, ox, oy, gx, gy] = turned ? [k.footY, k.footX, k.oy, k.ox, k.gapY, k.gapX] : [k.footX, k.footY, k.ox, k.oy, k.gapX, k.gapY];
    const grids = new Map<string, [number, number]>();
    if (k.cols) {
      const [c, r] = turned ? [Math.ceil(n / k.cols), Math.min(k.cols, n)] : [Math.min(k.cols, n), Math.ceil(n / k.cols)];
      grids.set(`${c}x${r}`, [c, r]);
    } else if (k.oneRow) {
      // One line, the items side by side across their thin side.
      grids.set("line", fx <= fy ? [n, 1] : [1, n]);
    } else {
      for (let r = 1; r <= n; r++) {
        const c = Math.ceil(n / r);
        const rr = Math.ceil(n / c);
        grids.set(`${c}x${rr}`, [c, rr]);
      }
    }
    for (const [c, r] of grids.values()) {
      const w = c * fx + (c - 1) * gx;
      const d = r * fy + (r - 1) * gy;
      if (w > ax + EPS || d > ay + EPS) continue;
      const thin = !k.turnable ? -1 : ox <= oy ? 0 : 1;
      const endToEnd = thin === 1 ? c > 1 : thin === 0 ? r > 1 : false;
      out.push({ kind: index, turned, cols: c, rows: r, n, fx, fy, gx, gy, w, d, ex: (fx - ox) / 2, ey: (fy - oy) / 2, empty: c * r - n, endToEnd, thin });
    }
  }
  return out;
}

/** Equal spaces of at least `min[i]` each that add up to `total`; null if they cannot. */
function shareOut(min: number[], total: number): { spaces: number[]; even: number } | null {
  const sum = min.reduce((a, b) => a + b, 0);
  if (sum > total + EPS) return null;
  const sorted = [...min].sort((a, b) => b - a);
  let fixed = 0;
  let even = total / min.length;
  for (let k = 0; k < sorted.length; k++) {
    even = (total - fixed) / (sorted.length - k);
    if (sorted[k] <= even) break;
    fixed += sorted[k];
  }
  return { spaces: min.map((m) => Math.max(m, even)), even };
}

interface Candidate {
  rows: Shape[][];
  score: number;
  xSpaces: number[][];
  ySpaces: number[];
  bands: { open: number; reach: number }[];
}

function evaluate(rows: Shape[][], kinds: BlockKind[], ax: number, ay: number): Candidate | null {
  let sx = Infinity;
  const xSpaces: number[][] = [];
  for (const row of rows) {
    const min = [row[0].ex];
    for (let i = 1; i < row.length; i++) {
      min.push(row[i - 1].ex + Math.max(kinds[row[i - 1].kind].finger, kinds[row[i].kind].finger) + row[i].ex);
    }
    min.push(row[row.length - 1].ex);
    const open = row.reduce((s, b) => s + b.w - 2 * b.ex, 0);
    const shared = shareOut(min, ax - open);
    if (!shared) return null;
    sx = Math.min(sx, shared.even);
    xSpaces.push(shared.spaces);
  }
  // Rows as bands; blocks are centred in their band.
  const bands = rows.map((row) => {
    const open = Math.max(...row.map((b) => b.d - 2 * b.ey));
    const reach = Math.max(0, ...row.map((b) => b.ey - (open - (b.d - 2 * b.ey)) / 2));
    return { open, reach };
  });
  const fingers = rows.map((row) => Math.max(...row.map((b) => kinds[b.kind].finger)));
  const yMin = [bands[0].reach];
  for (let i = 1; i < bands.length; i++) yMin.push(bands[i - 1].reach + Math.max(fingers[i - 1], fingers[i]) + bands[i].reach);
  yMin.push(bands[bands.length - 1].reach);
  const ys = shareOut(
    yMin,
    ay - bands.reduce((s, b) => s + b.open, 0),
  );
  if (!ys) return null;
  const blocks = rows.flat();
  const empty = blocks.reduce((s, b) => s + b.empty, 0);
  const lines = blocks.filter((b) => b.endToEnd).length;
  const thin = new Set(blocks.filter((b) => b.thin >= 0).map((b) => b.thin));
  // Most breathing room in both directions. One row, full grids, slots
  // side by side (not end to end) and all slots facing the same way look tidier.
  const score = Math.min(sx, ys.even) + (rows.length === 1 ? ONE_ROW : 0) - 0.5 * empty - END_TO_END * lines - (thin.size > 1 ? MIXED : 0);
  return { rows, score, xSpaces, ySpaces: ys.spaces, bands };
}

/** Every pick of one shape per kind, or a few good ones if there are too many. */
const combos = (options: Shape[][]) => options.reduce((p, o) => p * o.length, 1);

function* picks(options: Shape[][], limitD: number[], exhaustive: boolean): Generator<Shape[]> {
  if (exhaustive) {
    const idx = options.map(() => 0);
    for (;;) {
      yield options.map((o, i) => o[idx[i]]);
      let k = 0;
      while (k < idx.length && ++idx[k] === options[k].length) idx[k++] = 0;
      if (k === idx.length) return;
    }
  }
  // For each height limit, the narrowest shape of every kind under it.
  for (const h of limitD) {
    const pick = options.map((o) => o.filter((s) => s.d <= h + EPS).sort((a, b) => a.w - b.w || a.d - b.d)[0]);
    if (pick.every(Boolean)) yield pick;
  }
}

function best(kinds: BlockKind[], ax: number, ay: number): Candidate | null {
  const active = kinds.map((k, i) => ({ k, i })).filter(({ k }) => k.n > 0);
  if (!active.length) return null;
  const options = active.map(({ k, i }) => shapes(k, i, ax, ay));
  if (options.some((o) => !o.length)) return null;
  const heights = [...new Set(options.flat().map((s) => s.d))].sort((a, b) => a - b);
  let top: Candidate | null = null;
  const consider = (rows: Shape[][]) => {
    const c = evaluate(rows, kinds, ax, ay);
    if (c && (!top || c.score > top.score + EPS)) top = c;
  };
  for (const pick of picks(options, heights, combos(options) <= MAX_COMBOS)) consider([pick]);
  // Two rows: every split of the kinds, keeping their order.
  for (let mask = 1; mask < (1 << active.length) - 1; mask++) {
    const first = options.filter((_, i) => mask & (1 << i));
    const second = options.filter((_, i) => !(mask & (1 << i)));
    const exhaustive = combos(first) * combos(second) <= MAX_COMBOS;
    for (const a of picks(first, heights, exhaustive)) {
      for (const b of picks(second, heights, exhaustive)) consider([a, b]);
    }
  }
  return top;
}

function place(c: Candidate): PlacedItem[] {
  const out: PlacedItem[] = [];
  const total = c.ySpaces.reduce((a, b) => a + b, 0) + c.bands.reduce((a, b) => a + b.open, 0);
  let y = total / 2;
  c.rows.forEach((row, ri) => {
    y -= c.ySpaces[ri];
    const centre = y - c.bands[ri].open / 2;
    y -= c.bands[ri].open;
    const spaces = c.xSpaces[ri];
    let x = -(spaces.reduce((a, b) => a + b, 0) + row.reduce((s, b) => s + b.w - 2 * b.ex, 0)) / 2;
    row.forEach((b, bi) => {
      x += spaces[bi];
      const left = x - b.ex;
      const top = centre + b.d / 2;
      for (let j = 0; j < b.rows; j++) {
        const inRow = Math.min(b.cols, b.n - j * b.cols);
        // A row that is not full sits in the middle.
        const shift = ((b.cols - inRow) * (b.fx + b.gx)) / 2;
        for (let i = 0; i < inRow; i++) {
          out.push({ kind: b.kind, turned: b.turned, x: left + shift + b.fx / 2 + i * (b.fx + b.gx), y: top - b.fy / 2 - j * (b.fy + b.gy) });
        }
      }
      x += b.w - 2 * b.ex;
    });
  });
  return out;
}

/**
 * Lay out all items of all kinds in an area of `ax` × `ay` centred on the
 * origin. When not everything fits, items are left out one at a time, from
 * the kind whose loss gives the best layout.
 */
export function layoutBlocks(ax: number, ay: number, kinds: BlockKind[]): BlockLayout {
  const counts = kinds.map((k) => k.n);
  // Far too many items for the area: drop the obvious ones first, it is quicker.
  const area = () => counts.reduce((s, n, i) => s + n * kinds[i].footX * kinds[i].footY, 0);
  while (area() > ax * ay) counts[counts.indexOf(Math.max(...counts))]--;
  const withCounts = (c: number[]) => kinds.map((k, i) => ({ ...k, n: c[i] }));
  let found = best(withCounts(counts), ax, ay);
  while (!found && counts.some((n) => n > 0)) {
    let pick = -1;
    let pickScore = -Infinity;
    for (let i = 0; i < counts.length; i++) {
      if (!counts[i]) continue;
      const trial = counts.map((n, k) => (k === i ? n - 1 : n));
      const c = best(withCounts(trial), ax, ay);
      // Prefer a layout that fits; else take from the kind with the most items.
      const score = c ? 1e6 + c.score : counts[i];
      if (score > pickScore) [pick, pickScore] = [i, score];
    }
    counts[pick]--;
    found = best(withCounts(counts), ax, ay);
  }
  return { placed: found ? place(found) : [], counts: found ? counts : counts.map(() => 0) };
}

/** Whether all items fit, without leaving any out. */
export function fitsBlocks(ax: number, ay: number, kinds: BlockKind[]): boolean {
  return best(kinds, ax, ay) !== null || kinds.every((k) => k.n === 0);
}
