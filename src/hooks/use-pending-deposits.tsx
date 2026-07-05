"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PendingDeposits = {
  total: number;
  byStudentId: Record<string, number>;
};

const empty: PendingDeposits = { total: 0, byStudentId: {} };

const PendingDepositsContext = createContext<PendingDeposits>(empty);

function usePendingDepositsState(enabled: boolean): PendingDeposits {
  const [pending, setPending] = useState<PendingDeposits>(empty);

  const refresh = useCallback(async () => {
    if (!enabled) {
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

    setPending({ total: data?.length ?? 0, byStudentId });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

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
