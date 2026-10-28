import { accentGroup, printerGroup } from "../printer";
import { boxCompartment, boxSchema } from "../box/schema";
import { sanitize, type ModelSchema, type Params } from "../types";

const isBin = (p: Params) => p.form === "bin";
const isSlot = (p: Params) => p.opening === "slot";
const isSet = (p: Params) => p.opening === "set";

/**
 * Item presets. Sizes are the nominal item sizes; the clearance field adds the
 * play. `itemX`/`itemY` are the widest part of the item above the insert (bit
 * head, stick body), which together with `gap` sets the spacing.
 */
export const itemPresets: Record<string, Params> = {
  hexbit: { opening: "hex", size: 6.35, holeDepth: 10, itemX: 7.4, gap: 6 },
  shank6: { opening: "round", size: 6, holeDepth: 20, itemX: 20, gap: 8 },
  shank8: { opening: "round", size: 8, holeDepth: 20, itemX: 20, gap: 8 },
  shank12: { opening: "round", size: 12, holeDepth: 22, itemX: 20, gap: 8 },
  drills: { opening: "set", sizes: "2-10", holeDepth: 20, gap: 4 },
  aa: { opening: "round", size: 14.5, holeDepth: 20, itemX: 14.5, gap: 5 },
  aaa: { opening: "round", size: 10.5, holeDepth: 18, itemX: 10.5, gap: 5 },
  usba: { opening: "slot", size: 12, slotWidth: 4.5, holeDepth: 11, itemX: 21, itemY: 10.5, gap: 6 },
  usbc: { opening: "slot", size: 8.4, slotWidth: 2.6, holeDepth: 7, itemX: 21, itemY: 10, gap: 6 },
  sd: { opening: "slot", size: 24, slotWidth: 2.1, holeDepth: 14, itemX: 24, itemY: 2.1, gap: 8 },
  microsd: { opening: "slot", size: 11, slotWidth: 1, holeDepth: 7, itemX: 11, itemY: 1, gap: 6 },
};

/** Items that can be combined in one insert, each with its own count. */
export const mixItems = Object.keys(itemPresets).filter((k) => itemPresets[k].opening !== "set");
const isMix = (p: Params) => p.opening === "mix";
const uniform = (p: Params) => !isSet(p) && !isMix(p);

const presets: Record<string, Params> = {
  ...itemPresets,
  mix: { opening: "mix" },
};
/** Play of a loose insert in its box, per side. */
const BOX_FIT = 0.5;
const r1 = (n: number) => Math.floor(n * 10) / 10;

/** Size a loose insert to the box last set up (one compartment of it). */
function fitToBox(_: Params, models: Record<string, Params>): Params {
  const box = boxCompartment(sanitize(boxSchema, models.box ?? {}));
  const w = r1(box.w - 2 * BOX_FIT);
  const d = r1(box.d - 2 * BOX_FIT);
  // A smaller corner than the box's would run into its rounded corners.
  return { width: w, length: d, cornerRadius: Math.min(Math.max(2, r1(box.radius)), w / 2 - 0.1, d / 2 - 0.1) };
}

const mixDefaults: Record<string, number> = { usba: 4, sd: 3, microsd: 1 };

