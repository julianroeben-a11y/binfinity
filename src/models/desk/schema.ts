import { accentGroup, printerGroup } from "../printer";
import type { Field, ModelSchema, Params } from "../types";

/** Most module slots in the top. */
export const MAX_MODULES = 8;
/** What a module slot holds: an inlay printed separately, or nothing (an open pocket). */
export const moduleKinds = ["pens", "pocket", "cards", "usb", "bits", "holes", "empty"];
const moduleDefaults = ["pens", "pocket", "cards", "holes", "pens", "pocket", "cards", "holes"];

const used = (i: number) => (p: Params) => i < Math.round(p.cols as number) * Math.round(p.rows as number);

export const deskSchema: ModelSchema = {
  id: "desk",
  title: "model.desk",
  groups: [
    {
      title: "group.size",
      tab: "main",
      fields: [
        { key: "width", label: "desk.width", type: "number", default: 200, min: 60, max: 400, step: 1, unit: "mm" },
        { key: "depth", label: "desk.depth", type: "number", default: 110, min: 50, max: 250, step: 1, unit: "mm" },
        { key: "frontHeight", label: "desk.frontHeight", type: "number", default: 55, min: 25, max: 200, step: 1, unit: "mm" },
        { key: "angle", label: "desk.angle", type: "number", default: 20, min: 0, max: 40, step: 1, unit: "°" },
      ],
    },
    {
      title: "group.modules",
      tab: "main",
      fields: [
        { key: "cols", label: "desk.cols", type: "number", default: 2, min: 1, max: 4, step: 1 },
        { key: "rows", label: "desk.rows", type: "number", default: 2, min: 1, max: 2, step: 1 },
        ...Array.from(
          { length: MAX_MODULES },
          (_, i): Field => ({ key: `module${i + 1}`, label: `desk.module${i + 1}`, type: "select", default: moduleDefaults[i], options: moduleKinds, visible: used(i) }),
        ),
      ],
    },
    {
      title: "group.shape",
      fields: [
        { key: "pocketDepth", label: "desk.pocketDepth", type: "number", default: 40, min: 10, max: 150, step: 1, unit: "mm" },
        { key: "rim", label: "desk.rim", type: "number", default: 6, min: 3, max: 30, step: 0.5, unit: "mm" },
        { key: "web", label: "desk.web", type: "number", default: 4, min: 2, max: 20, step: 0.5, unit: "mm" },
        { key: "cornerRadius", label: "box.cornerRadius", type: "number", default: 8, min: 1, max: 40, step: 0.5, unit: "mm" },
        { key: "ribs", label: "desk.ribs", type: "bool", default: true },
        { key: "ribPitch", label: "desk.ribPitch", type: "number", default: 6, min: 3, max: 20, step: 0.5, unit: "mm", visible: (p) => p.ribs === true },
        { key: "clearance", label: "desk.clearance", type: "number", default: 0.3, min: 0, max: 1.5, step: 0.05, unit: "mm" },
      ],
    },
    accentGroup,
    printerGroup,
  ],
};
