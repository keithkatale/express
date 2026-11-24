"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Numpad } from "./numpad";
import { useCardWedge } from "@/hooks/use-card-wedge";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentByCard } from "@/types/database";

type Stage = "amount" | "waiting-card" | "processing" | "success" | "error";

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
  const router = useRouter();

  const nfcStatus = useNfcReader({ enabled: stage === "waiting-card" });
  const hasCardPresence = nfcStatus.presenceDetection !== "unavailable";

  async function handleAmountSubmit(amount: number) {
    // amount is already in UGX (100 UGX minimum, no decimals)
    setState((s) => ({ ...s, amount }));
    setStage("waiting-card");
  }

  async function processWithdrawal(cardUid: string) {
    setStage("processing");

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

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        router.push("/accountant/payments");
      }, 3000);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
      setStage("error");
    }
  }

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
          <Numpad onAmount={handleAmountSubmit} />
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
                Tap the student's card on the reader
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
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6 space-y-4">
          <div className="text-center">
            <div className="text-2xl mb-2">✓</div>
            <div className="text-sm text-green-700 dark:text-green-300 mb-1">Withdrawal successful</div>
            <div className="text-xl font-semibold text-green-900 dark:text-green-100">
              {state.student.full_name}
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">
              {state.student.class_name}
            </div>
          </div>

          <div className="border-t border-green-200 dark:border-green-800 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-green-700 dark:text-green-300 mb-1">
                  Balance Before
                </div>
                <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                  UGX {state.currentBalance || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-700 dark:text-green-300 mb-1">
                  Amount Withdrawn
                </div>
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  -UGX {state.amount}
                </div>
              </div>
            </div>

            <div className="bg-green-100 dark:bg-green-900 p-3 rounded">
              <div className="text-xs text-green-700 dark:text-green-300 mb-1">
                Remaining Balance
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-200">
                UGX {state.newBalance || 0}
              </div>
            </div>
          </div>

          <p className="text-xs text-green-700 dark:text-green-300 text-center">Redirecting...</p>
        </div>
      )}

      {stage === "error" && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6 space-y-4">
            {state.student && (
              <div>
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                  {state.student.full_name}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  {state.student.class_name}
                </div>
              </div>
            )}

            {state.currentBalance !== null && state.amount && (
              <div className="border-t border-red-200 dark:border-red-800 pt-4 space-y-3">
                <div>
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                    Current Balance
                  </div>
                  <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                    UGX {state.currentBalance}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                    Requested Amount
                  </div>
                  <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                    UGX {state.amount}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-red-900 p-2 rounded text-sm text-red-800 dark:text-red-200">
                  Shortfall: UGX {(state.amount - state.currentBalance).toLocaleString()}
                </div>
              </div>
            )}

            {state.error && (
              <div className="text-center pt-2">
                <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setStage("amount");
              setState((s) => ({ ...s, error: null, amount: null }));
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
