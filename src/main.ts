import "./style.css";
import { zipSync } from "fflate";
import { getLang, languages, setLang, t, tm } from "./i18n";
import { baseplateSchema } from "./models/baseplate/schema";
import { binSchema } from "./models/bin/schema";
import { boxSchema } from "./models/box/schema";
import { insertSchema } from "./models/insert/schema";
import { layoutBaseplate } from "./models/baseplate/layout";
import { conflicts, drawerSchema, footprint, freeSpot, itemDiff, itemParams, itemSchema, parseItems, type DrawerItem } from "./models/drawer/schema";
import { drawerBaseplate } from "./models/drawer/build";
import { HEIGHT_UNIT, LIP_HEIGHT } from "./models/gridfinity";
import { sanitize, type Message, type ModelSchema, type Params } from "./models/types";
import { renderForm } from "./ui/form";
import { initUpdater } from "./ui/update";
import { icon, modelIcons } from "./ui/icons";
import { Planner } from "./ui/planner";
import { Viewer } from "./ui/viewer";
import { CadClient } from "./worker/client";
import type { ExportFile, ExportFormat } from "./worker/protocol";

const schemas: Record<string, ModelSchema> = { drawer: drawerSchema, baseplate: baseplateSchema, bin: binSchema, box: boxSchema, insert: insertSchema };

/** The areas in the top bar and their models, shown in the rail on the left. */
const areas: { id: string; models: string[] }[] = [
  { id: "drawer", models: ["drawer"] },
  { id: "gridfinity", models: ["baseplate", "bin", "insert"] },
  { id: "organizer", models: ["box"] },
];
const areaOf = (model: string) => areas.find((a) => a.models.includes(model))!;
/** Model last used in each area, so switching areas comes back to it. */
const lastInArea: Record<string, string> = {};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const state = {
  model: "baseplate",
  params: {} as Params,
  status: { key: "app.loading" } as Message,
  error: null as Message | null,
  busy: true,
  /** Drawer: the part being edited, and whether the plan or the 3D view is shown. */
  part: null as number | null,
  planView: "plan" as "plan" | "3d",
};

function readHash(): { model: string; params: Record<string, string> } {
  const q = new URLSearchParams(location.hash.slice(1));
  const model = q.get("model") ?? "baseplate";
  q.delete("model");
  return { model: schemas[model] ? model : "baseplate", params: Object.fromEntries(q) };
}

function writeHash() {
  const q = new URLSearchParams({ model: state.model });
  for (const [k, v] of Object.entries(state.params)) q.set(k, String(v));
  history.replaceState(null, "", `#${q}`);
}

const viewer = new Viewer($("#viewport"));
const cad = new CadClient();
cad.onStage = (stage) => {
  state.status = { key: `app.${stage}` };
  renderStatus();
};

function renderStatus() {
  $("#status").textContent = state.error ? tm(state.error) : tm(state.status);
  $("#status").classList.toggle("error", !!state.error);
  $("#status").classList.toggle("busy", state.busy);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-export]")) b.disabled = state.busy || !!state.error;
}

/** Facts shown in the estimate box under the form instead of on the stage. */
const ESTIMATE_FACTS = ["fact.estimate", "fact.colourChanges"];

function renderInfo(facts: Message[], warnings: Message[]) {
  const facts$ = $("#facts");
  const chips = facts.filter((f) => !ESTIMATE_FACTS.includes(f.key));
  facts$.replaceChildren(...chips.map((f) => Object.assign(document.createElement("li"), { textContent: tm(f) })));
  renderEstimate(facts);
  const warn$ = $("#warnings");
  warn$.replaceChildren(...warnings.map((w) => Object.assign(document.createElement("li"), { textContent: tm(w) })));
}

function renderEstimate(facts: Message[]) {
  const est = facts.find((f) => f.key === "fact.estimate");
  const changes = facts.find((f) => f.key === "fact.colourChanges");
  const box = $("#estimate");
  box.hidden = !est;
  if (!est) return;
  const item = (label: string, value: string) => {
    const div = document.createElement("div");
    div.append(Object.assign(document.createElement("dt"), { textContent: label }), Object.assign(document.createElement("dd"), { textContent: value }));
    return div;
  };
  box.replaceChildren(
    item(t("estimate.filament"), tm({ key: "estimate.grams", vars: est.vars })),
    item(t("estimate.time"), String(est.vars?.time ?? "")),
    item(t("estimate.changes"), String(changes?.vars?.n ?? 0)),
  );
  box.title = tm({ key: "estimate.hint", vars: est.vars });
}

