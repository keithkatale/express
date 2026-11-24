"use client";

import { useCallback, useState } from "react";
import { useCardWedge } from "@/hooks/use-card-wedge";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentByCard, StudentSummary } from "@/types/database";

type Mode = "lookup" | "assign";

interface CardState {
  uid: string | null;
  student: StudentByCard | null;
  loading: boolean;
  error: string | null;
}

interface AssignState {
  students: StudentSummary[];
  selectedStudentId: string | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function CardTestPanel() {
  const [mode, setMode] = useState<Mode>("lookup");
  const [card, setCard] = useState<CardState>({
    uid: null,
    student: null,
    loading: false,
    error: null,
  });
  const [assign, setAssign] = useState<AssignState>({
    students: [],
    selectedStudentId: null,
    loading: false,
    error: null,
    success: false,
  });

  const nfcStatus = useNfcReader({ enabled: mode === "lookup" });

  async function lookupCard(cardUid: string) {
    setCard({ uid: cardUid, student: null, loading: true, error: null });

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("find_student_by_card", {
        p_card_uid: cardUid,
      });

      if (error) {
        setCard((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }

      const student = (data as StudentByCard[] | null)?.[0];
      if (student) {
        setCard((s) => ({ ...s, loading: false, student }));
      } else {
        setCard((s) => ({
          ...s,
          loading: false,
          error: "Card not assigned to any student",
        }));
      }
    } catch (err) {
      setCard((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }

  async function loadStudents() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("student_summary")
        .select("*")
        .eq("active", true)
        .order("full_name");

      if (error) throw error;
      setAssign((s) => ({ ...s, students: data as StudentSummary[] }));
    } catch (err) {
      setAssign((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to load students",
      }));
    }
  }

  async function assignCard() {
    if (!card.uid || !assign.selectedStudentId) return;

    setAssign((s) => ({ ...s, loading: true, error: null, success: false }));

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("assign_card_to_student", {
        p_student_id: assign.selectedStudentId,
        p_card_uid: card.uid,
      });

      if (error) {
        setAssign((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }

      setAssign((s) => ({ ...s, loading: false, success: true }));
      // Lookup the card again to show updated assignment
      await lookupCard(card.uid);
      setTimeout(() => {
        setMode("lookup");
        setAssign((s) => ({ ...s, success: false, selectedStudentId: null }));
      }, 2000);
    } catch (err) {
      setAssign((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Assignment failed",
      }));
    }
  }

  // Handle NFC tap
  if (mode === "lookup" && nfcStatus.lastTap) {
    void lookupCard(nfcStatus.lastTap.uid);
  }

  // Handle card wedge
  useCardWedge((cardUid) => {
    if (mode === "lookup") {
      void lookupCard(cardUid);
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("lookup")}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
            mode === "lookup"
              ? "bg-[var(--app-primary)] text-white"
              : "bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
          }`}
        >
          Check Card
        </button>
        <button
          onClick={() => {
            setMode("assign");
            void loadStudents();
          }}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
            mode === "assign"
              ? "bg-[var(--app-primary)] text-white"
              : "bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
          }`}
        >
          Assign Card
        </button>
      </div>

      {mode === "lookup" && (
        <div className="space-y-4">
          <div className="bg-[var(--app-bg-secondary)] rounded-lg p-4 text-center">
            <p className="text-sm text-[var(--app-text-muted)] mb-2">
              Tap a card or enter its number
            </p>
            {card.loading && (
              <div className="animate-pulse text-2xl">●</div>
            )}
            {card.uid && !card.loading && (
              <div>
                <div className="text-xs text-[var(--app-text-muted)] mb-1">
                  Card UID
                </div>
                <div className="font-mono text-sm mb-4">{card.uid}</div>
              </div>
            )}
          </div>

          {card.student && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">
                  ✓ Assigned to
                </div>
                <div className="text-lg font-semibold">{card.student.full_name}</div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  {card.student.class_name}
                </div>
              </div>
              <div className="border-t border-green-200 dark:border-green-800 pt-3">
                <div className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                  Account Balance
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  UGX {card.student.balance}
                </div>
              </div>
            </div>
          )}

          {card.error && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="text-sm text-amber-700 dark:text-amber-300">
                {card.error}
              </div>
            </div>
          )}

          {card.uid && card.error && (
            <button
              onClick={() =>
                setCard({ uid: null, student: null, loading: false, error: null })
              }
              className="btn-secondary w-full"
            >
              Check Another Card
            </button>
          )}
        </div>
      )}

      {mode === "assign" && (
        <div className="space-y-4">
          {card.uid && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                Card to assign
              </div>
              <div className="font-mono text-sm">{card.uid}</div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Student</label>
            <select
              value={assign.selectedStudentId || ""}
              onChange={(e) =>
                setAssign((s) => ({
                  ...s,
                  selectedStudentId: e.target.value || null,
                }))
              }
              className="input-ios"
            >
              <option value="">Choose a student...</option>
              {assign.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.class_name})
                </option>
              ))}
            </select>
          </div>

          {assign.error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="text-sm text-red-700 dark:text-red-300">
                {assign.error}
              </div>
            </div>
          )}

          {assign.success && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm text-green-700 dark:text-green-300">
                Card assigned successfully
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={assignCard}
              disabled={!card.uid || !assign.selectedStudentId || assign.loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assign.loading ? "Assigning..." : "Assign Card"}
            </button>
            <button
              onClick={() => {
                setCard({ uid: null, student: null, loading: false, error: null });
                setMode("lookup");
              }}
              className="btn-secondary w-full"
            >
              Tap Another Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
