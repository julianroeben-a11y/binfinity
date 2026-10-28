import type { Params } from "../models/types";
import type { ExportFormat, Request, Response } from "./protocol";

type GenerateResult = Extract<Response, { type: "generated" }>;
type ExportResult = Extract<Response, { type: "exported" }>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Stage = Extract<Response, { type: "progress" }>["stage"];

/** Settles the promise of a request whose worker was stopped. */
const SUPERSEDED = Symbol("superseded");

/**
 * Thin promise wrapper around the CAD worker. A new generate request while
 * another one is still building stops the worker and starts a fresh one:
 * OpenCascade cannot be interrupted, and a large model can take a while, so
 * waiting for an outdated build would make the form feel stuck.
 */
export class CadClient {
  private worker!: Worker;
  private nextId = 1;
  private waiting = new Map<number, { resolve: (r: Response | typeof SUPERSEDED) => void; reject: (e: unknown) => void }>();
  /** The generate request currently running, and whether an export is. */
  private building: number | null = null;
  private exporting = false;
  private latest = 0;

  onStage: (stage: Stage) => void = () => {};
  ready!: Promise<void>;

  constructor() {
    this.start();
  }

  private start() {
    this.worker = new Worker(new URL("./cad.worker.ts", import.meta.url), { type: "module" });
    const worker = this.worker;
    this.ready = new Promise((resolve) => {
      worker.addEventListener("message", (e: MessageEvent<Response>) => {
        if (e.data.type === "ready") resolve();
      });
    });
    worker.addEventListener("message", (e: MessageEvent<Response>) => {
      const msg = e.data;
      if (msg.type === "ready") return;
      if (msg.type === "progress") return this.onStage(msg.stage);
      const w = this.waiting.get(msg.id);
      if (!w) return;
      this.waiting.delete(msg.id);
      if (msg.type === "error") w.reject(msg.error);
      else w.resolve(msg);
    });
  }

  /** Stop the worker and start a new one; open requests settle as superseded. */
  private restart() {
    this.worker.terminate();
    for (const w of this.waiting.values()) w.resolve(SUPERSEDED);
    this.waiting.clear();
    this.building = null;
    this.start();
  }

  private send(req: DistributiveOmit<Request, "id">, id = this.nextId++): Promise<Response | typeof SUPERSEDED> {
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ ...req, id } as Request);
    });
  }

  /** Resolves with the result, or `null` if a newer request superseded this one. */
  async generate(model: string, params: Params): Promise<GenerateResult | null> {
    const id = this.nextId++;
    this.latest = id;
    // A running export keeps its worker; wait for it instead.
    while (this.exporting) {
      await new Promise((r) => setTimeout(r, 50));
      if (this.latest !== id) return null;
    }
    if (this.building !== null) this.restart();
    await this.ready;
    if (this.latest !== id) return null;
    this.building = id;
    try {
      const res = await this.send({ type: "generate", model, params }, id);
      return res === SUPERSEDED || this.latest !== id ? null : (res as GenerateResult);
    } finally {
      if (this.building === id) this.building = null;
    }
  }

  async export(format: ExportFormat, quality: "normal" | "fine"): Promise<ExportResult> {
    this.exporting = true;
    try {
      const res = await this.send({ type: "export", format, quality });
      if (res === SUPERSEDED) throw { key: "err.nothingToExport" };
      return res as ExportResult;
    } finally {
      this.exporting = false;
    }
  }
}
