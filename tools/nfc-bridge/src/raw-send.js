// Send exact raw report bytes (no framing added) and print what comes back.
//
//   node src/raw-send.js "aa 00 03 25 26 00 00 bb" ["<another frame>" ...]
//
// Unlike query.js this does not wrap anything in our assumed envelope, so it
// can test the vendor's documented byte sequences verbatim. Each frame is
// zero padded to the reader's 32-byte output report and prefixed with report
// id 0, matching the device's HID caps (33-byte output report, no feature
// reports). Waits for replies after each send.

import HID from "node-hid";
import { toSpacedHex, trimPadding } from "./frame.js";

const REPORT_LEN = 32;
const WAIT_MS = Number(process.env.WAIT_MS ?? 1200);

const frames = process.argv.slice(2);
if (frames.length === 0) {
  console.error('Usage: node src/raw-send.js "aa 00 03 25 26 00 00 bb" [...]');
  process.exit(1);
}

const info = HID.devices().find((d) => d.vendorId === 0x0483 && d.usagePage === 0x8c);
if (!info) {
  console.error("Reader not found.");
  process.exit(1);
}

const device = new HID.HID(info.path);
let replies = [];
device.on("data", (d) => replies.push(toSpacedHex(trimPadding(d))));
device.on("error", (e) => console.error("HID error:", e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Let any unsolicited frame already in flight arrive and be discarded.
await sleep(300);

for (const text of frames) {
  const bytes = Buffer.from(text.replace(/\s+/g, ""), "hex");
  if (bytes.length > REPORT_LEN) {
    console.log(`skip (too long): ${text}`);
    continue;
  }
  const report = Buffer.alloc(REPORT_LEN, 0);
  bytes.copy(report);

  replies = [];
  device.write([0x00, ...report]);
  await sleep(WAIT_MS);

  console.log(`OUT ${toSpacedHex(bytes)}`);
  if (replies.length === 0) console.log("    (no reply)");
  for (const r of replies) console.log(`IN  ${r}`);
  console.log();
}

device.close();
