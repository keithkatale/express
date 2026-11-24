"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Nfc } from "lucide-react";
import { ReaderStatus } from "@/components/cards/reader-status";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import { formatCardUid } from "@/lib/cards/nfc-bridge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentByCard } from "@/types/database";

/**
 * Counter-side tap: present a card, land on that student's profile.
 *
 * This is the half of the cashless system that gets used all day, so it stays
 * out of the way when no reader is attached rather than occupying the top of
 * the students list with a dead control.
 */
export function CardTapLookup() {
  const router = useRouter();
  const { status, lastTap, clearTap, readerName, presenceDetection } = useNfcReader();
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!lastTap) return;

    let cancelled = false;
    setLooking(true);
    setError(null);

    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc("find_student_by_card", {
        p_card_uid: lastTap.uid,
      });

      if (cancelled) return;
      setLooking(false);
      clearTap();

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const match = (data as StudentByCard[] | null)?.[0];
      if (!match) {
        setError(
          `Card ${formatCardUid(lastTap.uid)} is not assigned to anyone. Open a student and assign it.`
        );
        return;
      }

      router.push(`/accountant/student/${match.id}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [lastTap, clearTap, router]);

  // Nothing useful to show on a machine with no card service, or on a reader
  // that cannot report taps to the bridge at all — promising "tap a card" when
  // no tap will ever arrive is worse than showing nothing.
  if (status === "unavailable" || status === "idle") return null;
  if (presenceDetection === "unavailable") return null;

  return (
    <div className="card flex items-center gap-3 p-3">
      <Nfc
        className={`h-5 w-5 shrink-0 ${status === "ready" ? "animate-pulse text-[var(--lumina-success)]" : "text-[var(--app-text-muted)]"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {looking ? "Reading card…" : "Tap a card to open a student"}
        </p>
        {error ? (
          <p className="mt-0.5 text-xs text-[var(--lumina-error)]">{error}</p>
        ) : (
          <ReaderStatus status={status} readerName={readerName} className="mt-0.5" />
        )}
      </div>
    </div>
  );
}
