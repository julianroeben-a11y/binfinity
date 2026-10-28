// Loads the label font from disk, as the worker does from its URL.
import { readFileSync } from "node:fs";
import { initFont } from "../src/models/text";

export async function loadTestFont() {
  const b = readFileSync(new URL("../src/assets/fonts/inter-bold.woff", import.meta.url));
  await initFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
