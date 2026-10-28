// Line icons for the model rail (24 × 24, drawn with the current colour).
export const modelIcons: Record<string, string> = {
  baseplate: "M4 4h16v16H4zM4 12h16M12 4v16",
  bin: "M5 9h14v10H5zM5 9l2-4h10l2 4",
  insert: "M4 9h16v10H4zM8 14h.01M12 14h.01M16 14h.01",
  box: "M5 10h14v9H5zM4 6h16v4H4z",
  desk: "M3 19h18M4 19l2-11h12l2 11M8 8V5M11 8V4M15 8V6",
  drawer: "M3 5h18v14H3zM3 12h18M12 5v14",
};

export function icon(path: string, size = 22): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", path);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.7");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  svg.append(p);
  return svg;
}
