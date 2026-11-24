"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bridgeUrl,
  checkBridge,
  type BridgeHealth,
  type BridgeStatus,
  type CardTap,
} from "@/lib/cards/nfc-bridge";

/** How long to wait before retrying a bridge that is not answering. */
const RETRY_MS = 5000;

export type UseNfcReader = {
  status: BridgeStatus;
  /** Most recent tap with a decodable UID, or null. */
  lastTap: CardTap | null;
  /** Forget the current tap so the next one registers as new. */
  clearTap: () => void;
  /** Reader hardware name, when the bridge reports one. */
  readerName: string | null;
  /**
   * Whether a card is physically on the reader right now.
   *
   * Tracked separately from `lastTap`: the bridge can tell a card is present
   * before it can decode its number, so the UI can say "card detected" and
   * still explain that the number could not be read.
   */
  cardPresent: boolean;
  /** True when a card is on the reader but its UID could not be decoded. */
  cardUnreadable: boolean;
  /**
   * Whether the reader can report card taps by itself. When "unavailable" the
   * UI must direct staff at the typed/keyboard-wedge path instead of waiting
   * for a tap that will never arrive.
   */
  presenceDetection: BridgeHealth["presenceDetection"];
};

/**
 * Subscribe to card taps from the local NFC bridge.
 *
 * Safe to mount anywhere: if the bridge is not running the hook simply reports
 * "unavailable" and keeps retrying quietly in the background, so a dashboard
 * on a machine with no reader behaves exactly as it did before.
 *
 * Pass `enabled: false` to hold the connection closed — worth doing when the
 * reader panel is not on screen, so staff machines are not holding an open
 * event stream for a page nobody is using.
 */
export function useNfcReader({ enabled = true }: { enabled?: boolean } = {}): UseNfcReader {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [lastTap, setLastTap] = useState<CardTap | null>(null);
  const [readerName, setReaderName] = useState<string | null>(null);
  const [cardPresent, setCardPresent] = useState(false);
  const [cardUnreadable, setCardUnreadable] = useState(false);
  const [presenceDetection, setPresenceDetection] =
    useState<BridgeHealth["presenceDetection"]>("unproven");

  // Held in a ref so the reconnect timer can be cleared from the cleanup path
  // without making it a dependency of the effect.
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTap = useCallback(() => setLastTap(null), []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let source: EventSource | null = null;

    const scheduleRetry = () => {
      if (cancelled) return;
      retryRef.current = setTimeout(connect, RETRY_MS);
    };

    function connect() {
      if (cancelled) return;
      setStatus("connecting");

      // EventSource surfaces "cannot connect" and "connection dropped" as the
      // same opaque error, so probe /health first to tell a missing bridge
      // apart from a bridge whose reader is unplugged.
      void checkBridge().then((health) => {
        if (cancelled) return;

        if (!health) {
          setStatus("unavailable");
          setReaderName(null);
          scheduleRetry();
          return;
        }

        setStatus(health.connected ? "ready" : "no-reader");
        setReaderName(health.reader?.product ?? null);
        setCardPresent(Boolean(health.cardPresent));
        setPresenceDetection(health.presenceDetection ?? "unproven");

        source = new EventSource(`${bridgeUrl()}/events`);

        source.addEventListener("card", (event) => {
          const tap = JSON.parse((event as MessageEvent).data) as CardTap;
          setLastTap(tap);
        });

        source.addEventListener("cardPresent", (event) => {
          const data = JSON.parse((event as MessageEvent).data) as { uid: string | null };
          setCardPresent(true);
          setCardUnreadable(!data.uid);
        });

        source.addEventListener("cardRemoved", () => {
          setCardPresent(false);
          setCardUnreadable(false);
        });

        source.addEventListener("presenceUnavailable", () => {
          setPresenceDetection("unavailable");
        });

        source.addEventListener("reader", (event) => {
          const info = JSON.parse((event as MessageEvent).data) as {
            connected: boolean;
            product?: string;
          };
          setStatus(info.connected ? "ready" : "no-reader");
          setReaderName(info.product ?? null);
        });

        source.onerror = () => {
          source?.close();
          source = null;
          if (cancelled) return;
          setStatus("unavailable");
          // Presence is only meaningful while the stream is live; a dropped
          // connection must not leave the UI claiming a card is still there.
          setCardPresent(false);
          setCardUnreadable(false);
          scheduleRetry();
        };
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      source?.close();
    };
  }, [enabled]);

  return {
    status,
    lastTap,
    clearTap,
    readerName,
    cardPresent,
    cardUnreadable,
    presenceDetection,
  };
}
