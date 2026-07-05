"use client";

import { useEffect, useId } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useLedgerRealtime(onChange: () => void) {
  const instanceId = useId().replace(/:/g, "");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`ledger_entries_changes_${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledger_entries" },
        () => onChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onChange, instanceId]);
}
