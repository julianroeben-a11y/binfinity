// Rough filament and print time estimate, as a slicer would give it for PLA
// with 0.2 mm layers, two walls and 20 % infill. Pure maths on the volume and
// surface area, so it is only a ballpark figure.

/** Solid skin under every surface: two 0.42 mm walls, top and bottom layers. */
const SHELL = 0.8;
export const INFILL = 0.2;
const LAYER = 0.2;
/** PLA, g/mm³. */
const DENSITY = 1.24e-3;
/** Average flow including acceleration and short moves, mm³/s. */
const SHELL_FLOW = 8;
const INFILL_FLOW = 15;
/** Travel, z hop and the like on every layer, s. */
const LAYER_TIME = 3;
/** One filament change with an AMS, s. */
const CHANGE_TIME = 60;

export interface PieceMeasure {
  volume: number;
  area: number;
  height: number;
  /** Filament changes when printed with a second colour. */
  changes: number;
}

export function estimate(pieces: PieceMeasure[]): { grams: number; seconds: number } {
  let grams = 0;
  let seconds = 0;
  for (const p of pieces) {
    const shell = Math.min(p.volume, p.area * SHELL);
    const infill = (p.volume - shell) * INFILL;
    grams += (shell + infill) * DENSITY;
    seconds += shell / SHELL_FLOW + infill / INFILL_FLOW + (p.height / LAYER) * LAYER_TIME + p.changes * CHANGE_TIME;
  }
  return { grams, seconds };
}

/** Changes for one piece: one where the accent starts, two on every layer with inlaid text. */
export function colourChanges(accent: boolean, labelled: boolean, textDepth: number): number {
  if (!accent) return 0;
  return 1 + (labelled ? 2 * Math.ceil(textDepth / LAYER - 1e-9) : 0);
}
