# NFC bridge

A local program that talks to the USB 13.56 MHz card reader and exposes it to the
admin dashboard over loopback HTTP.

It is a standalone Node program. It is not part of the Next.js app, has its own
`node_modules`, and is excluded from the app's lint and TypeScript config.

## Why a separate program at all

A web page cannot open a USB HID device on Windows. Web NFC (`NDEFReader`) exists
only in Chrome on Android. So something native has to own the reader and hand
results to the browser. That is this.

Consequence worth planning around: **the reader only works on the machine the
bridge runs on.** If the dashboard is hosted (Vercel or similar), the staff
browser still talks to `127.0.0.1:7625` on their own desk, which is fine, but
every machine that assigns cards needs this installed.

## Current reader: keyboard-output "IC Reader" (USB ffff:0035)

The reader now in use works without this bridge. It beeps on a tap and
**types the card's UID as a 10-digit decimal number followed by Enter**
(e.g. `1920612339`, which is the 4-byte UID `72 7A 37 F3` or its byte
reversal). The dashboard is built for this:

- **Assigning:** the card field on a student's profile is focused when you
  click *Assign card*, so a tap fills it and Enter moves to the confirm step.
- **Finding a student:** the search box on the students list is focused on
  desktop; a tapped card number plus Enter opens that student. Anything that
  is not an unbroken run of 8+ hex/decimal characters is a normal search.

Card numbers are stored exactly as the reader types them. If you ever switch
to a reader that reports the UID in a different form (raw hex from a PC/SC
reader, for instance), existing cards will need re-tapping once to re-map.

Its second interface ("UserDefHid", usage page 0xffa0) takes 256-byte feature
reports with ids 1–3, like the documented pyrfidhid family. Commands written
there (beep, read card, in the `AA … BB` serial framing) are accepted, but the
reply read back is always the same canned `aa 00 02 01 8f 8c bb`, so this
channel is not used. Reading works through the keyboard interface instead.

The rest of this document covers the earlier T6-AU-10-03 reader, which could
not be made to read cards (see below).

## Who makes this reader

The firmware string `T6-CompPRO-AU-10-00` matches the **T6 series** from
Shenzhen HuaXiangTianCheng (华翔天诚), brand HX/HXTC. Their model scheme is
`T6-<capability><interface>-nn-nn`, where the second letter is the interface
(**U = USB**) and the first is card capability (**A = read/write card
content**). So the hardware is a read/write unit, not a read-only one.
`CompPRO` and the USB string `HOUSESmart` are OEM brand inserts.

The vendor ships only a closed DLL/SDK, so the wire protocol is undocumented
by design. Their manual (《T6系列用户手册》) and demo code are sent on request —
that is the realistic route to a complete opcode table.

## The reader that is attached

Identified by probing the machine:

| | |
|---|---|
| USB ID | `0483:4C43` (STMicroelectronics VID) |
| Manufacturer | HOUSESmart |
| Interface 0 | `TransferData`, HID usage page `0x8C` (barcode badge) — the data channel |
| Interface 1 | `KeyBoard`, HID usage page `0x01` — types the card number as keystrokes |

**It is not a PC/SC reader.** It does not appear under the Windows smart card
service (`SCardSvr` is stopped and no `SmartCardReader` class device exists), so
the usual `nfc-pcsc` / ACR122U approach does not apply. This bridge speaks to
interface 0 directly with `node-hid`.

## The wire protocol

Worked out by observation, not from a datasheet. With no card present the reader
emits this 32-byte report every ~2 seconds:

```
aa 00 00 05 00 00 ff ff 26 23 00 00 ... (zero padded to 32)
```

```
offset  0   1   2   3     4 .. 4+len-1   4+len
        AA  ..  ..  len   payload        checksum
```

- `aa` — start byte
- `05` — payload length
- `00 00 ff ff 26` — the payload
- `23` — XOR of every byte from offset 1 up to the checksum

