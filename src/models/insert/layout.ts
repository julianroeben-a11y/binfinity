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

export interface SizedLayout {
  /** Centre and size of every item that fits. */
  items: { x: number; y: number; size: number }[];
  /** Sizes that did not fit any more. */
  missing: number[];
}

/**
 * Round items of different sizes in rows, small to large, filled left to
 * right. Each row is as deep as its largest item and is centred, as are the
 * rows themselves.
 */
export function layoutSizes(areaX: number, areaY: number, sizes: number[], gap: number): SizedLayout {
  const rows: number[][] = [];
  let row: number[] = [];
  let used = 0;
  const depth = (r: number[]) => Math.max(...r);
  const total = () => rows.reduce((sum, r) => sum + depth(r), 0) + rows.length * gap;
  let i = 0;
  for (; i < sizes.length; i++) {
    const s = sizes[i];
    if (s > areaX) break;
    if (row.length && used + gap + s > areaX + 1e-9) {
      rows.push(row);
      row = [];
      used = 0;
    }
    // Would this item make the rows deeper than the area?
    const rowDepth = row.length ? Math.max(depth(row), s) : s;
    if (total() + rowDepth > areaY + 1e-9) break;
    used += (row.length ? gap : 0) + s;
    row.push(s);
  }
  if (row.length) rows.push(row);
  const items: SizedLayout["items"] = [];
  let y = -(total() - gap) / 2;
  for (const r of rows) {
    const rowW = r.reduce((sum, s) => sum + s, 0) + (r.length - 1) * gap;
    let x = -rowW / 2;
    const yc = y + depth(r) / 2;
    for (const s of r) {
      items.push({ x: x + s / 2, y: yc, size: s });
      x += s + gap;
    }
    y += depth(r) + gap;
  }
  return { items, missing: sizes.slice(i) };
}
