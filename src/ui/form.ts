import { has, t } from "../i18n";
import { formTabs, type Field, type FormTab, type ModelSchema, type Params, type SelectField } from "../models/types";

/** Tab shown per schema, and "more settings" sections the user opened or closed, kept across re-renders. */
const tabState = new Map<string, FormTab>();
const openState = new Map<string, boolean>();

/** Collapsible "more settings" section; starts open when `open` or when remembered so. */
function section(id: string, title: string, open: boolean) {
  const box = document.createElement("details");
  box.className = "more";
  box.open = openState.get(id) ?? open;
  const summary = document.createElement("summary");
  summary.textContent = title;
  box.append(summary);
  box.addEventListener("toggle", () => openState.set(id, box.open));
  return box;
}

/**
 * Renders a schema as a form in tabs: main settings, details and print.
 * Advanced fields are collapsed unless they hold a value the user changed; a
 * tab with changed values is marked. Calls `onChange` with the full parameter
 * set on every edit; visibility rules are re-evaluated after each change.
 */
export function renderForm(host: HTMLElement, schema: ModelSchema, values: Params, onChange: (p: Params) => void, models: Record<string, Params> = {}) {
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
    return f.type === "action" ? undefined : f.default;
  };
  const changed = (fields: Field[]) => fields.some((f) => f.type !== "action" && shown(f) && values[f.key] !== expected(f));
  const tabOf = (g: { tab?: FormTab }) => g.tab ?? "details";
  const tabsUsed = formTabs.filter((tab) => schema.groups.some((g) => tabOf(g) === tab));
  let current = tabState.get(schema.id) ?? "main";
  if (!tabsUsed.includes(current)) current = tabsUsed[0];
  const tabBar = document.createElement("div");
  tabBar.className = "tabs";
  tabBar.setAttribute("role", "tablist");
  const tabButtons = new Map<FormTab, HTMLButtonElement>();
  const panes = new Map<FormTab, HTMLElement>();
  for (const tab of tabsUsed) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.id = `tab-${tab}`;
    b.textContent = t(`form.tab.${tab}`);
    b.addEventListener("click", () => {
      current = tab;
      tabState.set(schema.id, tab);
      updateVisibility();
    });
    tabButtons.set(tab, b);
    tabBar.append(b);
    const pane = document.createElement("div");
    pane.className = "tab-pane";
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", b.id);
    panes.set(tab, pane);
  }
  host.append(tabBar, ...panes.values());

  const updateVisibility = () => {
    for (const { field, row } of rows) row.hidden = !shown(field);
    // Hide a whole group when none of its fields apply (e.g. compartments of a round box).
    for (const { box, fields } of sets) box.hidden = !fields.some(shown);
    for (const tab of tabsUsed) {
      const b = tabButtons.get(tab)!;
      b.setAttribute("aria-selected", String(tab === current));
      b.classList.toggle("changed", schema.groups.some((g) => tabOf(g) === tab && changed(g.fields)));
      panes.get(tab)!.hidden = tab !== current;
    }
  };

  for (const group of schema.groups) {
    const id = `${schema.id}:${group.title}`;
    const box = document.createElement("section");
    box.className = "group";
    const heading = document.createElement("h3");
    heading.textContent = t(group.title);
    box.append(heading);
    sets.push({ box, fields: group.fields });
    const extra = group.fields.filter((f) => f.advanced);
    const more = extra.length ? section(`${id}:more`, t("form.more"), changed(extra)) : null;
    if (more) sets.push({ box: more, fields: extra });

    for (const field of group.fields) {
      if (field.type === "action") {
        const row = document.createElement("div");
        row.className = "field field-action";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "small";
        button.textContent = t(field.label);
        const hintKey = `${field.label}.hint`;
        if (has(hintKey)) button.title = t(hintKey);
        button.addEventListener("click", () => {
          Object.assign(values, field.run(values, models));
          for (const k of Object.keys(values)) leavePresets(k);
          renderForm(host, schema, values, onChange, models);
          onChange(values);
        });
        row.append(button);
        if (has(hintKey)) {
          const hint = document.createElement("small");
          hint.className = "field-hint";
          hint.textContent = t(hintKey);
          row.append(hint);
        }
        (field.advanced ? more! : box).append(row);
        rows.push({ field, row });
        continue;
      }
      const row = document.createElement("label");
      row.className = `field field-${field.type}${field.type === "select" && field.presets ? " field-wide" : ""}`;
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
            renderForm(host, schema, values, onChange, models);
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
    panes.get(tabOf(group))!.append(box);
  }
  updateVisibility();
}
