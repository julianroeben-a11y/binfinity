import type { Message } from "./models/types";

type Dict = Record<string, string>;

const en: Dict = {
  "app.tagline": "Parametric Gridfinity & storage generator",
  "app.loading": "Loading CAD engine…",
  "app.building": "Building model…",
  "app.meshing": "Preparing preview…",
  "app.exporting": "Preparing download…",
  "app.ready": "Built in {ms} ms",
  "app.source": "Source code",
  "app.language": "Language",

  "model.baseplate": "Baseplate",
  "model.bin": "Bin",
  "model.box": "Box",
  "model.soon": "coming soon",

  "group.size": "Size",
  "group.style": "Style",
  "group.printer": "Printer",

  "bp.sizeMode": "Size by",
  "bp.sizeMode.grid": "Grid units",
  "bp.sizeMode.drawer": "Drawer size",
  "bp.gridX": "Width (units)",
  "bp.gridY": "Depth (units)",
  "bp.drawerX": "Drawer width",
  "bp.drawerY": "Drawer depth",
  "bp.clearance": "Clearance",
  "bp.clearance.hint": "Total play subtracted from the drawer size per axis, so the plate drops in easily.",
  "bp.alignX": "Horizontal alignment",
  "bp.alignX.center": "Centered",
  "bp.alignX.start": "Left",
  "bp.alignX.end": "Right",
  "bp.alignY": "Vertical alignment",
  "bp.alignY.center": "Centered",
  "bp.alignY.start": "Front",
  "bp.alignY.end": "Back",
  "bp.style": "Type",
  "bp.style.hint": "Slim plates have open cells and save filament. A floor is needed for magnets and screws.",
  "bp.style.slim": "Slim",
  "bp.style.solid": "With floor",
  "bp.floor": "Floor thickness",
  "bp.magnets": "Magnet holes",
  "bp.magnetDiameter": "Magnet hole Ø",
  "bp.magnetDiameter.hint": "6.5 mm fits standard 6 × 2 mm magnets with a press fit.",
  "bp.magnetDepth": "Magnet hole depth",
  "bp.screws": "Countersunk screw holes",
  "bp.screws.hint": "One M3 countersunk hole per cell to screw the plate into a drawer.",
  "bp.cornerRadius": "Outer corner radius",
  "bp.bedX": "Bed width",
  "bp.bedY": "Bed depth",
  "bp.bedX.hint": "Plates larger than the bed are split automatically. Bambu Lab P2S: 256 × 256 mm.",

  "fact.cells": "{x} × {y} cells",
  "fact.size": "{x} × {y} × {z} mm",
  "fact.pieces": "{n} piece(s) ({x} × {y})",
  "fact.padding": "Padding L {l} · R {r} · F {f} · B {b} mm",

  "warn.magnetThrough": "Magnet holes are as deep as the floor and go all the way through.",

  "err.drawerTooSmall": "The drawer must be at least {min} mm in each direction.",
  "err.bedTooSmall": "The print bed must be at least {size} mm to fit one cell plus padding.",
  "err.unknownModel": "Unknown model.",
  "err.nothingToExport": "Nothing to export yet.",
  "err.internal": "Something went wrong: {detail}",

  "export.3mf": "Download 3MF",
  "export.stl": "Download STL",
  "export.fine": "Fine mesh",
  "export.hint3mf": "Recommended for Bambu Studio. Split pieces are separate objects; press A to arrange them.",
  "export.share": "Copy link",
  "export.copied": "Link copied",
  "view.reset": "Reset view",
};

