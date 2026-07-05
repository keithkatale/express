"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ListCard, TransactionRow } from "@/components/ui/money-ui";
import { PageStack } from "@/components/layout/page-container";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntryWithStudent } from "@/types/database";
import { format } from "date-fns";

export default function ParentActivityPage() {
  const [entries, setEntries] = useState<LedgerEntryWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: links } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", user.id);

    if (!links?.length) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("ledger_entries")
      .select("*, student:students(id, full_name, class_name, admission_no)")
      .in(
        "student_id",
        links.map((l) => l.student_id)
      )
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
    <PageStack>
      <div>
        <h1 className="page-title">Activity</h1>
        <p className="page-subtitle mt-1">All transactions for your students</p>
      </div>

      {loading ? (
        <div className="shimmer card h-16 rounded-lg md:h-24" />
      ) : entries.length === 0 ? (
        <EmptyState title="No activity yet" description="Deposits and withdrawals will appear here." />
      ) : (
        <ListCard>
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
        </ListCard>
      )}
    </PageStack>
  );
}
