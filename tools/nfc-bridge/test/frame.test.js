import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeFrame, encodeFrame, trimPadding, toSpacedHex, xorChecksum } from "../src/frame.js";
import { EventType, interpretReport, interpretCardResponse } from "../src/protocol.js";

/** A real 32-byte report captured from the attached reader with no card on it. */
const IDLE_REPORT = Buffer.from(
  "aa0000050000ffff2623" + "00".repeat(22),
  "hex"
);

const IDLE_PAYLOAD = [0x00, 0x00, 0xff, 0xff, 0x26];

describe("xorChecksum", () => {
  it("matches the checksum the reader itself sends", () => {
    // Bytes 1..8 of the captured idle report.
    assert.equal(xorChecksum(IDLE_REPORT.subarray(1, 9)), 0x23);
  });

  it("is zero for an empty run", () => {
    assert.equal(xorChecksum([]), 0);
  });
});

describe("encodeFrame", () => {
  it("reproduces the reader's own idle frame byte for byte", () => {
    const built = encodeFrame(IDLE_PAYLOAD);
    assert.equal(toSpacedHex(trimPadding(built)), "aa 00 00 05 00 00 ff ff 26 23");
    assert.deepEqual(built, IDLE_REPORT);
  });

  it("always produces a full-length report", () => {
    assert.equal(encodeFrame([0x01]).length, 32);
  });

  it("refuses a payload that cannot fit", () => {
    assert.throws(() => encodeFrame(new Array(28).fill(0)), RangeError);
  });
});

describe("decodeFrame", () => {
  it("reads the captured idle report", () => {
    const frame = decodeFrame(IDLE_REPORT);
    assert.equal(frame.ok, true);
    assert.equal(frame.checksumValid, true);
    assert.equal(frame.length, 5);
    assert.deepEqual([...frame.payload], IDLE_PAYLOAD);
  });

  it("round-trips anything encodeFrame produces", () => {
    const payload = [0x01, 0x02, 0x03, 0xfe, 0xff];
    const frame = decodeFrame(encodeFrame(payload));
    assert.equal(frame.checksumValid, true);
    assert.deepEqual([...frame.payload], payload);
  });

  it("rejects a report with the wrong start byte", () => {
    const bad = Buffer.from(IDLE_REPORT);
    bad[0] = 0xbb;
    assert.equal(decodeFrame(bad).ok, false);
  });

  it("reports a checksum mismatch rather than throwing", () => {
    const bad = Buffer.from(IDLE_REPORT);
    bad[9] ^= 0xff;
    const frame = decodeFrame(bad);
    assert.equal(frame.ok, true);
    assert.equal(frame.checksumValid, false);
  });

  it("rejects a length byte that overruns the report", () => {
    const bad = Buffer.from(IDLE_REPORT);
    bad[3] = 0xfe;
    assert.equal(decodeFrame(bad).ok, false);
  });

  it("does not throw on a runt report", () => {
    assert.equal(decodeFrame(Buffer.from([0xaa])).ok, false);
  });
});

describe("interpretCardResponse", () => {
  /** The actual response observed from command 0x0002 with a card on it. */
  const OBSERVED = "00 00 00 02 00 00 00 06 57";

  it("refuses to read the observed response as a UID", () => {
    // Those trailing bytes start with 0x00, which ISO 14443-3 never assigns as
    // the first UID byte. Guessing here would bind a wrong card to a student.
    const event = interpretCardResponse(OBSERVED);
    assert.equal(event.type, EventType.UNKNOWN);
    assert.equal(event.uid, undefined);
  });

  it("reads a 4-byte UID after the command echo", () => {
    const event = interpretCardResponse("00 00 00 02 04 a2 2b 19");
    assert.equal(event.type, EventType.CARD);
    assert.equal(event.uid, "04A22B19");
  });

  it("reads a 4-byte UID after an echo plus a status byte", () => {
    const event = interpretCardResponse("00 00 00 02 00 04 a2 2b 19");
    assert.equal(event.type, EventType.CARD);
    assert.equal(event.uid, "04A22B19");
  });

  it("reads a 7-byte UID", () => {
    const event = interpretCardResponse("00 00 00 02 04 11 22 33 44 55 66");
    assert.equal(event.type, EventType.CARD);
    assert.equal(event.uid, "04112233445566");
  });

  it("rejects an all-identical run", () => {
    assert.equal(interpretCardResponse("00 00 00 02 ff ff ff ff").type, EventType.UNKNOWN);
  });

  it("rejects a response with nothing after the echo", () => {
    assert.equal(interpretCardResponse("00 00 00 02").type, EventType.UNKNOWN);
  });

  it("rejects a UID of illegal length", () => {
    assert.equal(interpretCardResponse("00 00 00 02 04 a2 2b").type, EventType.UNKNOWN);
  });

  it("does not throw on junk input", () => {
    for (const junk of ["", "zz", "00"]) {
      assert.equal(interpretCardResponse(junk).type, EventType.UNKNOWN);
    }
  });
});

describe("interpretReport", () => {
  /** Build a plausible card-present frame: status, UID, trailing REQA. */
  const cardReport = (uid) => encodeFrame([0x00, 0x00, ...uid, 0x26]);

  it("recognises the idle poll", () => {
    assert.equal(interpretReport(IDLE_REPORT).type, EventType.IDLE);
  });

  it("extracts a 4-byte UID", () => {
    const event = interpretReport(cardReport([0xde, 0xad, 0xbe, 0xef]));
    assert.equal(event.type, EventType.CARD);
    assert.equal(event.uid, "DEADBEEF");
  });

  it("extracts a 7-byte UID", () => {
    const event = interpretReport(cardReport([0x04, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66]));
    assert.equal(event.type, EventType.CARD);
    assert.equal(event.uid, "04112233445566");
  });

  it("does not invent a UID from an all-zero payload", () => {
    const event = interpretReport(encodeFrame([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x26]));
    assert.equal(event.type, EventType.UNKNOWN);
  });

  it("does not invent a UID from a status word", () => {
    const event = interpretReport(encodeFrame([0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x26]));
    assert.equal(event.type, EventType.UNKNOWN);
  });

  it("flags a bad checksum as invalid", () => {
    const bad = Buffer.from(IDLE_REPORT);
    bad[9] ^= 0xff;
    assert.equal(interpretReport(bad).type, EventType.INVALID);
  });

  it("keeps raw bytes on every event for debugging", () => {
    for (const report of [IDLE_REPORT, cardReport([1, 2, 3, 4]), Buffer.from([0xaa])]) {
      assert.ok(interpretReport(report).raw.length > 0);
    }
  });
});
