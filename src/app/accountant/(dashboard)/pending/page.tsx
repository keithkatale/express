"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, StatusBadge } from "@/components/ui/money-ui";
import { PageStack } from "@/components/layout/page-container";
import { useRefreshPendingDeposits } from "@/hooks/use-pending-deposits";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { acknowledgePendingDeposits } from "@/lib/ledger/service";
import { formatUgx } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EntryStatus, LedgerEntryWithStudent } from "@/types/database";
import { format } from "date-fns";

type VisibleDeposit = LedgerEntryWithStudent & { displayStatus: EntryStatus };

export default function SecretaryPendingPage() {
  const [entries, setEntries] = useState<VisibleDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgedCount, setAcknowledgedCount] = useState(0);
  const acknowledgingRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const rerunRef = useRef(false);
  const refreshBadge = useRefreshPendingDeposits();

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

    // Keep already-shown deposits on screen; only add newly pending ones.
    setEntries((prev) => {
      const byId = new Map(prev.map((entry) => [entry.id, entry]));
      for (const entry of pending) {
        if (!byId.has(entry.id)) {
          byId.set(entry.id, { ...entry, displayStatus: "pending" });
        }
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    const toAck = pending.filter((entry) => !seenIdsRef.current.has(entry.id));
    if (toAck.length > 0 && acknowledgingRef.current) {
      // A deposit arrived mid-acknowledge; run again once the current pass finishes.
      rerunRef.current = true;
    }
    if (toAck.length > 0 && !acknowledgingRef.current) {
      acknowledgingRef.current = true;
      try {
        const confirmed = await acknowledgePendingDeposits(supabase, user.id, {
          entryIds: toAck.map((e) => e.id),
        });
        if (confirmed.length > 0) {
          const confirmedIds = new Set(confirmed.map((e) => e.id));
          for (const id of confirmedIds) {
            seenIdsRef.current.add(id);
          }
          setAcknowledgedCount((n) => n + confirmed.length);
          // Keep details visible, just flip status to received.
          setEntries((prev) =>
            prev.map((entry) =>
              confirmedIds.has(entry.id)
                ? { ...entry, status: "confirmed", displayStatus: "confirmed" }
                : entry
            )
          );
        }
      } finally {
        acknowledgingRef.current = false;
        void refreshBadge();
        if (rerunRef.current) {
          rerunRef.current = false;
          void refresh();
        }
      }
    }

    setLoading(false);
  }, [refreshBadge]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  const hasVisible = entries.length > 0;

  return (
    <PageStack>
      <div>
        <h1 className="page-title">Pending deposits</h1>
        <p className="page-subtitle mt-1">
          New deposits are marked as received when you open this page. Tap a deposit to open the
          student profile.
        </p>
      </div>

      {acknowledgedCount > 0 ? (
        <div className="card border-[var(--lumina-success)]/25 bg-[color-mix(in_srgb,var(--lumina-success)_8%,transparent)] p-4 text-sm">
          <p className="font-medium text-[var(--lumina-success)]">
            {acknowledgedCount} deposit{acknowledgedCount === 1 ? "" : "s"} marked as received
          </p>
          <p className="mt-1 text-[var(--app-text-secondary)]">
            Student balances and parent accounts are updated. Keep reviewing the list below.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="shimmer card h-20 rounded-lg md:h-24" />
      ) : !hasVisible ? (
        <EmptyState
          title="All caught up"
          description="No new deposits waiting to be seen."
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/accountant/student/${entry.student_id}`}
              className="card block p-3 transition hover:bg-[var(--app-surface-2)] md:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{entry.student.full_name}</p>
                    <StatusBadge status={entry.displayStatus} />
                  </div>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {entry.student.class_name} ·{" "}
                    {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{entry.note}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)]">
                    {entry.displayStatus === "confirmed"
                      ? "Received — tap for student profile"
                      : "Recording as received…"}
                  </p>
                </div>
                <p className="shrink-0 font-display text-xl">{formatUgx(entry.amount)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageStack>
  );
}
