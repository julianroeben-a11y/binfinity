// Distributes printable pieces onto as many print beds as needed, centred on
// each bed. Pure maths, shared by the worker (export positions) and tests.

/** Gap between pieces on the same bed. */
export const PIECE_SPACING = 5;
/**
 * Distance between neighbouring beds, as a fraction of the bed size. Bambu
 * Studio lays out its plates with the same 1/5 gap, so the preview matches.
 */
export const PLATE_GAP = 0.2;

export interface PlatePlacement {
  plate: number;
  /** Where the piece's bounding-box minimum corner goes, in model coordinates. */
  x: number;
  y: number;
}

export interface PlateLayout {
  /** Lower-left corner of every bed. */
  plates: [number, number][];
  placements: PlatePlacement[];
  /** Indices of pieces larger than the bed (placed alone, centred). */
  oversized: number[];
}

/** Bed origins in a grid like Bambu Studio: columns to the right, rows downwards. */
function plateOrigins(count: number, bedX: number, bedY: number): [number, number][] {
  const cols = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, k) => [
    (k % cols) * bedX * (1 + PLATE_GAP),
    -Math.floor(k / cols) * bedY * (1 + PLATE_GAP) || 0,
  ]);
}

/**
 * Shelf packing: pieces keep their input order, fill rows left to right and
 * rows front to back; a piece that no longer fits starts the next bed. Each
 * bed's content is then centred on that bed.
 */
export function arrangeOnPlates(sizes: [number, number][], bedX: number, bedY: number): PlateLayout {
  interface Slot { piece: number; x: number; y: number }
  const beds: Slot[][] = [];
  const oversized: number[] = [];
  let bed: Slot[] = [];
  let cursorX = 0;
  let rowY = 0;
  let rowDepth = 0;

  const newBed = () => {
    if (bed.length) beds.push(bed);
    bed = [];
    cursorX = 0;
    rowY = 0;
    rowDepth = 0;
  };

  sizes.forEach(([w, d], i) => {
    if (w > bedX + 1e-6 || d > bedY + 1e-6) {
      oversized.push(i);
      newBed();
      bed.push({ piece: i, x: 0, y: 0 });
      newBed();
      return;
    }
    if (bed.length && cursorX + w > bedX + 1e-6) {
      // Next row.
      rowY += rowDepth + PIECE_SPACING;
      cursorX = 0;
      rowDepth = 0;
    }
    if (bed.length && rowY + d > bedY + 1e-6) newBed();
    bed.push({ piece: i, x: cursorX, y: rowY });
    cursorX += w + PIECE_SPACING;
    rowDepth = Math.max(rowDepth, d);
  });
  newBed();

  const origins = plateOrigins(beds.length, bedX, bedY);
  const placements: PlatePlacement[] = new Array(sizes.length);
  beds.forEach((slots, k) => {
    const maxX = Math.max(...slots.map((s) => s.x + sizes[s.piece][0]));
    const maxY = Math.max(...slots.map((s) => s.y + sizes[s.piece][1]));
    const dx = (bedX - maxX) / 2;
    const dy = (bedY - maxY) / 2;
    for (const s of slots) placements[s.piece] = { plate: k, x: origins[k][0] + s.x + dx, y: origins[k][1] + s.y + dy };
  });
  return { plates: origins, placements, oversized };
}