The checksum checks out: `00^00^05^00^00^ff^ff^26 = 0x23`. The test suite asserts
that `encodeFrame([0x00,0x00,0xff,0xff,0x26])` reproduces the reader's own idle
frame byte for byte, which is the evidence that this reading of the format is
right.

The payload's last byte, `0x26`, is **REQA**, the ISO 14443-A "is anyone there"
opcode, and `ff ff` reads as a "nothing answered" status. So the idle frame is
the reader polling for a card and finding none.

The reader also *accepts* writes: sending a report succeeds and suppresses the
idle poll while it is processed. So it takes commands as well as emitting them.
(Sending its own poll frame back was tried; it left the reader in its normal
state afterwards, nothing was reconfigured.)

### Commands established by probing

Payloads appear to be `00 00 | <command, 2 bytes> | <parameter>`. Two commands
answer; everything else tried was ignored.

| Payload | Response | Reading |
|---|---|---|
| `00 00 00 00 xx` | `00 00 00 00 00` + `"T6-CompPRO-AU-10-00 V1."` | Command `0000` = device info. The trailing byte is ignored — `26` and `52` both give this. |
| `00 00 00 02 26` | `00 00 00 02 00 00 00 06 57` | Command `0002` = search + anticollision + select. Reproducible, and distinct from device info. |
| `00 00 ff ff 52`, `25 26 00`, `25`, `26` | nothing | `ff ff` is a response-only status; the vendor's *serial* read-card payload `25 26 00` is not accepted over HID. |

### Transport verified; the read command is the missing piece

Windows HID caps for interface 0: **33-byte input and output reports**
(report id 0 + 32 data bytes), **no feature reports**. That is exactly what
this bridge sends, so the transport is not the problem.

Two separate brand-new T6-AU-10-03 readers do **not** react to any card on
their own — not their bundled card, not MIFARE MF-02A cards, not a contactless
bank card: no beep, no LED change, no keystrokes — even with no host software
running. The working theory is that the read/write ("A") variant only reads
when host software commands it (via the vendor SDK), unlike plug-and-play
read-number ("D") variants.

The vendor's documented *serial* read-card command `AA 00 03 25 26 00 00 BB`
gets **no reply** over USB HID — verbatim, without the trailing `BB`, or inside
the two-byte-header envelope. So the serial command set does not carry over.

### Conclusion: the T6-AU read command is vendor-secret

Research (vendor model tables, rfidworld listings) confirms the split: the
**T6-DU** models are "read card number only" plug-and-play readers that type
the number; the **T6-AU** is "read/write card content" and is operated only by
calling the vendor SDK's interface functions. No keyboard output, no
autonomous beep, and no published way to switch modes.

The serial-protocol (RDM880/MFRC500 family) commands do not work over this
reader's HID channel: read-serial `AA 00 03 25 26 00 00 BB`, beep
`AA 00 03 89 01 01 8A BB` and version `AA 00 03 86 00 00 85 BB` all get no
reply, verbatim or in the observed envelope. Feature reports are not an
option (the device has none).

No SDK, DLL name, export list or USB capture for the T6 exists publicly. The
ways forward are:

1. **Vendor SDK.** Ask the seller/vendor for the T6 user manual and demo/DLL
   (contacts: WeChat 13823276735 or 13480798831, dzh0809@163.com). The bridge
   can then call the vendor DLL directly, or the DLL's USB traffic can be
   captured and reimplemented here.
2. **A documented reader.** A keyboard-output 13.56 MHz MIFARE reader (e.g. a
   T6-DU) works with the dashboard today with no bridge: the card field is
   autofocused. A PC/SC reader (e.g. ACR122U) gives full read/write through a
   standard API.

Guessing opcodes on the live reader is not recommended: unknown commands may
rewrite reader configuration.

### When the vendor SDK arrives

`VENDOR-REQUEST.md` has the request to send (Chinese, with English
reference). Once the files come back:

1. **Inspect the DLL without running it:**
   `npm run inspect-dll -- "C:\path\to\vendor.dll"` reads the PE headers
   from disk and lists the exported functions and the architecture. Nothing
   is loaded or executed — vendor SDKs are untrusted binaries.