let lastInfo: { facts: Message[]; warnings: Message[] } = { facts: [], warnings: [] };
let debounce: number | undefined;

function scheduleGenerate() {
  writeHash();
  clearTimeout(debounce);
  debounce = window.setTimeout(generate, 250);
}

async function generate() {
  state.busy = true;
  state.error = null;
  renderStatus();
  try {
    const res = await cad.generate(state.model, { ...state.params });
    if (!res) return; // superseded by a newer request
    viewer.setPieces(res.pieces, res.plates);
    lastInfo = res.info;
    renderInfo(res.info.facts, res.info.warnings);
    state.status = { key: "app.ready", vars: { ms: res.ms } };
    state.busy = false;
  } catch (err) {
    state.error = isMessage(err) ? err : { key: "err.internal", vars: { detail: String(err) } };
    state.busy = false;
  }
  renderStatus();
}

function isMessage(x: unknown): x is Message {
  return typeof x === "object" && x !== null && typeof (x as Message).key === "string";
}

function download(name: string, bytes: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function doExport(format: ExportFormat) {
  const before = state.status;
  state.busy = true;
  renderStatus();
  try {
    const fine = $<HTMLInputElement>("#fine").checked;
    const { files } = await cad.export(format, fine ? "fine" : "normal");
    if (files.length === 1) {
      download(files[0].name, files[0].bytes, format === "3mf" ? "model/3mf" : "model/stl");
    } else {
      const zip = zipSync(Object.fromEntries(files.map((f: ExportFile) => [f.name, f.bytes])));
      download(`binfinity_${state.model}_stl.zip`, zip, "application/zip");
    }
    state.status = before;
  } catch (err) {
    state.error = isMessage(err) ? err : { key: "err.internal", vars: { detail: String(err) } };
  }
  state.busy = false;
  renderStatus();
}

function renderNav() {
  const current = areaOf(state.model);
  $("#areas").replaceChildren(
    ...areas.map((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t(`area.${a.id}`);
      b.setAttribute("aria-pressed", String(a === current));
      b.addEventListener("click", () => a !== current && selectModel(lastInArea[a.id] ?? a.models[0]));
      return b;
    }),
  );
  $("#rail").replaceChildren(
    ...current.models.map((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rail-item";
      b.setAttribute("aria-pressed", String(id === state.model));
      b.append(icon(modelIcons[id]), Object.assign(document.createElement("span"), { textContent: t(`model.${id}`) }));
      b.addEventListener("click", () => id !== state.model && selectModel(id));
      return b;
    }),
  );
}

function renderAll() {
  document.title = `Binfinity · ${t(`model.${state.model}`)}`;
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n!);
  const drawer = state.model === "drawer";
  document.body.classList.toggle("area-drawer", drawer);
  $("#rail").hidden = drawer;
  $("#plan-toggle").hidden = !drawer;
  renderNav();
  renderPanel();
  renderPlan();
  renderInfo(lastInfo.facts, lastInfo.warnings);
  renderStatus();
}

/** The model's form, or in a drawer the form of the part being edited. */
function renderPanel() {
  const items = drawerItems();
  if (state.part !== null && !items[state.part]) state.part = null;
  const part = state.model === "drawer" && state.part !== null ? state.part : null;
  $("#plan-back").hidden = part === null;
  $("#part-actions").hidden = part === null;
  if (part === null) {
    $("#model-title").textContent = t(`model.${state.model}`);
    renderForm($("#form"), schemas[state.model], state.params, (p) => commit(p), remembered);
    return;
  }
  const item = items[part];
  const f = footprint(item, state.params);
  $("#model-title").textContent = `${t(`model.${item.m}`)} ${f.w} × ${f.d}`;
  renderForm($("#form"), itemSchema(item.m), itemParams(item, state.params), (p) => {
    const before = `${f.w}x${f.d}`;
    items[part] = { ...item, p: itemDiff(item.m, p) };
    const now = footprint(items[part], state.params);
    setItems(items);
    if (`${now.w}x${now.d}` !== before) $("#model-title").textContent = `${t(`model.${item.m}`)} ${now.w} × ${now.d}`;
  });
}

