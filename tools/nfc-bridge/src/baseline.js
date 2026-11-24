// The reader's "nothing on the antenna" response, recorded once.
//
// Presence detection works by comparing each poll response against this
// baseline. That deliberately avoids needing to know what the bytes mean: the
// vendor protocol is undocumented, but "same as when the reader was empty"
// versus "different" is reliable regardless.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE_PATH = path.join(here, "..", "reader-baseline.json");

/**
 * @returns {{ emptyResponse: string, recordedAt: string } | null}
 */
export function loadBaseline() {
  try {
    const raw = fs.readFileSync(BASELINE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.emptyResponse !== "string") return null;
    return parsed;
  } catch {
    // Missing or unreadable: the caller falls back to self-calibration.
    return null;
  }
}

export function saveBaseline(emptyResponse) {
  const data = { emptyResponse, recordedAt: new Date().toISOString() };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + "\n");
  return data;
}
