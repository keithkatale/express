"use client";

import { useEffect, useRef } from "react";
import { looksLikeTypedCardNumber } from "@/lib/cards/nfc-bridge";

/**
 * Longest gap between keystrokes that still counts as the reader typing.
 * USB keyboard-output readers type a whole card number in a few tens of
 * milliseconds; a person typing digits is several times slower.
 */
const MAX_GAP_MS = 50;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Catch a card tap from a keyboard-output reader anywhere on the page.
 *
 * The reader "types" the card number and presses Enter into whatever has
 * focus. When that is a text field the field's own handler deals with it;
 * this covers the case where focus is on the page itself (after clicking a
 * button or a list item), which would otherwise drop the tap silently.
 *
 * Only a fast burst ending in Enter counts, so ordinary key presses on the
 * page are never mistaken for a card. It cannot see typing aimed at another
 * application — the browser window has to be the focused window.
 */
export function useCardWedge(onCard: (cardNumber: string) => void, { enabled = true } = {}) {
  const onCardRef = useRef(onCard);

  useEffect(() => {
    onCardRef.current = onCard;
  }, [onCard]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastAt = 0;

    function onKeyDown(event: KeyboardEvent) {
      if (isEditable(event.target)) return;

      const now = event.timeStamp;
      if (now - lastAt > MAX_GAP_MS) buffer = "";
      lastAt = now;

      if (event.key === "Enter") {
        const candidate = buffer;
        buffer = "";
        if (looksLikeTypedCardNumber(candidate)) {
          event.preventDefault();
          onCardRef.current(candidate);
        }
        return;
      }

      if (event.key.length === 1) buffer += event.key;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
