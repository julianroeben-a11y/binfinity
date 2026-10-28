import "./style.css";
import { zipSync } from "fflate";
import { getLang, languages, setLang, t, tm } from "./i18n";
import { baseplateSchema } from "./models/baseplate/schema";
import { binSchema } from "./models/bin/schema";
import { boxSchema } from "./models/box/schema";
import { insertSchema } from "./models/insert/schema";
import { sanitize, type Message, type ModelSchema, type Params } from "./models/types";
import { renderForm } from "./ui/form";
import { initUpdater } from "./ui/update";
import { icon, modelIcons } from "./ui/icons";
import { Viewer } from "./ui/viewer";
import { CadClient } from "./worker/client";
import type { ExportFile, ExportFormat } from "./worker/protocol";

const schemas: Record<string, ModelSchema> = { baseplate: baseplateSchema, bin: binSchema, box: boxSchema, insert: insertSchema };

/** The areas in the top bar and their models, shown in the rail on the left. */
const areas: { id: string; models: string[] }[] = [
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
  renderNav();
  $("#model-title").textContent = t(`model.${state.model}`);
  renderForm(
    $("#form"),
    schemas[state.model],
    state.params,
    (p) => {
      state.params = p;
      remember();
      scheduleGenerate();
    },
    remembered,
  );
  renderInfo(lastInfo.facts, lastInfo.warnings);
  renderStatus();
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
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
  b.addEventListener("click", () => {
    viewer.setMode(b.dataset.view as "plates" | "assembled");
    for (const o of document.querySelectorAll<HTMLButtonElement>("[data-view]")) o.setAttribute("aria-pressed", String(o === b));
  });
}
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
