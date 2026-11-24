// Turning decoded frames into card events.
//
// What is confirmed by observation on the attached reader:
//
//   * With no card on the antenna the reader emits, every ~2s:
//         aa 00 00 05 00 00 ff ff 26 23      payload = 00 00 ff ff 26
//     The payload ends in 0x26, the ISO 14443-A REQA opcode, and 0xffff
//     reads as a "nothing answered" status.
//
//   * Writing a report to the reader is accepted (the HID write succeeds and
//     suppresses the idle poll while it is handled), so the reader takes
//     commands as well as emitting them.
//
// What is NOT yet confirmed: the shape of a frame when a card IS present.
// That needs one physical tap. `npm run capture` records it, and
// CARD_PAYLOAD_LAYOUT below is the single place to encode the answer.

import { decodeFrame, toHex, trimPadding, toSpacedHex } from "./frame.js";

/** ISO 14443-A opcodes this reader is known to put in the trailing byte. */
export const ISO14443A = {
  REQA: 0x26,
  WUPA: 0x52,
  ANTICOLLISION: 0x93,
  SELECT: 0x93,
  HALT: 0x50,
};

/** The exact payload the reader sends when it polled and nothing answered. */
const IDLE_PAYLOAD = Buffer.from([0x00, 0x00, 0xff, 0xff, 0x26]);

/** UID lengths permitted by ISO 14443-3 (single, double, triple size). */
const VALID_UID_LENGTHS = new Set([4, 7, 10]);

export const EventType = {
  /** Reader polled, no card on the antenna. */
  IDLE: "idle",
  /** A card answered and we extracted its UID. */
  CARD: "card",
  /** A well-formed frame we do not yet know how to read. */
  UNKNOWN: "unknown",
  /** Not a valid frame at all. */
  INVALID: "invalid",
};

/**
 * Best-effort UID extraction from a card-present payload.
 *
 * The idle payload is `<2 status bytes> <ff ff> <opcode>`. The natural reading
 * is that 0xffff is a status word that becomes something else on success, and
 * that the UID is spliced in. Rather than hard-code a guess, look for a run of
 * bytes of a legal UID length sitting between the leading status bytes and the
 * trailing opcode.
 *
 * Returns null when the payload does not fit that shape, so callers surface it
 * as UNKNOWN with the raw bytes instead of inventing a card number.
 */
function extractUid(payload) {
  if (payload.length <= IDLE_PAYLOAD.length) return null;

  const trailingOpcode = payload[payload.length - 1];
  const looksLikePoll =
    trailingOpcode === ISO14443A.REQA || trailingOpcode === ISO14443A.WUPA;

  // Drop the two leading status bytes and the trailing opcode, if present.
  const start = 2;
  const end = looksLikePoll ? payload.length - 1 : payload.length;
  const middle = payload.subarray(start, end);

  // Strip a 0xffff status word if the reader left one in place.
  const candidate =
    middle.length > 2 && middle[0] === 0xff && middle[1] === 0xff
      ? middle.subarray(2)
      : middle;

  if (!VALID_UID_LENGTHS.has(candidate.length)) return null;
  // An all-zero or all-0xff "UID" is a status word, not a card.
  if (candidate.every((b) => b === 0x00) || candidate.every((b) => b === 0xff)) return null;

  return Buffer.from(candidate);
}

/**
 * Length of the command echo at the start of a command response: the reader
 * repeats the four payload bytes it was sent, e.g. `00 00 00 02`.
 */
const COMMAND_ECHO_LENGTH = 4;

/**
 * Pull a UID out of a response to command 0x0002.
 *
 * Observed with a card on the antenna:
 *     00 00 00 02 | 00 | 00 00 06 57
 *     \_ echo ___/  \_/   \_ data _/
 *                 status
 *
 * Whether those trailing bytes are a UID or a status word is NOT yet settled
 * (see `npm run card-test`). So this validates hard and returns UNKNOWN rather
 * than guessing: a wrong UID here would be written into student_cards and
 * silently bind the wrong card to a student.
 */
export function interpretCardResponse(spacedHex) {
  const bytes = Buffer.from(String(spacedHex).replace(/\s+/g, ""), "hex");

  if (bytes.length <= COMMAND_ECHO_LENGTH) {
    return { type: EventType.UNKNOWN, payload: spacedHex };
  }

  // Drop the command echo, then an optional single status byte.
  const afterEcho = bytes.subarray(COMMAND_ECHO_LENGTH);
  const candidates = [afterEcho, afterEcho.subarray(1)];

  for (const candidate of candidates) {
    if (!VALID_UID_LENGTHS.has(candidate.length)) continue;
    // ISO 14443-3 never assigns 0x00 as the first UID byte, so a leading zero
    // means we are looking at a status word, not a card number.
    if (candidate[0] === 0x00) continue;
    if (candidate.every((b) => b === candidate[0])) continue;

    return {
      type: EventType.CARD,
      uid: toHex(candidate).toUpperCase(),
      uidBytes: Buffer.from(candidate),
      payload: spacedHex,
    };
  }

  return { type: EventType.UNKNOWN, payload: spacedHex };
}

/**
 * Interpret one raw HID report.
 *
 * Always returns an event; never throws. Every event carries `raw` so an
 * unrecognised reader state is still visible to whoever is debugging it.
 */
export function interpretReport(report) {
  const frame = decodeFrame(report);
  const raw = toSpacedHex(trimPadding(report));

  if (!frame.ok) {
    return { type: EventType.INVALID, reason: frame.reason, raw };
  }
  if (!frame.checksumValid) {
    return {
      type: EventType.INVALID,
      reason: `checksum 0x${frame.checksum.toString(16)} does not match computed 0x${frame.expectedChecksum.toString(16)}`,
      raw,
    };
  }

  const { payload } = frame;

  if (payload.equals(IDLE_PAYLOAD)) {
    return { type: EventType.IDLE, raw };
  }

  const uid = extractUid(payload);
  if (uid) {
    return {
      type: EventType.CARD,
      uid: toHex(uid).toUpperCase(),
      uidBytes: uid,
      payload: toSpacedHex(payload),
      raw,
    };
  }

  return {
    type: EventType.UNKNOWN,
    payload: toSpacedHex(payload),
    raw,
  };
}
