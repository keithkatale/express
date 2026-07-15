"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BalanceHero, EmptyState, TransactionRow } from "@/components/ui/money-ui";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { formatStudentMeta } from "@/lib/student-meta";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntry, StudentSummary } from "@/types/database";
import { format } from "date-fns";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    const [{ data: summary }, { data: ledger }] = await Promise.all([
      supabase.from("student_summary").select("*").eq("id", studentId).single(),
      supabase
        .from("ledger_entries")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (summary) setStudent(summary as StudentSummary);
    setEntries((ledger ?? []) as LedgerEntry[]);
  }, [studentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  if (!student) {
    return <div className="shimmer card h-40 rounded-lg" />;
  }

  return (
    <div className="content-profile space-y-6">
      <Link href="/app" className="text-sm text-[var(--app-text-muted)]">
        ← Back
      </Link>

      <BalanceHero
        label="Available balance"
        amount={student.balance}
        name={student.full_name}
        meta={formatStudentMeta({
          className: student.class_name,
          studentCode: student.student_code,
          slug: student.slug,
          admissionNo: student.admission_no,
        })}
      />

      <Link href={`/app/send?student=${student.id}`} className="btn-primary block w-full text-center">
        Send money
      </Link>

      <div>
        <h2 className="section-title mb-3">Activity</h2>
        {entries.length === 0 ? (
          <EmptyState title="No transactions" description="Activity will show here." />
        ) : (
          <div className="card px-4">
            {entries.map((entry) => (
              <TransactionRow
                key={entry.id}
                title={entry.entry_type}
                subtitle={format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
                amount={entry.amount}
                entryType={entry.entry_type}
                status={entry.status}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