function commit(p: Params) {
  state.params = p;
  remember();
  scheduleGenerate();
}

// --- drawer -------------------------------------------------------------------

const drawerItems = (): DrawerItem[] => (state.model === "drawer" ? parseItems(state.params.items) : []);

function setItems(items: DrawerItem[]) {
  state.params.items = JSON.stringify(items);
  commit(state.params);
  renderPlan();
}

/** Cells of the drawer's baseplate, or null if the drawer is too small. */
function drawerCells(): [number, number] | null {
  try {
    const l = layoutBaseplate(drawerBaseplate(state.params));
    return [l.x.cells, l.y.cells];
  } catch {
    return null;
  }
}

const planner = new Planner($("#plan-area"), {
  select: (i) => {
    state.part = i;
    renderPanel();
    renderPlan();
  },
  move: (i, x, y) => {
    const cells = drawerCells();
    const items = drawerItems();
    if (!cells || !items[i]) return;
    const moved = items.map((it, k) => (k === i ? { ...it, x, y } : it));
    const bad = conflicts(moved, state.params, cells[0], cells[1]);
    // Only accept a place inside the grid and free of other parts.
    if (bad.outside.includes(i) || bad.overlap.length > conflicts(items, state.params, cells[0], cells[1]).overlap.length) return;
    setItems(moved);
  },
});

function renderPlan() {
  const show = state.model === "drawer" && state.planView === "plan";
  $("#plan").hidden = !show;
  $("#view-toggle").hidden = show;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-plan]")) b.setAttribute("aria-pressed", String(b.dataset.plan === state.planView));
  if (state.model !== "drawer") return;
  const cells = drawerCells();
  const items = drawerItems();
  if (!cells) return;
  const bad = conflicts(items, state.params, cells[0], cells[1]);
  let used = 0;
  const parts = items.map((item, i) => {
    const f = footprint(item, state.params);
    const p = itemParams(item, state.params);
    const ok = !bad.outside.includes(i) && !bad.overlap.includes(i);
    if (ok) used += f.w * f.d;
    const text = item.m === "bin" ? String(p.labelText ?? "").split(";")[0].trim() : t(`insert.preset.${p.preset}`);
    return { ...f, kind: item.m, title: `${t(`model.${item.m}`)} ${f.w}×${f.d}`, detail: text, bad: !ok };
  });
  planner.render({ cellsX: cells[0], cellsY: cells[1], parts, selected: state.part });
  $("#plan-free").textContent = t("plan.free", { n: cells[0] * cells[1] - used });
}

/** Tallest part height in units that still fits under the drawer's height. */
function unitsForDrawer(): number {
  const floor = state.params.style === "solid" ? (state.params.floor as number) : 0;
  const room = (state.params.drawerZ as number) - floor - LIP_HEIGHT;
  return Math.max(2, Math.min(30, Math.floor(room / HEIGHT_UNIT)));
}

function addPart(m: string, w: number, d: number) {
  const cells = drawerCells();
  const items = drawerItems();
  const spot = cells && (freeSpot(items, state.params, cells[0], cells[1], w, d) ?? freeSpot(items, state.params, cells[0], cells[1], 1, 1));
  if (!spot) {
    state.status = { key: "plan.full" };
    renderStatus();
    return;
  }
  // Bins as tall as the drawer allows; inserts keep their automatic height.
  const own: Params = m === "bin" ? { heightUnits: unitsForDrawer() } : {};
  const fits = freeSpot(items, state.params, cells![0], cells![1], w, d);
  items.push({ m, x: spot[0], y: spot[1], p: itemDiff(m, itemParams({ m, x: 0, y: 0, p: { gridX: fits ? w : 1, gridY: fits ? d : 1, ...own } }, state.params)) });
  state.part = items.length - 1;
  setItems(items);
  renderPanel();
}

/**
 * Last settings of every model in this browser tab, so switching models keeps
 * them and one model can take values from another (insert from box).
 */
