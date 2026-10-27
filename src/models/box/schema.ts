import type { ModelSchema, Params } from "../types";

const isRect = (p: Params) => p.shape === "rect";
const hasLid = (p: Params) => p.lid === "lift";

export const boxSchema: ModelSchema = {
  id: "box",
  title: "model.box",
  groups: [
    {
      title: "group.size",
      fields: [
        { key: "shape", label: "box.shape", type: "select", default: "rect", options: ["rect", "round", "hex"] },
        { key: "sizeMode", label: "box.sizeMode", type: "select", default: "outer", options: ["outer", "inner"] },
        { key: "width", label: "box.width", type: "number", default: 120, min: 10, max: 1000, step: 0.5, unit: "mm", visible: isRect },
        { key: "depth", label: "box.depth", type: "number", default: 80, min: 10, max: 1000, step: 0.5, unit: "mm", visible: isRect },
        { key: "diameter", label: "box.diameter", type: "number", default: 80, min: 10, max: 1000, step: 0.5, unit: "mm", visible: (p) => !isRect(p) },
        { key: "height", label: "box.height", type: "number", default: 50, min: 5, max: 1000, step: 0.5, unit: "mm" },
        { key: "cornerRadius", label: "box.cornerRadius", type: "number", default: 5, min: 0.5, max: 100, step: 0.5, unit: "mm", visible: isRect },
      ],
    },
    {
      title: "group.walls",
      fields: [
        { key: "wall", label: "bin.wall", type: "number", default: 1.6, min: 0.8, max: 10, step: 0.05, unit: "mm" },
        { key: "floor", label: "bin.floor", type: "number", default: 1.6, min: 0.6, max: 20, step: 0.1, unit: "mm" },
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
  ],
};
