// Diagnostic probe: inspect the attached HID reader and dump everything it sends.
//
//   node src/probe.js
//
// Leave it running and tap a card. Every raw report is printed as hex so we can
// work out the vendor protocol. Ctrl+C to stop.

import HID from "node-hid";

const VENDOR_ID = 0x0483;

function hex(buf) {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function ascii(buf) {
  return Array.from(buf)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("");
}

const all = HID.devices();
const candidates = all.filter((d) => d.vendorId === VENDOR_ID);

console.log(`HID devices on this machine: ${all.length}`);
console.log(`Matching vendor 0x${VENDOR_ID.toString(16)}: ${candidates.length}\n`);

for (const d of candidates) {
  console.log("---");
  console.log(`  product      : ${d.product}`);
  console.log(`  manufacturer : ${d.manufacturer}`);
  console.log(`  interface    : ${d.interface}`);
  console.log(`  usagePage    : 0x${(d.usagePage ?? 0).toString(16)}  usage: 0x${(d.usage ?? 0).toString(16)}`);
  console.log(`  path         : ${d.path}`);
}

// The "TransferData" interface (barcode-badge usage page 0x8c) is the data
// channel. The keyboard interface is claimed by Windows and cannot be opened.
const target = candidates.find((d) => d.usagePage === 0x8c) ?? candidates.find((d) => d.interface === 0);

if (!target) {
  console.error("\nNo data interface found. Is the reader plugged in?");
  process.exit(1);
}

console.log(`\nOpening: ${target.product} (interface ${target.interface})`);

let device;
try {
  device = new HID.HID(target.path);
} catch (err) {
  console.error(`Could not open the device: ${err.message}`);
  process.exit(1);
}

console.log("Opened OK.\n");

try {
  const desc = device.getReportDescriptor();
  console.log(`Report descriptor (${desc.length} bytes):`);
  console.log(hex(desc));
  console.log();
} catch (err) {
  console.log(`getReportDescriptor() unavailable: ${err.message}\n`);
}

try {
  console.log("Device info:", JSON.stringify(device.getDeviceInfo(), null, 1), "\n");
} catch {
  /* older node-hid */
}

console.log("Listening. Tap a card on the reader now...\n");

device.on("data", (data) => {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] IN  ${data.length}b  ${hex(data)}  |${ascii(data)}|`);
});

device.on("error", (err) => {
  console.error("HID error:", err.message);
});

process.on("SIGINT", () => {
  console.log("\nClosing.");
  try {
    device.close();
  } catch {
    /* ignore */
  }
  process.exit(0);
});