const remembered: Record<string, Params> = (() => {
  try {
    return JSON.parse(sessionStorage.getItem("binfinity.params") ?? "{}") as Record<string, Params>;
  } catch {
    return {};
  }
})();

function remember() {
  remembered[state.model] = { ...state.params };
  try {
    sessionStorage.setItem("binfinity.params", JSON.stringify(remembered));
  } catch {
    // Storage can be blocked; switching models then starts from the defaults.
  }
}

function selectModel(id: string, raw?: Record<string, unknown>) {
  if (id !== state.model) viewer.reframeNext();
  state.part = null;
  // A drawer is looked at assembled, everything else on the print beds.
  if ((id === "drawer") !== (state.model === "drawer")) setViewMode(id === "drawer" ? "assembled" : "plates");
  state.model = id;
  lastInArea[areaOf(id).id] = id;
  state.params = sanitize(schemas[id], raw ?? remembered[id] ?? {});
  remember();
  renderAll();
  scheduleGenerate();
}

// --- wiring -----------------------------------------------------------------

const langSel = $<HTMLSelectElement>("#lang");
for (const l of languages) langSel.append(new Option(l.toUpperCase(), l));
langSel.value = getLang();
setLang(getLang());
langSel.addEventListener("change", () => {
  setLang(langSel.value);
  renderAll();
});

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-export]")) {
  b.addEventListener("click", () => doExport(b.dataset.export as ExportFormat));
}
$("#reset-view").addEventListener("click", () => viewer.frame());

// Preview colours only; they are remembered in this browser and never change the model.
const colorInputs = [$<HTMLInputElement>("#color-body"), $<HTMLInputElement>("#color-accent")];
try {
  const saved = JSON.parse(localStorage.getItem("binfinity.colors") ?? "null") as string[] | null;
  if (saved) saved.forEach((c, i) => colorInputs[i] && (colorInputs[i].value = c));
} catch {
  // storage blocked; keep the defaults
}
const applyColors = () => {
  viewer.setColors(colorInputs[0].value, colorInputs[1].value);
  try {
    localStorage.setItem("binfinity.colors", JSON.stringify(colorInputs.map((c) => c.value)));
  } catch {
    // storage blocked; colours still apply for this visit
  }
};
for (const c of colorInputs) c.addEventListener("input", applyColors);
applyColors();
function setViewMode(mode: "plates" | "assembled") {
  viewer.setMode(mode);
  for (const o of document.querySelectorAll<HTMLButtonElement>("[data-view]")) o.setAttribute("aria-pressed", String(o.dataset.view === mode));
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
  b.addEventListener("click", () => setViewMode(b.dataset.view as "plates" | "assembled"));
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-plan]")) {
  b.addEventListener("click", () => {
    state.planView = b.dataset.plan as "plan" | "3d";
    renderPlan();
  });
}
$("#add-bin").addEventListener("click", () => addPart("bin", 1, 1));
$("#add-insert").addEventListener("click", () => addPart("insert", 2, 1));
$("#plan-back").addEventListener("click", () => {
  state.part = null;
  renderPanel();
  renderPlan();
});
$("#part-remove").addEventListener("click", () => {
  const items = drawerItems();
  if (state.part === null) return;
  items.splice(state.part, 1);
  state.part = null;
  setItems(items);
  renderPanel();
});
$("#part-duplicate").addEventListener("click", () => {
  const items = drawerItems();
  const cells = drawerCells();
  if (state.part === null || !cells || !items[state.part]) return;
  const item = items[state.part];
  const f = footprint(item, state.params);
  const spot = freeSpot(items, state.params, cells[0], cells[1], f.w, f.d);
  if (!spot) {
    state.status = { key: "plan.full" };
    renderStatus();
    return;
  }
  items.push({ ...item, x: spot[0], y: spot[1] });
  state.part = items.length - 1;
  setItems(items);
  renderPanel();
});
$("#share").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $("#share").textContent = t("export.copied");
    setTimeout(() => ($("#share").textContent = t("export.share")), 1500);
  } catch {
    // clipboard blocked; the URL in the address bar is still shareable
  }
});

initUpdater($<HTMLAnchorElement>("#version"), $<HTMLButtonElement>("#update"));

const initial = readHash();
selectModel(initial.model, initial.params);
