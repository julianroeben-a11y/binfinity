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

  "group.compartments": "Compartments",
  "group.walls": "Walls",
  "group.base": "Base",
  "bin.gridX": "Width (units)",
  "bin.gridY": "Depth (units)",
  "bin.heightMode": "Height in",
  "bin.heightMode.units": "Units (7 mm)",
  "bin.heightMode.mm": "Millimetres",
  "bin.heightUnits": "Height (units)",
  "bin.heightUnits.hint": "Without the stacking lip. 3 units = 21 mm.",
  "bin.heightMm": "Height",
  "bin.lip": "Stacking lip",
  "bin.lip.hint": "Lets you stack bins on top of each other (adds 4.4 mm).",
  "bin.divX": "Compartments across",
  "bin.divY": "Compartments deep",
  "bin.scoop": "Finger scoop",
  "bin.scoop.hint": "Rounded front edge inside each compartment to slide small parts out.",
  "bin.label": "Label shelf",
  "bin.labelDepth": "Label depth",
  "bin.wall": "Wall thickness",
  "bin.divider": "Divider thickness",
  "bin.floor": "Floor thickness",
  "bin.screws": "Screw holes (M3)",
  "fact.compartment": "{n} × compartment {x} × {y} × {z} mm",
  "warn.labelShrunk": "The label shelf was made smaller to fit the compartment.",
  "err.binTooLow": "The bin is too low for this floor. Use at least {min} mm.",
  "err.tooManyCompartments": "Too many compartments for this bin size.",

  "group.lidStack": "Lid & stacking",
  "box.shape": "Shape",
  "box.shape.rect": "Rectangular",
  "box.shape.round": "Round",
  "box.shape.hex": "Hexagonal",
  "box.sizeMode": "Dimensions are",
  "box.sizeMode.outer": "Outside",
  "box.sizeMode.inner": "Inside",
  "box.width": "Width",
  "box.depth": "Depth",
  "box.diameter": "Diameter",
  "box.diameter.hint": "For hexagons: width across the flat sides.",
  "box.height": "Height",
  "box.cornerRadius": "Corner radius",
  "box.stackable": "Stackable",
  "box.stackable.hint": "The bottom gets a recessed foot that drops into the opening of the box below.",
  "box.stackDepth": "Foot depth",
  "box.lid": "Lid",
  "box.lid.none": "None",
  "box.lid.lift": "Lift-off lid",
  "box.lidThickness": "Lid thickness",
  "box.lidLip": "Lid insert depth",
  "box.clearance": "Fit clearance",
  "box.clearance.hint": "Play per side for lid and stacking. Increase if the fit is too tight.",
  "fact.outer": "Outside {x} × {y} × {z} mm",
  "fact.inner": "Inside {x} × {y} × {z} mm",
  "fact.withLid": "+ lid",
  "warn.largerThanBed": "The footprint is larger than a {size} mm print bed.",
  "warn.tallerThanBed": "The box is taller than {size} mm.",
  "err.boxTooLow": "The box is too low for this floor. Use at least {min} mm.",
  "err.boxTooSmall": "The box is too small for this wall thickness.",
  "model.insert": "Insert",

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

  "group.compartments": "Fächer",
  "group.walls": "Wände",
  "group.base": "Unterseite",
  "bin.gridX": "Breite (Einheiten)",
  "bin.gridY": "Tiefe (Einheiten)",
  "bin.heightMode": "Höhe in",
  "bin.heightMode.units": "Einheiten (7 mm)",
  "bin.heightMode.mm": "Millimeter",
  "bin.heightUnits": "Höhe (Einheiten)",
  "bin.heightUnits.hint": "Ohne Stapelkante. 3 Einheiten = 21 mm.",
  "bin.heightMm": "Höhe",
  "bin.lip": "Stapelkante",
  "bin.lip.hint": "Damit lassen sich Bins aufeinanderstapeln (plus 4,4 mm).",
  "bin.divX": "Fächer nebeneinander",
  "bin.divY": "Fächer hintereinander",
  "bin.scoop": "Griffmulde",
  "bin.scoop.hint": "Abgerundete Vorderkante in jedem Fach, um Kleinteile herauszuschieben.",
  "bin.label": "Beschriftungskante",
  "bin.labelDepth": "Tiefe der Beschriftung",
  "bin.wall": "Wandstärke",
  "bin.divider": "Stärke der Trennwände",
  "bin.floor": "Bodenstärke",
  "bin.screws": "Schraublöcher (M3)",
  "fact.compartment": "{n} × Fach {x} × {y} × {z} mm",
  "warn.labelShrunk": "Die Beschriftungskante wurde verkleinert, damit sie ins Fach passt.",
  "err.binTooLow": "Der Bin ist für diesen Boden zu niedrig. Mindestens {min} mm.",
  "err.tooManyCompartments": "Zu viele Fächer für diese Bin-Größe.",

  "group.lidStack": "Deckel & Stapeln",
  "box.shape": "Form",
  "box.shape.rect": "Eckig",
  "box.shape.round": "Rund",
  "box.shape.hex": "Sechseckig",
  "box.sizeMode": "Maße sind",
  "box.sizeMode.outer": "Außenmaße",
  "box.sizeMode.inner": "Innenmaße",
  "box.width": "Breite",
  "box.depth": "Tiefe",
  "box.diameter": "Durchmesser",
  "box.diameter.hint": "Beim Sechseck: Breite über die flachen Seiten.",
  "box.height": "Höhe",
  "box.cornerRadius": "Eckenradius",
  "box.stackable": "Stapelbar",
  "box.stackable.hint": "Der Boden bekommt einen abgesetzten Fuß, der in die Öffnung der Box darunter greift.",
  "box.stackDepth": "Fußhöhe",
  "box.lid": "Deckel",
  "box.lid.none": "Keiner",
  "box.lid.lift": "Stülpdeckel",
  "box.lidThickness": "Deckelstärke",
  "box.lidLip": "Einstecktiefe des Deckels",
  "box.clearance": "Spiel",
  "box.clearance.hint": "Spiel pro Seite für Deckel und Stapeln. Erhöhen, wenn es zu stramm sitzt.",
  "fact.outer": "Außen {x} × {y} × {z} mm",
  "fact.inner": "Innen {x} × {y} × {z} mm",
  "fact.withLid": "+ Deckel",
  "warn.largerThanBed": "Die Grundfläche ist größer als ein {size}-mm-Druckbett.",
  "warn.tallerThanBed": "Die Box ist höher als {size} mm.",
  "err.boxTooLow": "Die Box ist für diesen Boden zu niedrig. Mindestens {min} mm.",
  "err.boxTooSmall": "Die Box ist für diese Wandstärke zu klein.",
  "model.insert": "Einsatz",

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
