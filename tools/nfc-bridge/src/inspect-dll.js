// Inspect a Windows DLL WITHOUT loading or executing it.
//
//   node src/inspect-dll.js "C:\path\to\vendor.dll"
//
// Reads the PE headers straight from disk and reports:
//   * whether the DLL is 32-bit (x86) or 64-bit (x64) — this decides whether
//     the bridge can load it in-process or needs a 32-bit helper;
//   * every exported function name — the vendor SDK's API surface.
//
// Vendor SDKs arrive as untrusted binaries, so nothing here calls LoadLibrary.

import fs from "node:fs";
import path from "node:path";

const MACHINES = {
  0x014c: "x86 (32-bit)",
  0x8664: "x64 (64-bit)",
  0xaa64: "ARM64",
  0x01c4: "ARM (32-bit)",
};

/** Translate a relative virtual address to a file offset via the section table. */
function rvaToOffset(rva, sections) {
  for (const s of sections) {
    if (rva >= s.virtualAddress && rva < s.virtualAddress + Math.max(s.virtualSize, s.rawSize)) {
      return rva - s.virtualAddress + s.rawPointer;
    }
  }
  return null;
}

function readCString(buf, offset) {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end += 1;
  return buf.toString("latin1", offset, end);
}

export function inspectPe(buf) {
  if (buf.length < 64 || buf.toString("latin1", 0, 2) !== "MZ") {
    throw new Error("Not a Windows PE file (missing MZ header)");
  }
  const peOffset = buf.readUInt32LE(0x3c);
  if (buf.toString("latin1", peOffset, peOffset + 4) !== "PE\0\0") {
    throw new Error("Not a Windows PE file (missing PE signature)");
  }

  const coff = peOffset + 4;
  const machine = buf.readUInt16LE(coff);
  const sectionCount = buf.readUInt16LE(coff + 2);
  const optionalSize = buf.readUInt16LE(coff + 16);
  const characteristics = buf.readUInt16LE(coff + 18);

  const optional = coff + 20;
  const magic = buf.readUInt16LE(optional);
  const isPe32Plus = magic === 0x20b;
  // Data directory 0 is the export table.
  const dataDirOffset = optional + (isPe32Plus ? 112 : 96);
  const exportRva = buf.readUInt32LE(dataDirOffset);

  const sections = [];
  const sectionTable = optional + optionalSize;
  for (let i = 0; i < sectionCount; i += 1) {
    const s = sectionTable + i * 40;
    sections.push({
      name: buf.toString("latin1", s, s + 8).replace(/\0+$/, ""),
      virtualSize: buf.readUInt32LE(s + 8),
      virtualAddress: buf.readUInt32LE(s + 12),
      rawSize: buf.readUInt32LE(s + 16),
      rawPointer: buf.readUInt32LE(s + 20),
    });
  }

  const exports = [];
  let dllName = null;
  if (exportRva) {
    const exp = rvaToOffset(exportRva, sections);
    if (exp !== null) {
      const nameRva = buf.readUInt32LE(exp + 12);
      const nameCount = buf.readUInt32LE(exp + 24);
      const namesRva = buf.readUInt32LE(exp + 32);
      const nameOff = rvaToOffset(nameRva, sections);
      if (nameOff !== null) dllName = readCString(buf, nameOff);
      const namesOff = rvaToOffset(namesRva, sections);
      if (namesOff !== null) {
        for (let i = 0; i < nameCount; i += 1) {
          const off = rvaToOffset(buf.readUInt32LE(namesOff + i * 4), sections);
          if (off !== null) exports.push(readCString(buf, off));
        }
      }
    }
  }

  return {
    machine: MACHINES[machine] ?? `unknown (0x${machine.toString(16)})`,
    is32Bit: machine === 0x014c,
    isDll: Boolean(characteristics & 0x2000),
    dllName,
    exports,
  };
}

// CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node src/inspect-dll.js "C:\\path\\to\\vendor.dll"');
    process.exit(1);
  }
  let info;
  try {
    info = inspectPe(fs.readFileSync(file));
  } catch (err) {
    console.error(`Cannot inspect ${file}: ${err.message}`);
    process.exit(1);
  }
  console.log(`File        : ${file}`);
  console.log(`Internal name: ${info.dllName ?? "(none)"}`);
  console.log(`Architecture: ${info.machine}${info.isDll ? "" : "  (not a DLL)"}`);
  console.log(`Bridge Node : ${process.arch === "x64" ? "x64 (64-bit)" : process.arch}`);
  if (info.is32Bit && process.arch === "x64") {
    console.log("  -> 32-bit DLL: cannot load into 64-bit Node; call it through a 32-bit helper.");
  }
  console.log(`\nExports (${info.exports.length}):`);
  for (const name of info.exports) console.log(`  ${name}`);
}
