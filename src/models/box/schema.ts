import { accentGroup, printerGroup } from "../printer";
import type { ModelSchema, Params } from "../types";

const isRect = (p: Params) => p.shape === "rect";
const hasLid = (p: Params) => p.lid === "lift";

export const boxSchema: ModelSchema = {
  id: "box",
  title: "model.box",
  groups: [
    {
      title: "group.size",
      open: true,
      fields: [
        { key: "shape", label: "box.shape", type: "select", default: "rect", options: ["rect", "round", "hex"] },
        { key: "sizeMode", label: "box.sizeMode", type: "select", default: "outer", options: ["outer", "inner"], advanced: true },
        { key: "width", label: "box.width", type: "number", default: 120, min: 10, max: 1000, step: 0.5, unit: "mm", visible: isRect },
        { key: "depth", label: "box.depth", type: "number", default: 80, min: 10, max: 1000, step: 0.5, unit: "mm", visible: isRect },
        { key: "diameter", label: "box.diameter", type: "number", default: 80, min: 10, max: 1000, step: 0.5, unit: "mm", visible: (p) => !isRect(p) },
        { key: "height", label: "box.height", type: "number", default: 50, min: 5, max: 1000, step: 0.5, unit: "mm" },
        { key: "cornerRadius", label: "box.cornerRadius", type: "number", default: 5, min: 0.5, max: 100, step: 0.5, unit: "mm", visible: (p) => p.shape !== "round", advanced: true },
      ],
    },
    {
      title: "group.walls",
      fields: [
        { key: "wall", label: "bin.wall", type: "number", default: 1.5, min: 0.8, max: 10, step: 0.05, unit: "mm" },
        { key: "floor", label: "bin.floor", type: "number", default: 1.5, min: 0.6, max: 20, step: 0.1, unit: "mm" },
        { key: "honeycomb", label: "bin.honeycomb", type: "bool", default: false, visible: isRect },
        { key: "honeycombSize", label: "bin.honeycombSize", type: "number", default: 8, min: 4, max: 30, step: 0.5, unit: "mm", visible: (p) => p.honeycomb === true && isRect(p) },
      ],
    },
    {
      title: "group.compartments",
      fields: [
        { key: "divX", label: "bin.divX", type: "number", default: 1, min: 1, max: 20, step: 1, visible: isRect },
        { key: "divY", label: "bin.divY", type: "number", default: 1, min: 1, max: 20, step: 1, visible: isRect },
        { key: "divider", label: "bin.divider", type: "number", default: 1.2, min: 0.8, max: 10, step: 0.05, unit: "mm", visible: (p) => isRect(p) && ((p.divX as number) > 1 || (p.divY as number) > 1) },
      ],
    },
    {
      title: "group.lidStack",
      fields: [
        { key: "stackable", label: "box.stackable", type: "bool", default: false },
        { key: "stackDepth", label: "box.stackDepth", type: "number", default: 3, min: 1, max: 20, step: 0.5, unit: "mm", visible: (p) => p.stackable === true },
        { key: "lid", label: "box.lid", type: "select", default: "none", options: ["none", "lift"] },
        { key: "lidThickness", label: "box.lidThickness", type: "number", default: 2, min: 0.8, max: 10, step: 0.1, unit: "mm", visible: hasLid },
        { key: "lidLip", label: "box.lidLip", type: "number", default: 5, min: 1, max: 30, step: 0.5, unit: "mm", visible: hasLid },
        { key: "clearance", label: "box.clearance", type: "number", default: 0.3, min: 0, max: 2, step: 0.05, unit: "mm", visible: (p) => p.stackable === true || hasLid(p) },
      ],
    },
    accentGroup,
    printerGroup,
  ],
};

/**
 * Free room in one compartment of a box (the whole inside without dividers):
 * size, corner radius and usable height below a lid or stacking rim. Round
 * and hexagonal boxes give the largest square that fits.
 */
export function boxCompartment(p: Params): { w: number; d: number; radius: number; height: number } {
  const rect = p.shape === "rect";
  const wall = p.wall as number;
  const inner = p.sizeMode === "inner";
  const stackable = p.stackable === true;
  const footInset = wall + (p.clearance as number);
  const floorZ = stackable ? Math.max(p.floor as number, (p.stackDepth as number) + footInset) : (p.floor as number);
  const height = inner ? floorZ + (p.height as number) : (p.height as number);
  const reach = Math.max(stackable ? (p.stackDepth as number) : 0, p.lid === "lift" ? (p.lidLip as number) : 0);
  const room = height - floorZ - reach;
  if (!rect) {
    const across = (p.diameter as number) + (inner ? 0 : -2 * wall);
    const side = across / Math.SQRT2;
    return { w: side, d: side, radius: 0, height: room };
  }
  const innerW = (p.width as number) - (inner ? 0 : 2 * wall);
  const innerD = (p.depth as number) - (inner ? 0 : 2 * wall);
  const divX = Math.round(p.divX as number);
  const divY = Math.round(p.divY as number);
  const divider = p.divider as number;
  const w = (innerW - (divX - 1) * divider) / divX;
  const d = (innerD - (divY - 1) * divider) / divY;
  const radius = Math.max(0.2, Math.min((p.cornerRadius as number) - wall, w / 2, d / 2));
  return { w, d, radius, height: room };
}
