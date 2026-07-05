"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/money-ui";
import { SuccessScreen } from "@/components/ui/success-screen";
import { PageStack } from "@/components/layout/page-container";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { formatUgx } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntryWithStudent } from "@/types/database";
import { format } from "date-fns";

export default function SecretaryPendingPage() {
  const [entries, setEntries] = useState<LedgerEntryWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{
    type: "confirm" | "reject";
    entry: LedgerEntryWithStudent;
  } | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("ledger_entries")
      .select("*, student:students(id, full_name, class_name, admission_no)")
      .eq("entry_type", "deposit")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    setEntries((data ?? []) as LedgerEntryWithStudent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  async function handleAction(entryId: string, action: "confirm" | "reject") {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    setActionId(entryId);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("ledger_entries")
      .update({
        status: action === "confirm" ? "confirmed" : "rejected",
        confirmed_by: user.id,
      })
      .eq("id", entryId)
      .eq("status", "pending");

    setActionId(null);
    setActionSuccess({ type: action, entry });
    void refresh();
  }

  if (actionSuccess) {
    const { type, entry } = actionSuccess;
    const confirmed = type === "confirm";

    return (
      <PageStack className="content-compact">
        <SuccessScreen
          title={confirmed ? "Deposit approved" : "Deposit rejected"}
          subtitle={
            confirmed
              ? `${formatUgx(entry.amount)} credited to ${entry.student.full_name}.`
              : `${entry.student.full_name}'s deposit was not credited.`
          }
          detail={formatUgx(entry.amount)}
          variant={confirmed ? "success" : "rejected"}
          primaryAction={
            <button type="button" className="btn-primary w-full" onClick={() => setActionSuccess(null)}>
              Back to queue
            </button>
          }
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <div>
        <h1 className="page-title">Pending deposits</h1>
        <p className="page-subtitle mt-1">
          Confirm parent deposits before they credit student balances
        </p>
      </div>

      {loading ? (
        <div className="shimmer card h-20 rounded-lg md:h-24" />
      ) : entries.length === 0 ? (
        <EmptyState title="All caught up" description="No pending deposits to review." />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-3 md:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{entry.student.full_name}</p>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {entry.student.class_name} · {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{entry.note}</p>
                  ) : null}
                </div>
                <p className="font-display text-xl">{formatUgx(entry.amount)}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={actionId === entry.id}
                  onClick={() => void handleAction(entry.id, "confirm")}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  disabled={actionId === entry.id}
                  onClick={() => void handleAction(entry.id, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageStack>
  );
}
