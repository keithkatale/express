// Sample the reader's card command a few times and print the response.
import { NfcReader } from "./reader.js";
const reader = new NfcReader({ poll: false });
reader.on("error", (e) => console.error("  reader error:", e.message));
reader.start();
const info = await new Promise((r) => { reader.once("connected", r); setTimeout(() => r(null), 4000); });
if (!info) { console.error("READER NOT AVAILABLE (unplugged, or another program is holding it)"); process.exit(1); }
console.log(`reader: ${info.manufacturer} ${info.product}`);
const seen = [];
for (let i = 0; i < 5; i++) { const r = await reader.readOnce(); seen.push(r ?? "(no reply)"); await new Promise(r2 => setTimeout(r2, 250)); }
reader.stop();
seen.forEach((s, i) => console.log(`  sample ${i + 1}: ${s}`));
const distinct = [...new Set(seen)];
console.log(distinct.length === 1 ? `\nSTABLE: ${distinct[0]}` : `\nUNSTABLE across ${distinct.length} values`);
