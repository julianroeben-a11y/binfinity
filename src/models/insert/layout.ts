// Where the items of an insert go. Pure maths, so it can be unit tested
// without OpenCascade.

export interface ItemLayout {
  /** Item centres, relative to the centre of the area. */
  centres: [number, number][];
  /** Centre distance along X and between rows. */
  pitch: [number, number];
}

/**
 * Fill an area with items that each need `footX` × `footY` and keep `gap`
 * between neighbours. Staggered rows sit in the gaps of the row before
 * (round items only), which fits more of them. `gapY` may differ from `gap`
 * between rows that are not staggered.
 */
export function layoutItems(areaX: number, areaY: number, footX: number, footY: number, gap: number, stagger = false, gapY = gap): ItemLayout {
  const px = footX + gap;
  // Staggered neighbours keep the full pitch diagonally.
  const py = stagger ? Math.max((px * Math.sqrt(3)) / 2, footY) : footY + gapY;
  const xMax = (areaX - footX) / 2;
  const yMax = (areaY - footY) / 2;
  if (xMax < -1e-9 || yMax < -1e-9) return { centres: [], pitch: [px, py] };
  const rows = Math.floor((2 * yMax) / py + 1e-9) + 1;
  const cols = Math.floor((2 * xMax) / px + 1e-9) + 1;
  const centres: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const y = -((rows - 1) * py) / 2 + r * py;
    const shift = stagger && r % 2 ? px / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = -((cols - 1) * px) / 2 + c * px + shift;
      if (Math.abs(x) <= xMax + 1e-9) centres.push([x, y]);
    }
  }
  // Staggered rows can leave the pattern off-centre.
  if (centres.length) {
    const xs = centres.map(([x]) => x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const c of centres) c[0] -= mid;
  }
  return { centres, pitch: [px, py] };
}

/**
 * Sizes typed by the user, e.g. "2 3 4.5; 6-10" or "1-6/0.5" (range with
 * step). Commas separate like spaces, decimals use a point. Sorted, without
 * duplicates.
 */
export function parseSizes(text: string, min: number, max: number, limit = 100): number[] {
  const out = new Set<number>();
  for (const token of text.split(/[\s,;]+/)) {
    const range = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(token);
    if (range) {
      const [a, b] = [parseFloat(range[1]), parseFloat(range[2])].sort((x, y) => x - y);
      const step = range[3] ? parseFloat(range[3]) : 1;
      if (step <= 0) continue;
      for (let v = a; v <= b + 1e-9 && out.size < limit; v += step) out.add(Math.round(v * 100) / 100);
    } else if (/^\d+(?:\.\d+)?$/.test(token)) {
      out.add(parseFloat(token));
    }
  }
  return [...out].filter((v) => v >= min && v <= max).sort((a, b) => a - b).slice(0, limit);
}

export interface ShelfItem {
  /** Room the item takes along X and Y. */
  w: number;
  d: number;
  /** Free space it wants towards its neighbours (the larger of two wins). */
  gap: number;
  /** Free space towards the rows before and after, if not `gap`. */
  rowGap?: number;
}

export interface ShelfLayout {
  /** Centre of every item that fits, with its index in the input. */
  placed: { x: number; y: number; index: number }[];
  /** Indices of the items that did not fit any more. */
  missing: number[];
}

/**
 * Items of different sizes in rows, in the given order, filled left to right.
 * Each row is as deep as its deepest item; rows and the items in a row are
 * centred.
 */
export function layoutShelves(areaX: number, areaY: number, items: ShelfItem[]): ShelfLayout {
  const rows: number[][] = [];
  let row: number[] = [];
  let used = 0;
  const depth = (r: number[]) => Math.max(...r.map((i) => items[i].d));
  const rowGap = (r: number[]) => Math.max(...r.map((i) => items[i].rowGap ?? items[i].gap));
  const between = (a: number[], b: number[]) => Math.max(rowGap(a), rowGap(b));
  // Depth of the rows so far plus `extra` as the next one.
  const total = (extra: number[] | null) => {
    const all = extra ? [...rows, extra] : rows;
    return all.reduce((sum, r, k) => sum + depth(r) + (k ? between(all[k - 1], r) : 0), 0);
  };
  let k = 0;
  for (; k < items.length; k++) {
    const it = items[k];
    if (it.w > areaX + 1e-9) break;
    const last = row[row.length - 1];
    const g = row.length ? Math.max(it.gap, items[last].gap) : 0;
    if (row.length && used + g + it.w > areaX + 1e-9) {
      rows.push(row);
      row = [];
      used = 0;
    }
    if (total([...row, k]) > areaY + 1e-9) break;
    used += (row.length ? Math.max(it.gap, items[row[row.length - 1]].gap) : 0) + it.w;
    row.push(k);
  }
  if (row.length) rows.push(row);

  const placed: ShelfLayout["placed"] = [];
  let y = -total(null) / 2;
  rows.forEach((r, ri) => {
    if (ri) y += between(rows[ri - 1], r);
    const gaps = r.slice(1).map((i, n) => Math.max(items[i].gap, items[r[n]].gap));
    const rowW = r.reduce((sum, i) => sum + items[i].w, 0) + gaps.reduce((a, b) => a + b, 0);
    let x = -rowW / 2;
    const yc = y + depth(r) / 2;
    r.forEach((i, n) => {
      if (n) x += gaps[n - 1];
      placed.push({ x: x + items[i].w / 2, y: yc, index: i });
      x += items[i].w;
    });
    y += depth(r);
  });
  return { placed, missing: items.map((_, i) => i).slice(k) };
}

export interface SizedLayout {
  /** Centre and size of every item that fits. */
  items: { x: number; y: number; size: number }[];
  /** Sizes that did not fit any more. */
  missing: number[];
}

/** Round items of different sizes, small to large, all keeping the same gap. */
export function layoutSizes(areaX: number, areaY: number, sizes: number[], gap: number): SizedLayout {
  const { placed, missing } = layoutShelves(areaX, areaY, sizes.map((s) => ({ w: s, d: s, gap })));
  return { items: placed.map((p) => ({ x: p.x, y: p.y, size: sizes[p.index] })), missing: missing.map((i) => sizes[i]) };
}
