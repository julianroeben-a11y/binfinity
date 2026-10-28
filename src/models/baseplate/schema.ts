import { accentGroup, printerGroup } from "../printer";
import type { ModelSchema, Params } from "../types";

const isDrawer = (p: Params) => p.sizeMode === "drawer";
const isGrid = (p: Params) => p.sizeMode === "grid";
const isSolid = (p: Params) => p.style === "solid";

export const baseplateSchema: ModelSchema = {
  id: "baseplate",
  title: "model.baseplate",
  groups: [
    {
      title: "group.size",
      open: true,
      fields: [
        { key: "sizeMode", label: "bp.sizeMode", type: "select", default: "grid", options: ["grid", "drawer"] },
        { key: "gridX", label: "bp.gridX", type: "number", default: 4, min: 1, max: 40, step: 1, visible: isGrid },
        { key: "gridY", label: "bp.gridY", type: "number", default: 3, min: 1, max: 40, step: 1, visible: isGrid },
        { key: "drawerX", label: "bp.drawerX", type: "number", default: 300, min: 42, max: 2000, step: 0.5, unit: "mm", visible: isDrawer },
        { key: "drawerY", label: "bp.drawerY", type: "number", default: 400, min: 42, max: 2000, step: 0.5, unit: "mm", visible: isDrawer },
        { key: "clearance", label: "bp.clearance", type: "number", default: 0.5, min: 0, max: 10, step: 0.1, unit: "mm", visible: isDrawer, advanced: true },
        { key: "alignX", label: "bp.alignX", type: "select", default: "center", options: ["center", "start", "end"], visible: isDrawer, advanced: true },
        { key: "alignY", label: "bp.alignY", type: "select", default: "center", options: ["center", "start", "end"], visible: isDrawer, advanced: true },
      ],
    },
    {
      title: "group.style",
      fields: [
        { key: "style", label: "bp.style", type: "select", default: "slim", options: ["slim", "solid"] },
        { key: "floor", label: "bp.floor", type: "number", default: 3, min: 0.6, max: 10, step: 0.1, unit: "mm", visible: isSolid },
        { key: "magnets", label: "bp.magnets", type: "bool", default: false, visible: isSolid },
        { key: "magnetDiameter", label: "bp.magnetDiameter", type: "number", default: 6.5, min: 2, max: 12, step: 0.05, unit: "mm", visible: (p) => isSolid(p) && p.magnets === true },
        { key: "magnetDepth", label: "bp.magnetDepth", type: "number", default: 2.4, min: 0.5, max: 10, step: 0.05, unit: "mm", visible: (p) => isSolid(p) && p.magnets === true },
        { key: "screws", label: "bp.screws", type: "bool", default: false, visible: isSolid },
        { key: "connector", label: "bp.connector", type: "select", default: "none", options: ["none", "puzzle", "peg", "pins"], visible: isSolid },
        { key: "connectorClearance", label: "bp.connectorClearance", type: "number", default: 0.15, min: 0, max: 1, step: 0.05, unit: "mm", visible: (p) => isSolid(p) && (p.connector === "puzzle" || p.connector === "peg") },
        { key: "cornerRadius", label: "bp.cornerRadius", type: "number", default: 4, min: 0.5, max: 20, step: 0.5, unit: "mm" },
      ],
    },
    accentGroup,
    printerGroup,
  ],
};
