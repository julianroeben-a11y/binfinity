import { has, t } from "../i18n";
import type { Field, ModelSchema, Params } from "../models/types";

/**
 * Renders a schema as a form. Calls `onChange` with the full parameter set on
 * every edit; visibility rules are re-evaluated after each change.
 */
export function renderForm(host: HTMLElement, schema: ModelSchema, values: Params, onChange: (p: Params) => void) {
  host.replaceChildren();
  const rows: { field: Field; row: HTMLElement }[] = [];

  const updateVisibility = () => {
    for (const { field, row } of rows) row.hidden = field.visible ? !field.visible(values) : false;
  };

  for (const group of schema.groups) {
    const fs = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = t(group.title);
    fs.append(legend);

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
          updateVisibility();
          onChange(values);
        });
        input = sel;
      } else if (field.type === "bool") {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = values[field.key] === true;
        cb.addEventListener("change", () => {
          values[field.key] = cb.checked;
          updateVisibility();
          onChange(values);
        });
        input = cb;
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
      fs.append(row);
      rows.push({ field, row });
    }
    host.append(fs);
  }
  updateVisibility();
}
