"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { playDepositChaChing, unlockDepositSound } from "@/lib/deposit-sound";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PendingDeposits = {
  total: number;
  byStudentId: Record<string, number>;
};

const empty: PendingDeposits = { total: 0, byStudentId: {} };

const PendingDepositsContext = createContext<PendingDeposits>(empty);

function usePendingDepositsState(enabled: boolean): PendingDeposits {
  const [pending, setPending] = useState<PendingDeposits>(empty);
  const previousTotalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      previousTotalRef.current = null;
      setPending(empty);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("ledger_entries")
      .select("student_id")
      .eq("entry_type", "deposit")
      .eq("status", "pending");

    const byStudentId: Record<string, number> = {};
    for (const row of data ?? []) {
      byStudentId[row.student_id] = (byStudentId[row.student_id] ?? 0) + 1;
    }

    const nextTotal = data?.length ?? 0;
    const previous = previousTotalRef.current;
    // Skip initial load; only chime when pending count rises while the dashboard is open.
    if (previous !== null && nextTotal > previous) {
      playDepositChaChing();
    }
    previousTotalRef.current = nextTotal;
    setPending({ total: nextTotal, byStudentId });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const unlock = () => unlockDepositSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("pending_deposits")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledger_entries" },
        () => void refresh()
      )
      .subscribe();

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  return pending;
}

export function PendingDepositsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const pending = usePendingDepositsState(enabled);

  return (
    <PendingDepositsContext.Provider value={pending}>{children}</PendingDepositsContext.Provider>
  );
}

export function usePendingDeposits(): PendingDeposits {
  return useContext(PendingDepositsContext);
}