2. **32-bit is expected and handled.** Vendor SDKs of this kind are usually
   32-bit, and this bridge runs on 64-bit Node, which cannot load a 32-bit DLL
   in-process. Windows' 32-bit PowerShell
   (`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`) can, via
   `Add-Type` P/Invoke. Verified on this machine: 64-bit Node spawned it, it
   called into a 32-bit DLL, and returned the result as JSON. The plan is a
   persistent 32-bit helper process the bridge talks to over stdin/stdout
   (spawning PowerShell per call is ~1 s, too slow to poll with).
3. **Alternative without the DLL:** run the vendor's demo program while
   capturing USB traffic (Wireshark + USBPcap), then reimplement the read and
   beep packets directly in this bridge, which already owns the HID channel.

### Tested with a card: the data channel does not see cards

The comparison has now been run on the attached **T6-AU-10-03**:

```
card ON    00 00 00 02 00 00 00 06 57
card OFF   00 00 00 02 00 00 00 06 57     identical
```

`00 00 06 57` is a **constant, not a UID**. The reader's own 2-second poll also
reports "nothing answered" with a card sitting on the antenna. So on this unit
the HID data channel cannot report card presence or card numbers at all, by any
of the commands found.

`rf_anticoll` (`00 00 02 02`) returns `00 00 02 02 ff` in both states, which did
at least establish the status convention: a trailing `00` is success and `ff` is
failure.

**Consequence:** presence detection over the bridge does not work on this
hardware. The bridge detects this itself — after a dozen identical polls it
reports `presenceDetection: "unavailable"` in `/health`, emits a
`presenceUnavailable` event, and logs an explanation. The UI then hides
tap-to-find and points staff at the typed/keyboard field instead of waiting for
a tap that will never arrive.

**What to use instead:** the reader's second USB interface is a keyboard that
types the card number. The assign panel autofocuses its card field, so tapping a
card types the number straight in. That path needs no bridge at all.

Related but *different* framing (`AA BB` header, escaped body) is documented for
this vendor's wider ecosystem and lists `0x0002` as "search + anticollision +
select, returns the card serial", which is why `0002` was tried. Do not assume
the rest of that table transfers: it does not share this device's header.

## What is verified and what is not

Verified against the hardware:

- Finding, opening and holding the reader, with reconnect on unplug.
- Frame encode/decode and checksum (18 unit tests, `npm test`).
- Correctly classifying the idle poll — over 8 seconds of live polling the
  bridge emitted zero false card events.
- The HTTP API, CORS allowlist, and SSE stream.

**Not yet verified: a frame with a card actually on the reader.** That needs one
physical tap, which could not be done from a terminal. The UID decoder in
`src/protocol.js` is written to the obvious reading of the format and is covered
by tests using synthetic frames, but it has not met a real card. Until it does,
treat `uid` values as provisional.

A card left sitting on the reader does **not** change the idle poll — verified
with a card in place, the frame stayed `ff ff` (no answer). Nor does any
command found change its answer when a card is present (see above). On this
unit, reading cards goes through the keyboard interface.

If a different reader is attached later, or the vendor SDK yields the right
opcode, these tools re-test it:

```powershell
cd tools\nfc-bridge; npm run card-test
```

It prompts for card on, card off, then a second card, sends command `0002` at
each step and diffs the responses. That answers both questions at once: whether
`0002` carries card data at all, and if so which bytes are the UID.

`npm run capture` is the broader version: it records every frame to
`capture.log.json` while you tap. Either way, `extractUid()` in
`src/protocol.js` is the only place that needs to change.

## WRITE SUPPORT

Not implemented. `POST /write` returns 501 on purpose rather than pretending.

