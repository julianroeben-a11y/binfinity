import type { FieldGroup } from "./types";

/** Print bed size, shared by every model: used to split, place and centre parts. */
export const printerGroup: FieldGroup = {
  title: "group.printer",
  tab: "print",
  fields: [
    { key: "bedX", label: "bp.bedX", type: "number", default: 256, min: 50, max: 1000, step: 1, unit: "mm" },
    { key: "bedY", label: "bp.bedY", type: "number", default: 256, min: 50, max: 1000, step: 1, unit: "mm" },
  ],
};

/**
 * Colour accent: the top millimetres (and engraved labels) become a second
 * part of the same object, printed with filament 2.
 */
export const accentGroup: FieldGroup = {
  title: "group.accent",
  tab: "print",
  fields: [
    { key: "accent", label: "style.accent", type: "bool", default: false },
    { key: "accentHeight", label: "style.accentHeight", type: "number", default: 1, min: 0.2, max: 20, step: 0.2, unit: "mm", visible: (p) => p.accent === true },
  ],
};
