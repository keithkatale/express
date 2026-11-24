// Decide what the reader's card command actually returns.
//
//   npm run card-test
//
// Command 0x0002 (search + anticollision + select) gives a reproducible
// response, but we cannot tell a UID from a "no card" status without seeing
// both. This asks for a card on, then off, then a second card, and diffs.
//
// Only read-only polling commands are sent.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import HID from "node-hid";
import { encodeFrame, decodeFrame, toSpacedHex, toHex, trimPadding } from "./frame.js";

const VENDOR_ID = 0x0483;
/** Payload that produced a card-command response: 00 00 <cmd 0002> <REQA>. */
const READ_CARD = [0x00, 0x00, 0x00, 0x02, 0x26];

const info = HID.devices().find((d) => d.vendorId === VENDOR_ID && d.usagePage === 0x8c);
if (!info) {
  console.error("Reader not found. Is it plugged in?");
  process.exit(1);
}

const device = new HID.HID(info.path);
const rl = readline.createInterface({ input: stdin, output: stdout });

/** Send the read-card command and return the first frame that comes back. */
function readCard(timeoutMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    const onData = (data) => {
      if (done) return;
      done = true;
      device.removeListener("data", onData);
      resolve(decodeFrame(data));
    };
    device.on("data", onData);

    device.write(Array.from(Buffer.concat([Buffer.from([0x00]), encodeFrame(READ_CARD)])));

    setTimeout(() => {
      if (done) return;
      done = true;
      device.removeListener("data", onData);
      resolve(null);
    }, timeoutMs);
  });
}

async function sample(label) {
  const frame = await readCard();
  if (!frame?.ok) {
    console.log(`  ${label}: no response\n`);
    return null;
  }
  const payload = Buffer.from(frame.payload);
  console.log(`  ${label}: ${toSpacedHex(payload)}`);
  return payload;
}

console.log(`Reader: ${info.manufacturer} ${info.product}\n`);

await rl.question("1. Put a card ON the reader, then press Enter...");
const withCard = await sample("with card   ");

await rl.question("\n2. Take the card OFF the reader, then press Enter...");
const without = await sample("no card     ");

await rl.question("\n3. Put a DIFFERENT card on, then press Enter (or just Enter to skip)...");
const second = await sample("second card ");

rl.close();
device.close();

console.log("\n=== result ===");

if (!withCard || !without) {
  console.log("Did not get both samples; cannot compare.");
  process.exit(0);
}

if (withCard.equals(without)) {
  console.log("The response is IDENTICAL with and without a card.");
  console.log("So command 0x0002 is not reporting card data, and this opcode is");
  console.log("the wrong one. The keyboard interface is then the way to read cards.");
  process.exit(0);
}

console.log("The response CHANGES when a card is present, so it carries card data.\n");

// Report exactly which bytes moved; that is what pins down the UID offset.
const len = Math.max(withCard.length, without.length);
const differing = [];
for (let i = 0; i < len; i += 1) {
  if (withCard[i] !== without[i]) differing.push(i);
}
console.log(`  with card   : ${toSpacedHex(withCard)}`);
console.log(`  without     : ${toSpacedHex(without)}`);
console.log(`  differing offsets: ${differing.join(", ")}`);

if (differing.length) {
  const start = differing[0];
  const end = differing[differing.length - 1] + 1;
  const candidate = withCard.subarray(start, end);
  console.log(`  candidate UID bytes [${start}..${end - 1}]: ${toHex(candidate).toUpperCase()} (${candidate.length} bytes)`);
}

if (second && !second.equals(withCard)) {
  console.log(`\n  second card : ${toSpacedHex(second)}`);
  console.log("  Two different cards gave two different responses, which confirms");
  console.log("  the changing bytes are the card's UID.");
}

console.log("\nPaste this whole output back and the decoder can be finalised.");
