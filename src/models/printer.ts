import type { FieldGroup } from "./types";

/** Print bed size, shared by every model: used to split, place and centre parts. */
export const printerGroup: FieldGroup = {
  title: "group.printer",
  fields: [
    { key: "bedX", label: "bp.bedX", type: "number", default: 256, min: 50, max: 1000, step: 1, unit: "mm" },
    { key: "bedY", label: "bp.bedY", type: "number", default: 256, min: 50, max: 1000, step: 1, unit: "mm" },
  ],
};
