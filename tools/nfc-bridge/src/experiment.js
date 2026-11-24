// Protocol experiment, run with a card sitting on the reader.
//
//   node src/experiment.js
//
// Only ISO 14443-A polling opcodes are sent (REQA 0x26 / WUPA 0x52). Both are
// read-only parts of normal anticollision; neither writes to a card nor touches
// reader configuration.

import HID from "node-hid";
import { encodeFrame, toSpacedHex, trimPadding } from "./frame.js";

const VENDOR_ID = 0x0483;

const info = HID.devices().find((d) => d.vendorId === VENDOR_ID && d.usagePage === 0x8c);
if (!info) {
  console.error("Reader not found.");
  process.exit(1);
}

const device = new HID.HID(info.path);
console.log(`Opened ${info.manufacturer} ${info.product}\n`);

const t0 = Date.now();
let current = "(idle, before any command)";
const byTrial = new Map();

device.on("data", (data) => {
  const h = toSpacedHex(trimPadding(data));
  const list = byTrial.get(current) ?? [];
  list.push(h);
  byTrial.set(current, list);
  console.log(`  +${String(Date.now() - t0).padStart(5)}ms  IN   ${h}`);
});
device.on("error", (e) => console.error("  HID error:", e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const trials = [
  ["baseline: no command, just listen", null],
  ["REQA, full envelope", [0x00, 0x00, 0xff, 0xff, 0x26]],
  ["WUPA, full envelope (wakes a HALTed card)", [0x00, 0x00, 0xff, 0xff, 0x52]],
  ["WUPA, bare opcode", [0x52]],
  ["REQA, bare opcode", [0x26]],
  ["WUPA with zeroed status field", [0x00, 0x00, 0x00, 0x00, 0x52]],
];

for (const [label, payload] of trials) {
  current = label;
  console.log(`\n>> ${label}`);
  if (payload) {
    const report = encodeFrame(payload);
    console.log(`  OUT  ${toSpacedHex(trimPadding(report))}`);
    try {
      device.write(Array.from(Buffer.concat([Buffer.from([0x00]), report])));
    } catch (err) {
      console.log(`  write() failed: ${err.message}`);
    }
  }
  await sleep(3000);
}

console.log("\n=== distinct frames per trial ===");
for (const [label, frames] of byTrial) {
  const distinct = [...new Set(frames)];
  console.log(`\n${label}`);
  for (const f of distinct) console.log(`   ${f}`);
}

device.close();
