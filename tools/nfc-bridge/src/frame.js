// Wire format for the HOUSESmart 13.56 MHz HID reader (USB 0483:4C43).
//
// Every HID report is 32 bytes, zero padded. A frame inside it looks like:
//
//   offset  0   1   2   3     4 .. 4+len-1   4+len
//           AA  ..  ..  len   payload        checksum
//
// The checksum is an XOR of every byte from offset 1 up to (not including)
// the checksum byte itself. Verified against the reader's own idle frame:
//
//   aa 00 00 05 00 00 ff ff 26 23
//      \_______ checksummed _____/ ^^
//
//   00^00^05^00^00^ff^ff^26 = 0x23
//
// The trailing byte of the payload is an ISO 14443-A command (0x26 = REQA),
// which is how we know the idle frame is the reader polling for a card and
// finding nothing.

export const REPORT_LENGTH = 32;
export const START_BYTE = 0xaa;

/** Offset of the length byte within a report. */
const LEN_OFFSET = 3;
/** Offset where the payload begins. */
const PAYLOAD_OFFSET = 4;

/** XOR of every byte, which is how this reader checksums a frame. */
export function xorChecksum(bytes) {
  let acc = 0;
  for (const b of bytes) acc ^= b;
  return acc & 0xff;
}

/**
 * Build a 32-byte HID report around a payload.
 *
 * `head` is the two bytes between the start byte and the length; the reader
 * uses 00 00 and so do we unless a caller knows better.
 */
export function encodeFrame(payload, { head = [0x00, 0x00] } = {}) {
  const body = Buffer.from(payload);
  if (body.length > REPORT_LENGTH - 5) {
    throw new RangeError(`Payload of ${body.length} bytes does not fit in a ${REPORT_LENGTH}-byte report`);
  }

  const report = Buffer.alloc(REPORT_LENGTH, 0);
  report[0] = START_BYTE;
  report[1] = head[0];
  report[2] = head[1];
  report[LEN_OFFSET] = body.length;
  body.copy(report, PAYLOAD_OFFSET);

  const checksumAt = PAYLOAD_OFFSET + body.length;
  report[checksumAt] = xorChecksum(report.subarray(1, checksumAt));
  return report;
}

/**
 * Pull a frame out of a raw HID report.
 *
 * Returns `{ ok: false, reason }` rather than throwing, because a reader that
 * is mid-handshake can legitimately emit a runt or garbled report and the
 * caller should just skip it instead of crashing.
 */
export function decodeFrame(report) {
  const buf = Buffer.from(report);

  if (buf.length < 5) {
    return { ok: false, reason: "report shorter than the smallest possible frame", raw: buf };
  }
  if (buf[0] !== START_BYTE) {
    return { ok: false, reason: `expected start byte 0xaa, got 0x${buf[0].toString(16)}`, raw: buf };
  }

  const length = buf[LEN_OFFSET];
  const checksumAt = PAYLOAD_OFFSET + length;

  if (checksumAt >= buf.length) {
    return { ok: false, reason: `length byte ${length} overruns the report`, raw: buf };
  }

  const payload = buf.subarray(PAYLOAD_OFFSET, checksumAt);
  const expected = xorChecksum(buf.subarray(1, checksumAt));
  const actual = buf[checksumAt];

  return {
    ok: true,
    checksumValid: expected === actual,
    expectedChecksum: expected,
    checksum: actual,
    head: [buf[1], buf[2]],
    length,
    payload,
    raw: buf,
  };
}

export const toHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const toSpacedHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

/** Strip the zero padding so logs stay readable. */
export function trimPadding(bytes) {
  const buf = Buffer.from(bytes);
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0) end -= 1;
  return buf.subarray(0, end);
}
