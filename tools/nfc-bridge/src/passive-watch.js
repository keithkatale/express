// Listen to the reader WITHOUT sending it anything, and log every frame.
//
//   node src/passive-watch.js [seconds]
//
// Sending any command makes the reader drop its own auto-polling, and possibly
// its keyboard output too, until it is power-cycled. This watcher never writes
// to the device, so whatever the reader does on its own when a card is tapped
// is exactly what gets recorded. Survives an unplug/replug.

import { NfcReader } from "./reader.js";
import { EventType, interpretReport } from "./protocol.js";

const seconds = Number(process.argv[2] ?? 240);
const started = Date.now();
const stamp = () => `+${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s`;

let idleRun = 0;
function flushIdle() {
  if (idleRun > 0) {
    console.log(`${stamp()}  idle poll x${idleRun} (no card answered)`);
    idleRun = 0;
  }
}

const reader = new NfcReader({ poll: false });

reader.on("connected", (info) => {
  flushIdle();
  console.log(`${stamp()}  CONNECTED ${info.manufacturer ?? ""} ${info.product ?? ""}`);
});
reader.on("disconnected", () => {
  flushIdle();
  console.log(`${stamp()}  DISCONNECTED (unplugged?)`);
});
reader.on("error", (err) => {
  flushIdle();
  console.log(`${stamp()}  error: ${err.message}`);
});

reader.on("frame", (event) => {
  if (event.solicited) return;
  const raw = Buffer.from(event.raw.replace(/\s+/g, ""), "hex");
  const parsed = interpretReport(raw);

  if (parsed.type === EventType.IDLE) {
    idleRun += 1;
    return;
  }

  // Anything that is not the idle poll is what we are hunting for.
  flushIdle();
  console.log(`${stamp()}  *** ${parsed.type.toUpperCase()} ***  ${event.raw}`);
  if (parsed.uid) console.log(`${stamp()}      uid=${parsed.uid}`);
});

reader.start();
console.log(`Passive watch for ${seconds}s. Sending nothing to the reader.`);

setTimeout(() => {
  flushIdle();
  console.log(`${stamp()}  done`);
  reader.stop();
  process.exit(0);
}, seconds * 1000);
