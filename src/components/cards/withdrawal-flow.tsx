"use client";

import { useEffect, useState } from "react";
import { Numpad } from "./numpad";
import { BalanceHero } from "@/components/ui/money-ui";
import { useCardWedge } from "@/hooks/use-card-wedge";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import { playDeclineBeep } from "@/lib/decline-sound";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentByCard } from "@/types/database";

/** How long the success screen shows before returning to the numpad. */
const SUCCESS_RESET_MS = 4000;

type Stage ="amount" | "waiting-card" | "processing" | "success" | "error";

interface WithdrawalState {
  amount: number | null;
  student: StudentByCard | null;
  error: string | null;
  currentBalance: number | null;
  newBalance: number | null;
}

export function WithdrawalFlow() {
  const [stage, setStage] = useState<Stage>("amount");
  const [state, setState] = useState<WithdrawalState>({
    amount: null,
    student: null,
    error: null,
    currentBalance: null,
    newBalance: null,
  });

  const nfcStatus = useNfcReader({ enabled: stage === "waiting-card" });
  const hasCardPresence = nfcStatus.presenceDetection !== "unavailable";

  async function handleAmountSubmit(amount: number) {
    // amount is already in UGX (100 UGX minimum, no decimals)
    setState((s) => ({ ...s, amount }));
    setStage("waiting-card");
  }

  function resetToNumpad() {
    nfcStatus.clearTap();
    setState({ amount: null, student: null, error: null, currentBalance: null, newBalance: null });
    setStage("amount");
  }

  async function processWithdrawal(cardUid: string) {
    setStage("processing");
    // Forget this tap so it can't re-trigger on the next transaction.
    nfcStatus.clearTap();

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("find_student_by_card", {
        p_card_uid: cardUid,
      });

      if (error) {
        setState((s) => ({
          ...s,
          error: error.message,
        }));
        setStage("error");
        return;
      }

      const student = (data as StudentByCard[] | null)?.[0];
      if (!student) {
        setState((s) => ({
          ...s,
          error: "Card is not assigned to any student",
        }));
        setStage("error");
        return;
      }

      if (!state.amount) {
        setState((s) => ({
          ...s,
          error: "No amount entered",
        }));
        setStage("error");
        return;
      }

      // Process the withdrawal
      const { data: result, error: withdrawError } = await supabase.rpc(
        "withdraw_via_card",
        {
          p_card_uid: cardUid,
          p_amount: state.amount,
          p_note: "Card withdrawal",
        }
      );

      if (withdrawError) {
        setState((s) => ({
          ...s,
          error: withdrawError.message,
        }));
        setStage("error");
        return;
      }

      const resultData = result as {
        success: boolean;
        error?: string;
        new_balance?: number;
        previous_balance?: number;
        student_id?: string;
      };

      if (!resultData.success) {
        // On error, still show the balance for context
        setState((s) => ({
          ...s,
          error: resultData.error || "Withdrawal failed",
          student,
          currentBalance: student.balance,
        }));
        setStage("error");
        return;
      }

      setState((s) => ({
        ...s,
        student,
        error: null,
        currentBalance: resultData.previous_balance || student.balance,
        newBalance: resultData.new_balance || null,
      }));
      setStage("success");
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
      setStage("error");
    }
  }

  useEffect(() => {
    if (stage === "error") playDeclineBeep();
  }, [stage]);

  // After a successful withdrawal, return to the numpad for the next one.
  useEffect(() => {
    if (stage !== "success") return;
    const timer = setTimeout(resetToNumpad, SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Handle NFC tap
  if (stage === "waiting-card" && nfcStatus.lastTap) {
    void processWithdrawal(nfcStatus.lastTap.uid);
  }

  // Handle card wedge (keyboard input)
  useCardWedge((cardUid) => {
    if (stage === "waiting-card") {
      void processWithdrawal(cardUid);
    }
  });

  return (
    <div className="space-y-6">
      {stage === "amount" && (
        <>
          <div className="text-center">
            <h2 className="page-title">Student Withdrawal</h2>
            <p className="page-subtitle mt-2">Enter amount and tap card</p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <Numpad onAmount={handleAmountSubmit} />
          </div>
        </>
      )}

      {stage === "waiting-card" && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
            <div className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Waiting for card...
            </div>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-4">
              UGX {state.amount || 0}
            </div>
            {hasCardPresence ? (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Tap the student&apos;s card on the reader
              </p>
            ) : (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Type or tap the card number
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <div className="animate-pulse text-2xl">●</div>
            </div>
          </div>

          <button
            onClick={() => {
              setStage("amount");
              setState((s) => ({ ...s, error: null }));
            }}
            className="btn-secondary w-full"
          >
            Cancel
          </button>
        </div>
      )}

      {stage === "processing" && (
        <div className="text-center space-y-4">
          <div className="animate-spin inline-block">
            <div className="w-8 h-8 border-4 border-[var(--app-text-muted)] border-t-[var(--app-text-primary)] rounded-full" />
          </div>
          <p className="text-[var(--app-text-muted)]">Processing withdrawal...</p>
        </div>
      )}

      {stage === "success" && state.student && state.amount && (
        <div className="mx-auto w-full max-w-md space-y-3">
          <BalanceHero
            tone="success"
            label="Withdrawal successful"
            amount={state.amount}
            name={state.student.full_name}
            meta={state.student.class_name}
            subtitle="Amount debited"
          />
          <div
            className="reset-progress"
            role="progressbar"
            aria-label="Returning to the numpad"
          >
            <div
              className="reset-progress-fill"
              style={{ animationDuration: `${SUCCESS_RESET_MS}ms` }}
            />
          </div>
          <p className="text-center text-xs text-[var(--app-text-muted)]">
            Returning to the numpad...
          </p>
          <button onClick={resetToNumpad} className="btn-secondary w-full">
            New withdrawal now
          </button>
        </div>
      )}

      {stage === "error" && (
        <div className="mx-auto w-full max-w-md space-y-4">
          <BalanceHero
            tone="danger"
            label="Withdrawal declined"
            amount={state.amount ?? 0}
            name={state.student?.full_name}
            meta={state.student?.class_name}
            subtitle={
              (state.error ?? "Withdrawal failed") +
              (state.currentBalance !== null
                ? ` · Balance UGX ${state.currentBalance.toLocaleString()}`
                : "")
            }
          />

          <button
            onClick={() => {
              setStage("amount");
              setState((s) => ({ ...s, error: null, amount: null, student: null, currentBalance: null }));
            }}
            className="btn-primary w-full"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
