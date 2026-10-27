import { printerGroup } from "../printer";
import type { ModelSchema, Params } from "../types";

const isUnits = (p: Params) => p.heightMode === "units";
const isMm = (p: Params) => p.heightMode === "mm";

export const binSchema: ModelSchema = {
  id: "bin",
  title: "model.bin",
  groups: [
    {
      title: "group.size",
      fields: [
        { key: "gridX", label: "bin.gridX", type: "number", default: 2, min: 1, max: 10, step: 1 },
        { key: "gridY", label: "bin.gridY", type: "number", default: 1, min: 1, max: 10, step: 1 },
        { key: "heightMode", label: "bin.heightMode", type: "select", default: "units", options: ["units", "mm"] },
        { key: "heightUnits", label: "bin.heightUnits", type: "number", default: 3, min: 2, max: 30, step: 1, visible: isUnits },
        { key: "heightMm", label: "bin.heightMm", type: "number", default: 21, min: 12, max: 300, step: 0.5, unit: "mm", visible: isMm },
        { key: "lip", label: "bin.lip", type: "bool", default: true },
      ],
    },
    {
      title: "group.compartments",
      fields: [
        { key: "divX", label: "bin.divX", type: "number", default: 1, min: 1, max: 12, step: 1 },
        { key: "divY", label: "bin.divY", type: "number", default: 1, min: 1, max: 12, step: 1 },
        { key: "scoop", label: "bin.scoop", type: "bool", default: false },
        { key: "label", label: "bin.label", type: "bool", default: false },
        { key: "labelDepth", label: "bin.labelDepth", type: "number", default: 12, min: 5, max: 25, step: 0.5, unit: "mm", visible: (p) => p.label === true },
      ],
    },
    {
      title: "group.walls",
      fields: [
        { key: "wall", label: "bin.wall", type: "number", default: 1.2, min: 0.8, max: 4, step: 0.05, unit: "mm" },
        { key: "divider", label: "bin.divider", type: "number", default: 1.2, min: 0.8, max: 4, step: 0.05, unit: "mm", visible: (p) => (p.divX as number) > 1 || (p.divY as number) > 1 },
        { key: "floor", label: "bin.floor", type: "number", default: 1.2, min: 0.6, max: 10, step: 0.1, unit: "mm" },
      ],
    },
    {
      title: "group.base",
      fields: [
        { key: "magnets", label: "bp.magnets", type: "bool", default: false },
        { key: "magnetDiameter", label: "bp.magnetDiameter", type: "number", default: 6.5, min: 2, max: 10, step: 0.05, unit: "mm", visible: (p) => p.magnets === true },
        { key: "magnetDepth", label: "bp.magnetDepth", type: "number", default: 2.4, min: 0.5, max: 4, step: 0.05, unit: "mm", visible: (p) => p.magnets === true },
        { key: "screws", label: "bin.screws", type: "bool", default: false },
      ],
    },
    printerGroup,
  ],
};
