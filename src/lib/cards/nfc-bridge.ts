/**
 * Client for the local NFC bridge (tools/nfc-bridge).
 *
 * A browser cannot open a USB HID reader on Windows — Web NFC only exists in
 * Chrome on Android — so a small local program owns the reader and streams
 * taps over loopback. This module is the browser half of that.
 *
 * Because the bridge runs on the staff member's own machine, the reader only
 * works at desks where it is installed. Everything here degrades to "no
 * reader" rather than breaking the page.
 */

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:7625";

/** Set NEXT_PUBLIC_NFC_BRIDGE_URL if the bridge runs on a non-default port. */
export function bridgeUrl(): string {
  return process.env.NEXT_PUBLIC_NFC_BRIDGE_URL?.replace(/\/$/, "") || DEFAULT_BRIDGE_URL;
}

export type BridgeStatus =
  /** Have not tried yet. */
  | "idle"
  /** Opening the event stream. */
  | "connecting"
  /** Bridge reachable and reader plugged in. */
  | "ready"
  /** Bridge reachable but no reader attached. */
  | "no-reader"
  /** Bridge not running or not reachable. */
  | "unavailable";

export type CardTap = {
  uid: string;
  at: string;
};

/** Group a UID into byte pairs so staff can read it off a card: 04 A2 2B 19. */
export function formatCardUid(uid: string): string {
  // Keyboard-output readers type the UID as a decimal number (e.g.
  // 1920612339). Splitting that into "byte pairs" would invent bytes that
  // are not there, so show decimal numbers exactly as the reader typed them.
  if (/^\d+$/.test(uid)) return uid;
  return (uid.match(/.{1,2}/g) ?? []).join(" ").toUpperCase();
}

/** Strip separators and uppercase, matching normalise_card_uid in Postgres. */
export function normaliseCardUid(uid: string): string {
  return uid.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
}

/** A UID is 4, 7 or 10 bytes; accept a little either side but reject junk. */
export function isPlausibleCardUid(uid: string): boolean {
  return /^[0-9A-F]{8,32}$/.test(normaliseCardUid(uid));
}

/**
 * Whether raw text typed into a field is a card number rather than a search.
 *
 * Keyboard-output readers "type" the card number followed by Enter. Student
 * IDs are 6 digits and names contain spaces or letters beyond A-F, so an
 * unbroken run of 8+ hex characters is safe to treat as a card tap.
 */
export function looksLikeTypedCardNumber(raw: string): boolean {
  return /^[0-9a-fA-F]{8,32}$/.test(raw.trim());
}

export type BridgeHealth = {
  ok: boolean;
  connected: boolean;
  reader: { product?: string; manufacturer?: string } | null;
  /** Whether a card is sitting on the antenna right now. */
  cardPresent: boolean;
  /**
   * Whether this reader can report cards over its data channel at all.
   *
   * The T6-AU-10-03 in use returns a constant to the card command whether or
   * not a card is present, so it reports "unavailable" and the UI falls back
   * to the reader's keyboard interface, which types the number into a focused
   * field.
   */
  presenceDetection: "working" | "unproven" | "unavailable" | "off";
  /** Null until the empty-reader baseline has been recorded. */
  calibration: { emptyResponse: string; source: "file" | "startup" } | null;
  lastCard: CardTap | null;
};

/**
 * One-shot health check.
 *
 * Returns null when the bridge is not reachable at all, which is the common
 * case on a machine with no reader and must not be treated as an error.
 */
export async function checkBridge(signal?: AbortSignal): Promise<BridgeHealth | null> {
  try {
    const res = await fetch(`${bridgeUrl()}/health`, { signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BridgeHealth;
  } catch {
    return null;
  }
}