const de: Dict = {
  "app.tagline": "Parametrischer Gridfinity- & Aufbewahrungs-Generator",
  "app.loading": "CAD-Engine wird geladen…",
  "app.building": "Modell wird erstellt…",
  "app.meshing": "Vorschau wird vorbereitet…",
  "app.exporting": "Download wird vorbereitet…",
  "app.ready": "Erstellt in {ms} ms",
  "app.source": "Quellcode",
  "app.language": "Sprache",

  "model.baseplate": "Baseplate",
  "model.bin": "Bin",
  "model.box": "Box",
  "model.soon": "bald",

  "group.size": "Größe",
  "group.style": "Ausführung",
  "group.printer": "Drucker",

  "bp.sizeMode": "Größe nach",
  "bp.sizeMode.grid": "Rastereinheiten",
  "bp.sizeMode.drawer": "Schubladenmaß",
  "bp.gridX": "Breite (Einheiten)",
  "bp.gridY": "Tiefe (Einheiten)",
  "bp.drawerX": "Schubladenbreite",
  "bp.drawerY": "Schubladentiefe",
  "bp.clearance": "Spiel",
  "bp.clearance.hint": "Wird pro Achse vom Schubladenmaß abgezogen, damit die Platte leicht hineinpasst.",
  "bp.alignX": "Ausrichtung horizontal",
  "bp.alignX.center": "Mittig",
  "bp.alignX.start": "Links",
  "bp.alignX.end": "Rechts",
  "bp.alignY": "Ausrichtung vertikal",
  "bp.alignY.center": "Mittig",
  "bp.alignY.start": "Vorne",
  "bp.alignY.end": "Hinten",
  "bp.style": "Typ",
  "bp.style.hint": "Schlanke Platten haben offene Felder und sparen Filament. Für Magnete und Schrauben braucht es einen Boden.",
  "bp.style.slim": "Schlank",
  "bp.style.solid": "Mit Boden",
  "bp.floor": "Bodenstärke",
  "bp.magnets": "Magnetlöcher",
  "bp.magnetDiameter": "Magnetloch Ø",
  "bp.magnetDiameter.hint": "6,5 mm passt für Standard-Magnete 6 × 2 mm (Presspassung).",
  "bp.magnetDepth": "Magnetloch-Tiefe",
  "bp.screws": "Senkkopf-Schraublöcher",
  "bp.screws.hint": "Ein M3-Senkloch pro Feld, um die Platte in der Schublade festzuschrauben.",
  "bp.cornerRadius": "Eckenradius außen",
  "bp.bedX": "Druckbett Breite",
  "bp.bedY": "Druckbett Tiefe",
  "bp.bedX.hint": "Platten, die größer als das Druckbett sind, werden automatisch geteilt. Bambu Lab P2S: 256 × 256 mm.",

  "fact.cells": "{x} × {y} Felder",
  "fact.size": "{x} × {y} × {z} mm",
  "fact.pieces": "{n} Teil(e) ({x} × {y})",
  "fact.padding": "Rand L {l} · R {r} · V {f} · H {b} mm",

  "warn.magnetThrough": "Die Magnetlöcher sind so tief wie der Boden und gehen ganz durch.",

  "err.drawerTooSmall": "Die Schublade muss in jede Richtung mindestens {min} mm groß sein.",
  "err.bedTooSmall": "Das Druckbett muss mindestens {size} mm groß sein, damit ein Feld plus Rand passt.",
  "err.unknownModel": "Unbekanntes Modell.",
  "err.nothingToExport": "Noch nichts zum Exportieren.",
  "err.internal": "Etwas ist schiefgelaufen: {detail}",

  "export.3mf": "3MF herunterladen",
  "export.stl": "STL herunterladen",
  "export.fine": "Feines Netz",
  "export.hint3mf": "Empfohlen für Bambu Studio. Geteilte Platten sind einzelne Objekte; mit A anordnen.",
  "export.share": "Link kopieren",
  "export.copied": "Link kopiert",
  "view.reset": "Ansicht zurücksetzen",
};

const dicts: Record<string, Dict> = { en, de };
export const languages = Object.keys(dicts);

let lang = detect();

function detect(): string {
  try {
    const saved = localStorage.getItem("binfinity.lang");
    if (saved && dicts[saved]) return saved;
  } catch {
    // storage unavailable (private mode etc.)
  }
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export function getLang(): string {
  return lang;
}

export function setLang(l: string) {
  if (!dicts[l]) return;
  lang = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem("binfinity.lang", l);
  } catch {
    // ignore
  }
}

export function has(key: string): boolean {
  return key in dicts[lang] || key in en;
}

export function t(key: string, vars?: Message["vars"]): string {
  const s = dicts[lang][key] ?? en[key] ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) return `{${k}}`;
    return typeof v === "number" ? v.toLocaleString(lang, { maximumFractionDigits: 2 }) : v;
  });
}

export function tm(m: Message): string {
  return t(m.key, m.vars);
}
