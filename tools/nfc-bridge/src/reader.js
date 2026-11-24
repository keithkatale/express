// HID transport for the reader: find it, keep it open, poll it for a card,
// and turn the responses into presence and tap events.
//
// Why active polling rather than listening:
//
// Left alone the reader emits `00 00 ff ff 26` every 2 seconds — a REQA poll
// that nothing answered. That frame stays the same even with a card sitting on
// the antenna, because the card is read once on arrival and then HALTed, and
// REQA by design does not wake a HALTed card. So the passive stream can never
// tell us a card is present. Sending command 0x0002 (search + anticollision +
// select) does get a card-dependent answer, so that is what we poll.

import { EventEmitter } from "node:events";
import HID from "node-hid";
import { encodeFrame, decodeFrame, toSpacedHex, trimPadding } from "./frame.js";
import { EventType, interpretCardResponse } from "./protocol.js";
import { loadBaseline } from "./baseline.js";

/** STMicroelectronics VID; the HOUSESmart/T6 reader ships on this stack. */
export const VENDOR_ID = 0x0483;
export const PRODUCT_ID = 0x4c43;

/** Barcode-badge usage page: the reader's raw data channel. */
const DATA_USAGE_PAGE = 0x8c;

/** Command 0x0002 with the REQA parameter: search + anticollision + select. */
export const READ_CARD_PAYLOAD = [0x00, 0x00, 0x00, 0x02, 0x26];

/** Fast enough to feel instant at a counter, slow enough to stay quiet. */
const POLL_MS = 600;
const RESPONSE_TIMEOUT_MS = 500;
const RECONNECT_MS = 1000;

/**
 * Consecutive identical readings before a presence change is believed. One
 * stray frame at the edge of the field should not fire a tap.
 */
const DEBOUNCE_READS = 2;

/**
 * Polls with an unchanging response before we conclude the data channel
 * cannot see cards. At POLL_MS this is a few seconds — long enough that a card
 * being placed during startup would have shown up.
 */
const PRESENCE_VERDICT_POLLS = 12;

