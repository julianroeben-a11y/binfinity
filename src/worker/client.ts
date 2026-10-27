import type { Params } from "../models/types";
import type { ExportFormat, Request, Response } from "./protocol";

type GenerateResult = Extract<Response, { type: "generated" }>;
type ExportResult = Extract<Response, { type: "exported" }>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Stage = Extract<Response, { type: "progress" }>["stage"];

/**
 * Thin promise wrapper around the CAD worker. Generate requests are coalesced:
 * while one is running, only the newest pending one is kept, so fast typing in
 * the form never builds a backlog.
 */
export class CadClient {
  private worker = new Worker(new URL("./cad.worker.ts", import.meta.url), { type: "module" });
  private nextId = 1;
  private waiting = new Map<number, { resolve: (r: Response) => void; reject: (e: unknown) => void }>();
  private busy = false;
  private pending: { model: string; params: Params; resolve: (r: GenerateResult | null) => void; reject: (e: unknown) => void } | null = null;

  onStage: (stage: Stage) => void = () => {};
  readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise((resolve) => {
      this.worker.addEventListener("message", (e: MessageEvent<Response>) => {
        if (e.data.type === "ready") resolve();
      });
    });
    this.worker.addEventListener("message", (e: MessageEvent<Response>) => {
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

  private send(req: DistributiveOmit<Request, "id">): Promise<Response> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ ...req, id } as Request);
    });
  }

  /** Resolves with the result, or `null` if a newer request superseded this one. */
  generate(model: string, params: Params): Promise<GenerateResult | null> {
    return new Promise((resolve, reject) => {
      if (this.busy) {
        this.pending?.resolve(null);
        this.pending = { model, params, resolve, reject };
        return;
      }
      this.run(model, params).then(resolve, reject);
    });
  }

  private async run(model: string, params: Params): Promise<GenerateResult> {
    this.busy = true;
    try {
      return (await this.send({ type: "generate", model, params })) as GenerateResult;
    } finally {
      this.busy = false;
      const next = this.pending;
      this.pending = null;
      if (next) this.run(next.model, next.params).then(next.resolve, next.reject);
    }
  }

  async export(format: ExportFormat, quality: "normal" | "fine"): Promise<ExportResult> {
    return (await this.send({ type: "export", format, quality })) as ExportResult;
  }
}
