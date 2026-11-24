// Record what the reader answers when nothing is on it.
//
//   npm run calibrate
//
// Presence detection compares every poll against this baseline, so it must be
// recorded with the antenna genuinely empty. Takes several readings and only
// accepts a stable one.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { NfcReader } from "./reader.js";
import { saveBaseline, BASELINE_PATH } from "./baseline.js";

const SAMPLES = 6;

const reader = new NfcReader({ poll: false });
const rl = readline.createInterface({ input: stdin, output: stdout });

const connected = new Promise((resolve) => {
  reader.once("connected", resolve);
  setTimeout(() => resolve(null), 4000);
});

reader.on("error", (err) => console.error("  reader error:", err.message));
reader.start();

const info = await connected;
if (!info) {
  console.error("Reader not found. Is it plugged in?");
  reader.stop();
  rl.close();
  process.exit(1);
}

console.log(`Reader: ${info.manufacturer ?? ""} ${info.product ?? ""}`.trim());
await rl.question("\nTake every card OFF the reader, then press Enter...");

const readings = [];
for (let i = 0; i < SAMPLES; i += 1) {
  const response = await reader.readOnce();
  process.stdout.write(`\r  reading ${i + 1}/${SAMPLES}: ${response ?? "(no reply)"}   `);
  if (response) readings.push(response);
  await new Promise((r) => setTimeout(r, 250));
}
console.log("\n");

rl.close();
reader.stop();

if (readings.length < SAMPLES / 2) {
  console.error("The reader did not answer often enough to calibrate.");
  process.exit(1);
}

const distinct = [...new Set(readings)];
if (distinct.length > 1) {
  console.error("The empty-reader response is not stable; got:");
  for (const d of distinct) console.error(`   ${d}`);
  console.error("\nSomething may still be on the antenna. Clear it and retry.");
  process.exit(1);
}

const saved = saveBaseline(distinct[0]);
console.log(`Empty-reader response: ${saved.emptyResponse}`);
console.log(`Saved to ${BASELINE_PATH}`);
console.log("\nPresence detection is now calibrated. Restart the bridge to use it.");
