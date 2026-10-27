// Shared model description used by both the UI (to render the form) and the
// CAD worker (to build geometry). Nothing in here may import replicad, so the
// main thread stays light.

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

interface FieldBase {
  key: string;
  /** i18n key for the label; a matching `<label>.hint` key is used as tooltip if present. */
  label: string;
  /** Only show (and use) this field when the predicate returns true. */
  visible?: (p: Params) => boolean;
}

export interface NumberField extends FieldBase {
  type: "number";
  default: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface BoolField extends FieldBase {
  type: "bool";
  default: boolean;
}

export interface SelectField extends FieldBase {
  type: "select";
  default: string;
  /** Option values; their labels are looked up as `<label>.<value>`. */
  options: string[];
}

export type Field = NumberField | BoolField | SelectField;

export interface FieldGroup {
  title: string;
  fields: Field[];
}

export interface ModelSchema {
  id: string;
  title: string;
  groups: FieldGroup[];
}

export function defaults(schema: ModelSchema): Params {
  const p: Params = {};
  for (const g of schema.groups) for (const f of g.fields) p[f.key] = f.default;
  return p;
}

/** Clamp and coerce untrusted values (URL hash, form input) to the schema. */
export function sanitize(schema: ModelSchema, input: Record<string, unknown>): Params {
  const p = defaults(schema);
  for (const g of schema.groups) {
    for (const f of g.fields) {
      const v = input[f.key];
      if (v === undefined) continue;
      if (f.type === "number") {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (Number.isFinite(n)) p[f.key] = Math.min(f.max, Math.max(f.min, n));
      } else if (f.type === "bool") {
        p[f.key] = v === true || v === "true" || v === "1";
      } else if (f.options.includes(String(v))) {
        p[f.key] = String(v);
      }
    }
  }
  return p;
}

/** A translatable message: i18n key plus values for its `{placeholders}`. */
export interface Message {
  key: string;
  vars?: Record<string, string | number>;
}

/** Result summary the worker sends back next to the meshes. */
export interface BuildInfo {
  /** Overall footprint in mm (before splitting). */
  size: [number, number, number];
  facts: Message[];
  warnings: Message[];
}

/** Thrown for invalid parameter combinations; shown to the user translated. */
export class ParamError extends Error {
  constructor(public readonly msg: Message) {
    super(msg.key);
  }
}
