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
import { Viewer } from "./ui/viewer";
import { CadClient } from "./worker/client";
import type { ExportFile, ExportFormat } from "./worker/protocol";

const schemas: Record<string, ModelSchema> = { baseplate: baseplateSchema, bin: binSchema, box: boxSchema, insert: insertSchema };
/** Models shown in the switcher but not built yet. */
const upcoming: string[] = [];

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

function renderInfo(facts: Message[], warnings: Message[]) {
  const facts$ = $("#facts");
  facts$.replaceChildren(...facts.map((f) => Object.assign(document.createElement("li"), { textContent: tm(f) })));
  const warn$ = $("#warnings");
  warn$.replaceChildren(...warnings.map((w) => Object.assign(document.createElement("li"), { textContent: tm(w) })));
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

function renderModelTabs() {
  const nav = $("#models");
  nav.replaceChildren();
  for (const id of Object.keys(schemas)) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t(`model.${id}`);
    b.setAttribute("aria-pressed", String(id === state.model));
    b.addEventListener("click", () => selectModel(id));
    nav.append(b);
  }
  for (const id of upcoming) {
    const b = document.createElement("button");
    b.type = "button";
    b.disabled = true;
    b.innerHTML = `${t(`model.${id}`)} <small>${t("model.soon")}</small>`;
    nav.append(b);
  }
}

function renderAll() {
  document.title = `Binfinity · ${t(`model.${state.model}`)}`;
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n!);
  renderModelTabs();
  renderForm($("#form"), schemas[state.model], state.params, (p) => {
    state.params = p;
    scheduleGenerate();
  });
  renderInfo(lastInfo.facts, lastInfo.warnings);
  renderStatus();
}

function selectModel(id: string, raw: Record<string, unknown> = {}) {
  if (id !== state.model) viewer.reframeNext();
  state.model = id;
  state.params = sanitize(schemas[id], raw);
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
