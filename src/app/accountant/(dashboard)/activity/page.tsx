"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, TransactionRow } from "@/components/ui/money-ui";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntryWithStudent } from "@/types/database";
import { format } from "date-fns";

export default function SecretaryActivityPage() {
  const [entries, setEntries] = useState<LedgerEntryWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("ledger_entries")
      .select("*, student:students(id, full_name, class_name, admission_no)")
      .order("created_at", { ascending: false })
      .limit(100);

    setEntries((data ?? []) as LedgerEntryWithStudent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Activity</h1>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">All school transactions</p>
      </div>

      {loading ? (
        <div className="shimmer card h-24 rounded-lg" />
      ) : entries.length === 0 ? (
        <EmptyState title="No activity" description="Transactions will appear here." />
      ) : (
        <div className="card px-4">
          {entries.map((entry) => (
            <TransactionRow
              key={entry.id}
              title={entry.student.full_name}
              subtitle={`${entry.entry_type} · ${format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}`}
              amount={entry.amount}
              entryType={entry.entry_type}
              status={entry.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
