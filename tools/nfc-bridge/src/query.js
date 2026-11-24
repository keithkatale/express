// Send one command to the reader and collect everything it sends back,
// reassembling responses that span more than one 32-byte HID report.
//
//   node src/query.js 0000000052          # the known "device info" command
//   node src/query.js 0000000052 --wait 4000
//
// Read-only tool. It sends exactly the payload you give it, once.

import HID from "node-hid";
import { encodeFrame, toSpacedHex, trimPadding } from "./frame.js";

const VENDOR_ID = 0x0483;

const args = process.argv.slice(2);
const hexArg = args.find((a) => !a.startsWith("--"));
const waitIdx = args.indexOf("--wait");
const waitMs = waitIdx >= 0 ? Number(args[waitIdx + 1]) : 3000;

if (!hexArg) {
  console.error("Usage: node src/query.js <payload-hex> [--wait ms]");
  process.exit(1);
}

const payload = Buffer.from(hexArg.replace(/\s+/g, ""), "hex");

const info = HID.devices().find((d) => d.vendorId === VENDOR_ID && d.usagePage === 0x8c);
if (!info) {
  console.error("Reader not found.");
  process.exit(1);
}

const device = new HID.HID(info.path);

const reports = [];
device.on("data", (d) => {
  reports.push(Buffer.from(d));
  console.log(`  IN   ${toSpacedHex(trimPadding(d))}`);
});
device.on("error", (e) => console.error("  HID error:", e.message));

const report = encodeFrame(payload);
console.log(`  OUT  ${toSpacedHex(trimPadding(report))}\n`);
device.write(Array.from(Buffer.concat([Buffer.from([0x00]), report])));

await new Promise((r) => setTimeout(r, waitMs));
device.close();

if (reports.length === 0) {
  console.log("\nNo response.");
  process.exit(0);
}

// Reassemble: the first report carries AA + head + len, later reports are
// raw continuation bytes of the same payload.
const first = reports[0];
const declaredLen = first[3];
let body = Buffer.concat([first.subarray(4), ...reports.slice(1)]);
const payloadOut = body.subarray(0, declaredLen);

console.log(`\nReports received : ${reports.length}`);
console.log(`Declared length  : ${declaredLen} (0x${declaredLen.toString(16)})`);
console.log(`Bytes available  : ${body.length}`);
console.log(`Payload hex      : ${toSpacedHex(payloadOut)}`);
console.log(
  `Payload ascii    : ${Array.from(payloadOut)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("")}`
);
