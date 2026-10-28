// Top view of a drawer: the baseplate cells and the parts on them. Parts are
// dragged to move them and clicked to edit them; the front of the drawer is
// at the bottom.

export interface PlanPart {
  x: number;
  y: number;
  w: number;
  d: number;
  kind: string;
  title: string;
  detail: string;
  /** Outside the grid or on top of another part. */
  bad: boolean;
}

export interface PlanView {
  cellsX: number;
  cellsY: number;
  parts: PlanPart[];
  selected: number | null;
}

export interface PlanHandlers {
  select: (index: number | null) => void;
  /** Move a part to a new lower-left cell. */
  move: (index: number, x: number, y: number) => void;
}

/** Pixels a pointer may move before a press counts as a drag. */
const DRAG_THRESHOLD = 4;

export class Planner {
  private board = document.createElement("div");
  private view: PlanView = { cellsX: 1, cellsY: 1, parts: [], selected: null };

  constructor(
    private readonly area: HTMLElement,
    private readonly handlers: PlanHandlers,
  ) {
    this.board.className = "plan-board";
    this.board.addEventListener("click", (e) => {
      if (e.target === this.board || (e.target as HTMLElement).classList.contains("plan-cell")) this.handlers.select(null);
    });
    area.append(this.board);
    new ResizeObserver(() => this.fit()).observe(area);
  }

  render(view: PlanView) {
    this.view = view;
    const { cellsX, cellsY } = view;
    this.board.style.setProperty("--cols", String(cellsX));
    this.board.style.setProperty("--rows", String(cellsY));
    const cells = Array.from({ length: cellsX * cellsY }, () => Object.assign(document.createElement("div"), { className: "plan-cell" }));
    const parts = view.parts.map((part, i) => this.partButton(part, i));
    this.board.replaceChildren(...cells, ...parts);
    this.fit();
  }

  /** Largest board with square cells that fits the area. */
  private fit() {
    const { cellsX, cellsY } = this.view;
    const w = this.area.clientWidth;
    const h = this.area.clientHeight;
    if (!w || !h) return;
    const cell = Math.max(8, Math.min(w / cellsX, h / cellsY));
    this.board.style.width = `${cell * cellsX}px`;
    this.board.style.height = `${cell * cellsY}px`;
  }

  private partButton(part: PlanPart, index: number) {
    const { cellsX, cellsY } = this.view;
    const b = document.createElement("button");
    b.type = "button";
    b.className = `plan-part plan-${part.kind}`;
    b.classList.toggle("bad", part.bad);
    b.setAttribute("aria-pressed", String(index === this.view.selected));
    Object.assign(b.style, {
      left: `${(part.x / cellsX) * 100}%`,
      top: `${((cellsY - part.y - part.d) / cellsY) * 100}%`,
      width: `calc(${(part.w / cellsX) * 100}% - 6px)`,
      height: `calc(${(part.d / cellsY) * 100}% - 6px)`,
    });
    b.append(
      Object.assign(document.createElement("strong"), { textContent: part.title }),
      Object.assign(document.createElement("span"), { textContent: part.detail }),
    );

    let start: { x: number; y: number; id: number } | null = null;
    let moved = false;
    const cellSize = () => this.board.clientWidth / cellsX;
    const offset = (e: PointerEvent) => {
      const c = cellSize();
      return [Math.round((e.clientX - start!.x) / c), -Math.round((e.clientY - start!.y) / c)];
    };
    b.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      moved = false;
      b.setPointerCapture(e.pointerId);
    });
    b.addEventListener("pointermove", (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
      moved = true;
      b.classList.add("dragging");
      const [dx, dy] = offset(e);
      const c = cellSize();
      b.style.transform = `translate(${dx * c}px, ${-dy * c}px)`;
    });
    const end = (e: PointerEvent, commit: boolean) => {
      if (!start || e.pointerId !== start.id) return;
      const [dx, dy] = offset(e);
      start = null;
      b.classList.remove("dragging");
      b.style.transform = "";
      if (!moved) {
        if (commit) this.handlers.select(index);
      } else if (commit && (dx || dy)) {
        this.handlers.move(index, part.x + dx, part.y + dy);
      }
    };
    b.addEventListener("pointerup", (e) => end(e, true));
    b.addEventListener("pointercancel", (e) => end(e, false));
    // Keyboard: Enter or Space selects (a click without a pointer), arrows move by one cell.
    b.addEventListener("click", (e) => {
      if (e.detail === 0) this.handlers.select(index);
    });
    b.addEventListener("keydown", (e) => {
      const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      const s = step[e.key];
      if (!s) return;
      e.preventDefault();
      this.handlers.move(index, part.x + s[0], part.y + s[1]);
    });
    return b;
  }
}