The frame format is known and the reader accepts commands, but the opcodes for
"authenticate to a sector" and "write a block" are vendor-specific and are not
published for this device. Guessing them against a live reader is a bad idea:
an unrecognised opcode could rewrite reader configuration. The way to get them is
to run the vendor's own Windows utility against the reader while capturing USB
traffic (Wireshark with USBPcap), then decode the frames it sends — they will use
the same `AA | len | payload | XOR` envelope this bridge already implements, so
only `src/protocol.js` needs the new opcodes.

**That said — the card system does not need writing.** Reading the UID is enough,
and is the better design:

- Store a `student_cards` row mapping `card_uid` to `student_id`. The card
  carries only its factory UID; the balance lives in `ledger_entries` where it
  already is.
- Nothing of value is on the card, so a cloned or lost card is revoked by
  flipping a row, not by chasing the money.
- Writing a balance onto a card would mean a copied card is copied money, and the
  cheap 13.56 MHz cards in circulation (MIFARE Classic) have been cryptographically
  broken for years. Do not put value on them.

So the recommendation is to ship UID-only assignment and treat write support as
something to revisit only if a specific requirement turns up that needs it.

## Running it

```powershell
cd tools\nfc-bridge; npm install
```

```powershell
cd tools\nfc-bridge; npm start
```

| Script | What it does |
|---|---|
| `npm start` | Run the bridge on `127.0.0.1:7625` |
| `npm run state` | Sample the card command five times and report if it is stable |
| `npm run card-test` | Card on / off / second card, diffed — settles the UID layout |
| `npm run calibrate` | Record the empty-reader baseline for presence detection |
| `npm run capture` | Record frames; use this to decode a card tap |
| `npm run probe` | Dump reader info and every raw report |
| `npm test` | Unit tests for the frame and protocol logic |

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `NFC_BRIDGE_PORT` | `7625` | Port on loopback |
| `NFC_BRIDGE_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Origins allowed to call it |
| `NFC_BRIDGE_TOKEN` | *(none)* | Optional shared secret, as `X-Bridge-Token` or `?token=` |
| `NFC_BRIDGE_ALLOW_RAW` | `false` | Enable `POST /raw` for protocol work |

The origin allowlist is not decoration. Loopback is not a security boundary: any
website the staff machine visits can issue requests to `127.0.0.1`. The allowlist
is what stops a random page driving the card reader. Set
`NFC_BRIDGE_ORIGINS` to the real dashboard origin in production.

### Hosting the dashboard off localhost

When the dashboard is served from a hosted origin rather than `localhost:3000`,
Chrome classes a call to `127.0.0.1` as a **public → private** request and sends
a Private Network Access preflight. The bridge answers it with
`Access-Control-Allow-Private-Network: true`. Without that the request fails as
an opaque `net::ERR_FAILED`, which looks identical to "the bridge is not
running" — so if taps stop working after a deploy, check this first.

An `https://` dashboard calling `http://127.0.0.1` is *not* blocked as mixed
content: browsers treat loopback as a trustworthy origin.

## API

```
GET  /health   { ok, connected, reader, lastCard }
GET  /card     { card: { uid, at } | null }
GET  /events   SSE: reader | card | cardRemoved | frame
POST /write    501 — see WRITE SUPPORT
POST /raw      { payloadHex } — only when NFC_BRIDGE_ALLOW_RAW=true
```

Consuming the tap stream from the dashboard:

```js
const es = new EventSource("http://127.0.0.1:7625/events");
es.addEventListener("card", (e) => {
  const { uid } = JSON.parse(e.data);
  // Look the UID up, or assign it to the student being enrolled.
});
es.addEventListener("reader", (e) => {
  const { connected } = JSON.parse(e.data);
  // Show "reader not connected" in the UI when this goes false.
});
```

A card left on the antenna is re-reported on every poll; the bridge debounces
that to one `card` event per presentation, followed by `cardRemoved` once the
card has been off for 3 seconds.

### Fallback that needs no bridge

The reader's second interface is a keyboard. Focus a text input, tap a card, and
the number is typed followed by Enter. If the bridge is ever unavailable, an
"assign card" screen with a focused input still works. It cannot write cards and
gives no removal events, but it is a dependable backstop.
