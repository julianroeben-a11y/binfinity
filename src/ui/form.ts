import { has, t } from "../i18n";
import type { Field, ModelSchema, Params, SelectField } from "../models/types";

/** Groups the user opened or closed, by schema and group, kept across re-renders. */
const openState = new Map<string, boolean>();

/** Collapsible section; starts open when `open` or when remembered so. */
function section(id: string, title: string, open: boolean, className: string) {
  const box = document.createElement("details");
  box.className = className;
  box.open = openState.get(id) ?? open;
  const summary = document.createElement("summary");
  summary.textContent = title;
  box.append(summary);
  box.addEventListener("toggle", () => openState.set(id, box.open));
  return box;
}

/**
 * Renders a schema as a form. Only the main fields are shown at first; the
 * other groups and the advanced fields are collapsed unless they hold a value
 * the user changed. Calls `onChange` with the full parameter set on
 * every edit; visibility rules are re-evaluated after each change.
 */
export function renderForm(host: HTMLElement, schema: ModelSchema, values: Params, onChange: (p: Params) => void) {
  host.replaceChildren();
  const rows: { field: Field; row: HTMLElement }[] = [];
  const selects = new Map<string, HTMLSelectElement>();
  const presetFields = schema.groups.flatMap((g) => g.fields).filter((f): f is SelectField => f.type === "select" && !!f.presets);

  // A hand-edited value no longer matches the picked preset.
  const leavePresets = (key: string) => {
    for (const f of presetFields) {
      const preset = f.presets![String(values[f.key])];
      if (!preset || !(key in preset) || preset[key] === values[key] || !f.options.includes("custom")) continue;
      values[f.key] = "custom";
      selects.get(f.key)!.value = "custom";
    }
  };
  const sets: { box: HTMLElement; fields: Field[] }[] = [];

  const shown = (f: Field) => (f.visible ? f.visible(values) : true);
  // Value a field has unless the user changed it: the default, or what the
  // picked preset put there.
  const expected = (f: Field) => {
    for (const s of presetFields) {
      const preset = s.presets![String(values[s.key])];
      if (preset && f.key in preset) return preset[f.key];
    }
    return f.default;
  };
  const changed = (fields: Field[]) => fields.some((f) => shown(f) && values[f.key] !== expected(f));
  const updateVisibility = () => {
    for (const { field, row } of rows) row.hidden = !shown(field);
    // Hide a whole group when none of its fields apply (e.g. compartments of a round box).
    for (const { box, fields } of sets) box.hidden = !fields.some(shown);
  };

  for (const group of schema.groups) {
    const id = `${schema.id}:${group.title}`;
    const box = section(id, t(group.title), group.open === true || changed(group.fields), "group");
    sets.push({ box, fields: group.fields });
    const extra = group.fields.filter((f) => f.advanced);
    const more = extra.length ? section(`${id}:more`, t("form.more"), changed(extra), "more") : null;
    if (more) sets.push({ box: more, fields: extra });

    for (const field of group.fields) {
      const row = document.createElement("label");
      row.className = `field field-${field.type}`;
      const name = document.createElement("span");
      name.className = "field-label";
      name.textContent = t(field.label);
      const hintKey = `${field.label}.hint`;
      if (has(hintKey)) {
        const hint = document.createElement("small");
        hint.className = "field-hint";
        hint.textContent = t(hintKey);
        name.append(hint);
      }

      let input: HTMLInputElement | HTMLSelectElement;
      if (field.type === "select") {
        const sel = document.createElement("select");
        for (const opt of field.options) sel.append(new Option(t(`${field.label}.${opt}`), opt));
        sel.value = String(values[field.key]);
        sel.addEventListener("change", () => {
          values[field.key] = sel.value;
          const preset = field.presets?.[sel.value];
          if (preset) {
            // Other inputs show the old values, so draw the form again.
            Object.assign(values, preset);
            renderForm(host, schema, values, onChange);
          } else {
            leavePresets(field.key);
            updateVisibility();
          }
          onChange(values);
        });
        selects.set(field.key, sel);
        input = sel;
      } else if (field.type === "bool") {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = values[field.key] === true;
        cb.addEventListener("change", () => {
          values[field.key] = cb.checked;
          leavePresets(field.key);
          updateVisibility();
          onChange(values);
        });
        input = cb;
      } else if (field.type === "text") {
        const txt = document.createElement("input");
        txt.type = "text";
        txt.maxLength = field.maxLength;
        txt.value = String(values[field.key]);
        if (field.placeholder) txt.placeholder = field.placeholder;
        txt.addEventListener("input", () => {
          values[field.key] = txt.value;
          leavePresets(field.key);
          updateVisibility();
          onChange(values);
        });
        input = txt;
      } else {
        const num = document.createElement("input");
        num.type = "number";
        num.inputMode = "decimal";
        num.min = String(field.min);
        num.max = String(field.max);
        num.step = String(field.step);
        num.value = String(values[field.key]);
        const commit = () => {
          const v = parseFloat(num.value);
          if (!Number.isFinite(v) || v < field.min || v > field.max) {
            num.setAttribute("aria-invalid", "true");
            return;
          }
          num.removeAttribute("aria-invalid");
          if (v === values[field.key]) return;
          values[field.key] = v;
          leavePresets(field.key);
          updateVisibility();
          onChange(values);
        };
        num.addEventListener("input", commit);
        num.addEventListener("blur", () => {
          num.value = String(values[field.key]);
          num.removeAttribute("aria-invalid");
        });
        input = num;
      }
      input.name = field.key;

      const control = document.createElement("span");
      control.className = "field-control";
      control.append(input);
      if (field.type === "number" && field.unit) {
        const unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = field.unit;
        control.append(unit);
      }
      if (field.type === "bool") row.append(control, name);
      else row.append(name, control);
      (field.advanced ? more! : box).append(row);
      rows.push({ field, row });
    }
    if (more) box.append(more);
    host.append(box);
  }
  updateVisibility();
}
