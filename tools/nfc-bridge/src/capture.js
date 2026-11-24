// Watch the reader live: presence, UIDs, and the raw responses behind them.
//
//   npm run capture
//
// Useful for checking a real card against a real reader, and for working out
// the UID layout. Everything is appended to capture.log.json.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NfcReader } from "./reader.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(here, "..", "capture.log.json");

const records = [];
const started = Date.now();
let polls = 0;

const stamp = () => `+${((Date.now() - started) / 1000).toFixed(1)}s`;

const reader = new NfcReader();

reader.on("connected", (info) => {
  console.log(`Connected to ${info.manufacturer ?? "reader"} ${info.product ?? ""}`.trim());
  console.log("\nPut a card on the reader, take it off, try another one.");
  console.log("Press Ctrl+C when done.\n");
});

reader.on("calibrated", (info) => {
  console.log(`Baseline (${info.source}): ${info.emptyResponse}`);
  if (info.source === "startup") {
    console.log("  ^ assumed the reader was empty just now. If a card was on it,");
    console.log("    stop, clear the reader, and run `npm run calibrate`.\n");
  }
});

reader.on("disconnected", () => console.log("Reader disconnected."));
reader.on("error", (err) => console.error("Error:", err.message));

reader.on("frame", (event) => {
  records.push({ at: Date.now() - started, ...event });
  if (!event.solicited) return;
  polls += 1;
  process.stdout.write(`\r  polls: ${polls}   last: ${event.raw}   `);
});

reader.on("cardPresent", (event) => {
  process.stdout.write("\r");
  console.log(`${stamp()}  CARD ON`);
  console.log(`            response: ${event.response}`);
  console.log(`            uid:      ${event.uid ?? "(not decodable from this response yet)"}`);
});

reader.on("cardRemoved", () => {
  process.stdout.write("\r");
  console.log(`${stamp()}  CARD OFF`);
});

reader.start();

function finish() {
  reader.stop();
  process.stdout.write("\r");

  fs.writeFileSync(logPath, JSON.stringify(records, null, 2));
  console.log(`\nCaptured ${records.length} responses over ${((Date.now() - started) / 1000).toFixed(0)}s.`);
  console.log(`Written to ${logPath}`);

  const distinct = [...new Set(records.filter((r) => r.solicited).map((r) => r.raw))];
  if (distinct.length > 1) {
    console.log("\nDistinct responses seen:");
    for (const d of distinct) console.log(`   ${d}`);
    console.log("\nIf one of these is the empty reader and the others are cards,");
    console.log("the differing bytes are the card number.");
  }
  process.exit(0);
}

process.on("SIGINT", finish);
