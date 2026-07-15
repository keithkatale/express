"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/money-ui";
import { PageStack } from "@/components/layout/page-container";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { acknowledgePendingDeposits } from "@/lib/ledger/service";
import { formatUgx } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntryWithStudent } from "@/types/database";
import { format } from "date-fns";

export default function SecretaryPendingPage() {
  const [entries, setEntries] = useState<LedgerEntryWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgedCount, setAcknowledgedCount] = useState(0);
  const acknowledgingRef = useRef(false);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("ledger_entries")
      .select("*, student:students(id, full_name, class_name, admission_no)")
      .eq("entry_type", "deposit")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const pending = (data ?? []) as LedgerEntryWithStudent[];
    setEntries(pending);

    if (pending.length > 0 && !acknowledgingRef.current) {
      acknowledgingRef.current = true;
      try {
        const confirmed = await acknowledgePendingDeposits(supabase, user.id, {
          entryIds: pending.map((e) => e.id),
        });
        if (confirmed.length > 0) {
          setAcknowledgedCount((n) => n + confirmed.length);
        }
        const { data: remaining } = await supabase
          .from("ledger_entries")
          .select("*, student:students(id, full_name, class_name, admission_no)")
          .eq("entry_type", "deposit")
          .eq("status", "pending")
          .order("created_at", { ascending: true });
        setEntries((remaining ?? []) as LedgerEntryWithStudent[]);
      } finally {
        acknowledgingRef.current = false;
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  return (
    <PageStack>
      <div>
        <h1 className="page-title">Pending deposits</h1>
        <p className="page-subtitle mt-1">
          Opening this page marks new deposits as received and credits student balances
        </p>
      </div>

      {acknowledgedCount > 0 ? (
        <div className="card border-[var(--lumina-success)]/25 bg-[color-mix(in_srgb,var(--lumina-success)_8%,transparent)] p-4 text-sm">
          <p className="font-medium text-[var(--lumina-success)]">
            {acknowledgedCount} deposit{acknowledgedCount === 1 ? "" : "s"} marked as received
          </p>
          <p className="mt-1 text-[var(--app-text-secondary)]">
            Parent accounts update automatically once you&apos;ve seen the notification.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="shimmer card h-20 rounded-lg md:h-24" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="All caught up"
          description="No new deposits waiting to be seen."
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-3 md:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{entry.student.full_name}</p>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {entry.student.class_name} ·{" "}
                    {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{entry.note}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)]">
                    Recording as received…
                  </p>
                </div>
                <p className="font-display text-xl">{formatUgx(entry.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageStack>
  );
}
