// Localhost HTTP bridge between the USB reader and the admin dashboard.
//
//   npm start
//
// The browser cannot talk to a USB HID reader on Windows (Web NFC is Android
// Chrome only), so this process owns the device and exposes it over loopback.
//
// Endpoints
//   GET  /health   reader status
//   GET  /card     last card seen, or null
//   GET  /events   Server-Sent Events: connected | card | cardRemoved | reader
//   POST /write    write to a card (see WRITE SUPPORT in the README)
//   POST /raw      send a raw frame; only when NFC_BRIDGE_ALLOW_RAW=true

import http from "node:http";
import { NfcReader } from "./reader.js";
import { encodeFrame } from "./frame.js";

const PORT = Number(process.env.NFC_BRIDGE_PORT ?? 7625);
const HOST = "127.0.0.1";

/**
 * Only these origins may talk to the bridge.
 *
 * This matters: without it, any website the staff machine happens to visit
 * could drive the card reader in the background. Loopback alone is not a
 * boundary, the CORS allowlist is.
 */
const ALLOWED_ORIGINS = new Set(
  (process.env.NFC_BRIDGE_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

/** Optional shared secret, sent as `?token=` or `X-Bridge-Token`. */
const TOKEN = process.env.NFC_BRIDGE_TOKEN ?? "";
const ALLOW_RAW = process.env.NFC_BRIDGE_ALLOW_RAW === "true";

const reader = new NfcReader();
let lastCard = null;
let readerInfo = null;

const clients = new Set();

function broadcast(event, data) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    res.write(chunk);
  }
}

reader.on("connected", (info) => {
  readerInfo = info;
  console.log(`[reader] connected: ${info.manufacturer ?? ""} ${info.product ?? ""}`.trim());
  broadcast("reader", { connected: true, ...info });
});

reader.on("disconnected", () => {
  readerInfo = null;
  console.log("[reader] disconnected");
  broadcast("reader", { connected: false });
});

reader.on("calibrated", (info) => {
  if (info.source === "startup") {
    console.log(`[calibrate] assuming the reader was empty at startup: ${info.emptyResponse}`);
    console.log("[calibrate] run `npm run calibrate` to record this deliberately");
  }
});

reader.on("presenceUnavailable", (info) => {
  console.log(`[reader] this unit does not report cards on the data channel.`);
  console.log(`[reader] command 0x0002 returns a constant: ${info.constantResponse}`);
  console.log(`[reader] use the reader's keyboard interface instead — focus the card`);
  console.log(`[reader] field in the dashboard and tap; it types the number.`);
  broadcast("presenceUnavailable", info);
});

reader.on("cardPresent", (event) => {
  lastCard = { uid: event.uid, response: event.response, at: new Date().toISOString() };
  console.log(`[card] present${event.uid ? ` uid=${event.uid}` : " (uid not decodable yet)"}`);
  broadcast("cardPresent", lastCard);
  // Kept for clients that only care about taps with a usable UID.
  if (event.uid) broadcast("card", { uid: event.uid, at: lastCard.at });
});

reader.on("cardRemoved", () => {
  console.log("[card] removed");
  lastCard = null;
  broadcast("cardRemoved", {});
});

reader.on("error", (err) => console.error("[reader] error:", err.message));

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl and friends; no browser to protect.

  if (!ALLOWED_ORIGINS.has(origin)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Origin ${origin} is not allowed` }));
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  // Private Network Access. When the dashboard is served from a hosted origin
  // rather than localhost, Chrome classes a call to 127.0.0.1 as public ->
  // private and sends a preflight carrying this header. Without the matching
  // response header the request fails with an opaque net::ERR_FAILED, which
  // looks exactly like "the bridge is not running".
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  return true;
}

function authorised(req, url) {
  if (!TOKEN) return true;
  return req.headers["x-bridge-token"] === TOKEN || url.searchParams.get("token") === TOKEN;
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (!applyCors(req, res)) return;

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!authorised(req, url)) {
    return json(res, 401, { error: "Missing or invalid bridge token" });
  }

  if (url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      connected: reader.connected,
      reader: readerInfo ? { product: readerInfo.product, manufacturer: readerInfo.manufacturer } : null,
      cardPresent: reader.cardPresent,
      presenceDetection: reader.presenceDetection,
      calibration: reader.calibration,
      lastCard,
    });
  }

  if (url.pathname === "/card") {
    return json(res, 200, { present: reader.cardPresent, card: reader.currentCard });
  }

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    // Send current state immediately so a client that connects while a card is
    // already on the reader does not have to wait for it to be lifted.
    res.write(`event: reader\ndata: ${JSON.stringify({ connected: reader.connected, ...readerInfo })}\n\n`);
    if (reader.cardPresent) {
      res.write(`event: cardPresent\ndata: ${JSON.stringify(reader.currentCard)}\n\n`);
    }
    clients.add(res);

    // Comment lines keep proxies and the browser from closing an idle stream.
    const ping = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  if (url.pathname === "/write" && req.method === "POST") {
    return json(res, 501, {
      error: "Writing to cards is not implemented yet",
      detail:
        "The reader's frame format is known (AA | head | len | payload | XOR) and it " +
        "accepts commands, but the opcode set for authenticating and writing a block " +
        "has not been identified. See WRITE SUPPORT in tools/nfc-bridge/README.md. " +
        "Assigning a card to a student does not require writing: use the card UID.",
    });
  }

  if (url.pathname === "/raw" && req.method === "POST") {
    if (!ALLOW_RAW) {
      return json(res, 403, { error: "Raw frames are disabled. Set NFC_BRIDGE_ALLOW_RAW=true to enable." });
    }
    if (!reader.connected) {
      return json(res, 503, { error: "Reader is not connected" });
    }
    try {
      const body = await readJsonBody(req);
      const payload = Buffer.from(String(body.payloadHex ?? "").replace(/\s+/g, ""), "hex");
      if (payload.length === 0) return json(res, 400, { error: "payloadHex is required" });
      const written = reader.sendReport(encodeFrame(payload));
      return json(res, 200, { ok: true, written });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  return json(res, 404, { error: "Not found" });
});

reader.start();

server.listen(PORT, HOST, () => {
  console.log(`NFC bridge listening on http://${HOST}:${PORT}`);
  console.log(`Allowed origins: ${[...ALLOWED_ORIGINS].join(", ")}`);
  if (!TOKEN) console.log("No NFC_BRIDGE_TOKEN set; relying on the origin allowlist alone.");
  if (ALLOW_RAW) console.log("Raw frame endpoint is ENABLED.");
});

function shutdown() {
  console.log("\nShutting down.");
  reader.stop();
  for (const res of clients) res.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