export const insertSchema: ModelSchema = {
  id: "insert",
  title: "model.insert",
  groups: [
    {
      title: "group.items",
      open: true,
      fields: [
        { key: "preset", label: "insert.preset", type: "select", default: "hexbit", options: [...Object.keys(presets), "custom"], presets },
        { key: "opening", label: "insert.opening", type: "select", default: "hex", options: ["round", "hex", "slot", "set", "mix"], advanced: true },
        { key: "sizes", label: "insert.sizes", type: "text", default: "2-10", maxLength: 200, placeholder: "2 3 4 5 6 8 10", visible: isSet },
        { key: "sizeLabels", label: "insert.sizeLabels", type: "bool", default: true, visible: isSet },
        ...mixItems.map((k) => ({
          key: `count_${k}`,
          label: `insert.preset.${k}`,
          type: "number" as const,
          default: mixDefaults[k] ?? 0,
          min: 0,
          max: 100,
          step: 1,
          visible: isMix,
        })),
        { key: "size", label: "insert.size", type: "number", default: 6.35, min: 0.5, max: 100, step: 0.05, unit: "mm", visible: uniform, advanced: true },
        { key: "slotWidth", label: "insert.slotWidth", type: "number", default: 4.5, min: 0.5, max: 50, step: 0.05, unit: "mm", visible: isSlot, advanced: true },
        { key: "holeDepth", label: "insert.holeDepth", type: "number", default: 10, min: 2, max: 150, step: 0.5, unit: "mm", visible: (p) => !isMix(p), advanced: true },
        { key: "clearance", label: "insert.clearance", type: "number", default: 0.4, min: 0, max: 2, step: 0.05, unit: "mm", advanced: true },
        { key: "itemX", label: "insert.itemX", type: "number", default: 7.4, min: 0.5, max: 150, step: 0.5, unit: "mm", visible: uniform, advanced: true },
        { key: "itemY", label: "insert.itemY", type: "number", default: 12, min: 0.5, max: 150, step: 0.5, unit: "mm", visible: isSlot, advanced: true },
        { key: "gap", label: "insert.gap", type: "number", default: 6, min: 0, max: 50, step: 0.5, unit: "mm", visible: (p) => !isMix(p), advanced: true },
        { key: "stagger", label: "insert.stagger", type: "bool", default: false, visible: (p) => !isSlot(p) && uniform(p), advanced: true },
      ],
    },
    {
      title: "group.size",
      open: true,
      fields: [
        { key: "form", label: "insert.form", type: "select", default: "bin", options: ["bin", "loose"] },
        { key: "autoSize", label: "insert.autoSize", type: "bool", default: true, visible: (p) => isBin(p) && isMix(p) },
        { key: "gridX", label: "bin.gridX", type: "number", default: 2, min: 1, max: 10, step: 1, visible: (p) => isBin(p) && !(isMix(p) && p.autoSize === true) },
        { key: "gridY", label: "bin.gridY", type: "number", default: 1, min: 1, max: 10, step: 1, visible: (p) => isBin(p) && !(isMix(p) && p.autoSize === true) },
        { key: "width", label: "insert.width", type: "number", default: 80, min: 10, max: 1000, step: 0.5, unit: "mm", visible: (p) => !isBin(p) },
        { key: "length", label: "insert.length", type: "number", default: 60, min: 10, max: 1000, step: 0.5, unit: "mm", visible: (p) => !isBin(p) },
        { key: "fromBox", label: "insert.fromBox", type: "action", run: fitToBox, visible: (p) => !isBin(p) },
        { key: "cornerRadius", label: "box.cornerRadius", type: "number", default: 2, min: 0.5, max: 50, step: 0.5, unit: "mm", visible: (p) => !isBin(p), advanced: true },
        { key: "heightMode", label: "insert.heightMode", type: "select", default: "auto", options: ["auto", "units"], visible: isBin, advanced: true },
        { key: "heightUnits", label: "bin.heightUnits", type: "number", default: 3, min: 2, max: 30, step: 1, visible: (p) => isBin(p) && p.heightMode === "units", advanced: true },
        { key: "floor", label: "bin.floor", type: "number", default: 1.5, min: 0.6, max: 10, step: 0.1, unit: "mm", advanced: true },
        { key: "lip", label: "bin.lip", type: "bool", default: true, visible: isBin, advanced: true },
      ],
    },
    {
      title: "group.base",
      fields: [
        { key: "magnets", label: "bp.magnets", type: "bool", default: false, visible: isBin },
        { key: "magnetDiameter", label: "bp.magnetDiameter", type: "number", default: 6.5, min: 2, max: 10, step: 0.05, unit: "mm", visible: (p) => isBin(p) && p.magnets === true },
        { key: "magnetDepth", label: "bp.magnetDepth", type: "number", default: 2.4, min: 0.5, max: 4, step: 0.05, unit: "mm", visible: (p) => isBin(p) && p.magnets === true },
      ],
    },
    accentGroup,
    printerGroup,
  ],
};
