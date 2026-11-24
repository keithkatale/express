"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Nfc } from "lucide-react";
import { ReaderStatus } from "@/components/cards/reader-status";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import {
  formatCardUid,
  isPlausibleCardUid,
  normaliseCardUid,
} from "@/lib/cards/nfc-bridge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentCard } from "@/types/database";
import { format } from "date-fns";

type Mode = "view" | "waiting";

/**
 * Assign, show and revoke a student's cashless card.
 *
 * The card holds nothing but its factory UID; the balance stays in the ledger.
 * So "assigning" is only ever recording which UID belongs to which student,
 * and revoking is enough to kill a lost card.
 */
export function CardAssignPanel({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [card, setCard] = useState<StudentCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("view");
  const [manualCandidate, setManualCandidate] = useState<string | null>(null);
  const [manualUid, setManualUid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Only hold the reader stream open while the panel is actually waiting for
  // a tap, so idle dashboards do not keep a connection per open tab.
  const { status, lastTap, clearTap, readerName, cardPresent, cardUnreadable, presenceDetection } =
    useNfcReader({ enabled: mode === "waiting" });

  // Some readers (the T6-AU-10-03 here) never report cards over the bridge;
  // they only type the number on their keyboard interface. In that case the
  // instruction has to point at the focused field, not at a tap we will see.
  const wedgeOnly = presenceDetection === "unavailable";

  const loadCard = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("student_cards")
      .select("*")
      .eq("student_id", studentId)
      .eq("active", true)
      .maybeSingle();

    setCard((data as StudentCard | null) ?? null);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    void loadCard();
  }, [loadCard]);

  // The reader's second USB interface is a plain keyboard that types the card
  // number and presses Enter. Focusing the field means a tap lands here even
  // when the bridge is not running, so assignment never depends on it.
  useEffect(() => {
    if (mode === "waiting") manualInputRef.current?.focus();
  }, [mode]);

  // Derived, not copied into state: a tap while waiting *is* the candidate.
  // Going through an effect here would mean an extra render and a window where
  // the panel shows a stale UID.
  const candidateUid =
    manualCandidate ?? (mode === "waiting" && lastTap ? lastTap.uid : null);

  function startWaiting() {
    setError(null);
    setNotice(null);
    setManualCandidate(null);
    setManualUid("");
    clearTap();
    setMode("waiting");
  }

  function cancel() {
    setMode("view");
    setManualCandidate(null);
    setManualUid("");
    setError(null);
    clearTap();
  }

  function applyManualUid() {
    const uid = normaliseCardUid(manualUid);
    if (!isPlausibleCardUid(uid)) {
      setError("That does not look like a card number. Tap the card again, or check the digits.");
      return;
    }
    setError(null);
    setManualCandidate(uid);
  }

  async function confirmAssign() {
    if (!candidateUid) return;
    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: rpcError } = await supabase.rpc("assign_card_to_student", {
      p_student_id: studentId,
      p_card_uid: candidateUid,
    });

    setSaving(false);

    if (rpcError) {
      // The RPC raises a readable message when the card belongs to someone
      // else, which is the case staff most need to see.
      setError(rpcError.message);
      return;
    }

    setNotice(`Card assigned to ${studentName}.`);
    setManualCandidate(null);
    setMode("view");
    clearTap();
    void loadCard();
  }

  async function revoke() {
    if (!card) return;
    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: rpcError } = await supabase.rpc("revoke_student_card", {
      p_card_id: card.id,
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice("Card revoked. It can no longer be used to spend.");
    void loadCard();
  }

  if (loading) {
    return <div className="card shimmer h-28 rounded-lg" />;
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Cashless card
        </h2>
        {mode === "waiting" && (status === "ready" || status === "no-reader") ? (
          <ReaderStatus status={status} readerName={readerName} notDetecting={wedgeOnly} />
        ) : null}
      </div>

      {notice ? (
        <p className="text-sm text-[var(--lumina-success)]">{notice}</p>
      ) : null}

      {mode === "view" ? (
        card ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--app-divider)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
                Card number
              </p>
              <p className="font-display text-xl font-semibold tracking-widest">
                {formatCardUid(card.card_uid)}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                Assigned {format(new Date(card.assigned_at), "dd MMM yyyy, HH:mm")}
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button type="button" className="btn-secondary w-full" onClick={startWaiting}>
                Replace card
              </button>
              <button
                type="button"
                className="w-full text-sm text-[var(--lumina-error)]"
                onClick={() => void revoke()}
                disabled={saving}
              >
                {saving ? "Working…" : "Revoke card"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--app-text-secondary)]">
              No card yet. {studentName} cannot spend at the counter until one is assigned.
            </p>
            <button type="button" className="btn-primary w-full" onClick={startWaiting}>
              Assign card
            </button>
          </div>
        )
      ) : null}

      {mode === "waiting" && !candidateUid ? (
        <div className="space-y-4">
          <div
            className={`flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-7 text-center ${
              cardPresent
                ? "border-[var(--lumina-success)]/50 bg-[var(--lumina-success)]/5"
                : "border-[var(--app-divider)]"
            }`}
          >
            <Nfc
              className={`h-8 w-8 ${
                cardPresent
                  ? "text-[var(--lumina-success)]"
                  : "animate-pulse text-[var(--app-text-muted)]"
              }`}
            />
            <div>
              <p className="font-medium">
                {cardPresent ? "Card detected on the reader" : "Tap the card on the reader"}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {cardPresent
                  ? "Reading the card number…"
                  : "Hold it flat until the reader beeps. The card number is typed into the box below."}
              </p>
            </div>
          </div>

          {status === "ready" && wedgeOnly && !cardPresent ? (
            <p className="text-xs text-amber-500">
              The reader is connected but has not reported any card. If it does not beep
              when you tap, it is not reading the card. Type the card number below instead.
            </p>
          ) : null}

          {cardPresent && cardUnreadable ? (
            <p className="text-xs text-amber-500">
              A card is on the reader but its number could not be read. Lift it and tap
              again, or type the number below.
            </p>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="manual-card-uid" className="block text-sm font-medium">
              Card number
            </label>
            <div className="flex gap-2">
              <input
                id="manual-card-uid"
                ref={manualInputRef}
                className="input-ios flex-1"
                placeholder="Tap a card, or type its number"
                value={manualUid}
                onChange={(e) => setManualUid(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyManualUid();
                  }
                }}
                autoComplete="off"
              />
              <button type="button" className="btn-secondary px-4" onClick={applyManualUid}>
                Use
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

          <button type="button" className="w-full text-sm text-[var(--app-text-muted)]" onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : null}

      {candidateUid ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--lumina-success)]/30 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
              Card detected
            </p>
            <p className="font-display text-2xl font-semibold tracking-widest">
              {formatCardUid(candidateUid)}
            </p>
          </div>

          <p className="text-sm text-[var(--app-text-secondary)]">
            Assign this card to {studentName}?
            {card ? " Their current card will be revoked." : ""}
          </p>

          {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void confirmAssign()}
              disabled={saving}
            >
              {saving ? "Assigning…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={startWaiting}
              disabled={saving}
            >
              Tap a different card
            </button>
            <button
              type="button"
              className="w-full text-sm text-[var(--app-text-muted)]"
              onClick={cancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