export function findReader() {
  const devices = HID.devices();

  const exact = devices.find(
    (d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID && d.usagePage === DATA_USAGE_PAGE
  );
  if (exact) return exact;

  const sameVendor = devices.find((d) => d.vendorId === VENDOR_ID && d.usagePage === DATA_USAGE_PAGE);
  if (sameVendor) return sameVendor;

  return devices.find((d) => d.usagePage === DATA_USAGE_PAGE) ?? null;
}

/**
 * Events emitted:
 *   connected     { product, manufacturer, path }
 *   disconnected  {}
 *   cardPresent   { uid|null, response }  a card arrived on the antenna
 *   cardRemoved   {}                      the antenna went empty
 *   calibrated    { emptyResponse, source: "file" | "startup" }
 *   frame         every interpreted response, for diagnostics
 *   error         Error
 */
export class NfcReader extends EventEmitter {
  #device = null;
  #reconnectTimer = null;
  #pollTimer = null;
  #pending = null;
  #stopped = false;

  /** Response seen when the antenna is empty; null until calibrated. */
  #emptyResponse = null;
  #calibrationSource = null;

  /** Debounce state for presence. */
  #present = false;
  #candidatePresent = false;
  #candidateCount = 0;
  #currentCard = null;

  /**
   * Whether polling has EVER produced a different response.
   *
   * Measured on the attached T6-AU-10-03, command 0x0002 returns the constant
   * `00 00 00 02 00 00 00 06 57` with a card on the antenna and with it off —
   * so on this unit the data channel does not see cards at all, and presence
   * can never be derived from it. Rather than report "no card" forever and let
   * the UI imply the reader is working, track this and say so.
   */
  #responseEverVaried = false;
  #pollCount = 0;
  /** Set once the verdict is "unavailable": we stop commanding the reader. */
  #pollingHalted = false;

  constructor({ poll = true } = {}) {
    super();
    this.poll = poll;
    const saved = loadBaseline();
    if (saved) {
      this.#emptyResponse = saved.emptyResponse;
      this.#calibrationSource = "file";
    }
  }

  get connected() {
    return this.#device !== null;
  }

  get cardPresent() {
    return this.#present;
  }

  get currentCard() {
    return this.#currentCard;
  }

  get calibration() {
    return this.#emptyResponse
      ? { emptyResponse: this.#emptyResponse, source: this.#calibrationSource }
      : null;
  }

  /**
   * "working"   — the poll response has changed, so presence is real.
   * "unproven"  — polling, but nothing has varied yet.
   * "unavailable" — polled long enough that the response is clearly constant;
   *                 this reader cannot report cards on the data channel.
   * "off"       — not polling.
   */
  get presenceDetection() {
    if (this.#pollingHalted) return "unavailable";
    if (!this.poll) return "off";
    if (this.#responseEverVaried) return "working";
    return this.#pollCount >= PRESENCE_VERDICT_POLLS ? "unavailable" : "unproven";
  }

  /**
   * Begin connecting.
   *
   * The first connect is deferred by a tick so that `connected` is never
   * emitted before the caller has had a chance to attach listeners — doing it
   * synchronously means `reader.start()` followed by `reader.on("connected")`
   * silently never fires.
   */
  start() {
    this.#stopped = false;
    setTimeout(() => this.#connect(), 0).unref?.();
    return this;
  }

  stop() {
    this.#stopped = true;
    clearTimeout(this.#reconnectTimer);
    clearTimeout(this.#pollTimer);
    this.#close();
  }

  /**
   * Send a payload and wait for the next frame back.
   *
   * Only one command is in flight at a time: the reader answers in order and
   * has no request IDs, so overlapping commands would mismatch replies.
   */
  sendCommand(payload, timeoutMs = RESPONSE_TIMEOUT_MS) {
    if (!this.#device) return Promise.reject(new Error("Reader is not connected"));
    if (this.#pending) return Promise.reject(new Error("A command is already in flight"));

    const report = encodeFrame(payload);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#pending = null;
        resolve(null);
      }, timeoutMs);

      this.#pending = (frame) => {
        clearTimeout(timer);
        this.#pending = null;
        resolve(frame);
      };

      try {
        this.#device.write(Array.from(Buffer.concat([Buffer.from([0x00]), report])));
      } catch (err) {
        clearTimeout(timer);
        this.#pending = null;
        this.emit("error", err);
        resolve(null);
      }
    });
  }

  /** Read the antenna once. Returns the response payload as spaced hex. */
  async readOnce() {
    const frame = await this.sendCommand(READ_CARD_PAYLOAD);
    if (!frame?.ok || !frame.checksumValid) return null;
    return toSpacedHex(frame.payload);
  }

  #connect() {
    if (this.#stopped || this.#device) return;

    const info = findReader();
    if (!info) {
      this.#scheduleReconnect();
      return;
    }

    let device;
    try {
      device = new HID.HID(info.path);
    } catch (err) {
      this.emit("error", new Error(`Could not open reader: ${err.message}`));
      this.#scheduleReconnect();
      return;
    }

    this.#device = device;
    this.emit("connected", {
      product: info.product,
      manufacturer: info.manufacturer,
      path: info.path,
    });

    device.on("data", (data) => this.#onReport(data));
    device.on("error", (err) => {
      this.emit("error", err);
      this.#close();
      this.#scheduleReconnect();
    });

    if (this.poll) this.#schedulePoll(0);
  }

  #close() {
    const device = this.#device;
    this.#device = null;
    this.#pending = null;
    clearTimeout(this.#pollTimer);

    if (this.#present) {
      this.#present = false;
      this.#currentCard = null;
      this.emit("cardRemoved", {});
    }

    if (!device) return;
    try {
      device.close();
    } catch {
      // Already gone.
    }
    this.emit("disconnected", {});
  }

  #scheduleReconnect() {
    if (this.#stopped) return;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      this.#connect();
    }, RECONNECT_MS);
    this.#reconnectTimer.unref?.();
  }

  #onReport(data) {
    const frame = decodeFrame(data);

    // A command is waiting: this frame is its reply.
    if (this.#pending) {
      this.#pending(frame);
      return;
    }

    // Unsolicited (the reader's own 2s poll while we are not polling).
    this.emit("frame", { raw: toSpacedHex(trimPadding(data)), solicited: false });
  }

  #schedulePoll(delay = POLL_MS) {
    if (this.#stopped || !this.poll || this.#pollingHalted) return;
    clearTimeout(this.#pollTimer);
    this.#pollTimer = setTimeout(() => {
      this.#pollTimer = null;
      void this.#pollOnce();
    }, delay);
    this.#pollTimer.unref?.();
  }

  async #pollOnce() {
    if (!this.#device) return;

    const response = await this.readOnce();

    if (response === null) {
      // No reply. Do not treat silence as "card removed"; just try again.
      this.#schedulePoll();
      return;
    }

    // First ever reading with no baseline on disk: assume the reader is empty
    // now and adopt it. Announced so the operator can see the assumption.
    if (this.#emptyResponse === null) {
      this.#emptyResponse = response;
      this.#calibrationSource = "startup";
      this.emit("calibrated", { emptyResponse: response, source: "startup" });
      this.#schedulePoll();
      return;
    }

    this.#pollCount += 1;
    const differs = response !== this.#emptyResponse;
    if (differs) this.#responseEverVaried = true;

    // Announce the verdict exactly once, on the poll that crosses the line.
    if (
      !this.#responseEverVaried &&
      this.#pollCount === PRESENCE_VERDICT_POLLS
    ) {
      this.emit("presenceUnavailable", { constantResponse: response });
      // Polling is now pointless, and every command we send makes the reader
      // suspend its own card polling (and possibly its beep and keyboard
      // output). Stop, so the reader behaves as it would with nothing attached.
      this.#pollingHalted = true;
      return;
    }

    this.emit("frame", { raw: response, solicited: true });
    this.#applyPresence(differs, response);
    this.#schedulePoll();
  }

  /** Debounce, then emit on an actual change of state. */
  #applyPresence(isPresent, response) {
    if (isPresent === this.#candidatePresent) {
      this.#candidateCount += 1;
    } else {
      this.#candidatePresent = isPresent;
      this.#candidateCount = 1;
    }

    if (this.#candidateCount < DEBOUNCE_READS) return;
    if (isPresent === this.#present) return;

    this.#present = isPresent;

    if (!isPresent) {
      this.#currentCard = null;
      this.emit("cardRemoved", {});
      return;
    }

    const event = interpretCardResponse(response);
    this.#currentCard = {
      uid: event.type === EventType.CARD ? event.uid : null,
      response,
    };
    this.emit("cardPresent", this.#currentCard);
  }
}
