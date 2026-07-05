"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BalanceHero, EmptyState } from "@/components/ui/money-ui";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { formatStudentMeta } from "@/lib/student-meta";
import { formatUgx, parseUgxInput } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntry, StudentSummary } from "@/types/database";
import { format } from "date-fns";

export default function SecretaryStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    const supabase = createSupabaseBrowserClient();

    const [{ data: summary }, { data: ledger }] = await Promise.all([
      supabase.from("student_summary").select("*").eq("id", studentId).single(),
      supabase
        .from("ledger_entries")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (summary) setStudent(summary as StudentSummary);
    setEntries((ledger ?? []) as LedgerEntry[]);
  }, [studentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !student) return;

    const amount = parseUgxInput(amountInput);
    if (!amount) {
      setError("Enter a valid amount.");
      return;
    }
    if (amount > student.balance) {
      setError("Amount exceeds available balance.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from("ledger_entries").insert({
      student_id: studentId,
      entry_type: "withdrawal",
      amount,
      status: "confirmed",
      note: note || null,
      created_by: user.id,
      confirmed_by: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setAmountInput("");
    setNote("");
    setLoading(false);
    void refresh();
  }

  if (!student) {
    return <div className="shimmer card h-40 rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <Link href="/accountant/students" className="text-sm text-[var(--app-text-muted)]">
        ← Students
      </Link>

      <div>
        <h1 className="font-display text-3xl font-semibold">{student.full_name}</h1>
        <p className="text-sm text-[var(--app-text-muted)]">
          {formatStudentMeta({
            className: student.class_name,
            studentCode: student.student_code,
            slug: student.slug,
            admissionNo: student.admission_no,
          })}
        </p>
      </div>

      <BalanceHero
        label="Available balance"
        amount={student.balance}
        subtitle={`Withdrawn today: ${formatUgx(student.withdrawn_today)}`}
      />

      <form onSubmit={handleWithdraw} className="card space-y-4 p-4">
        <h2 className="section-title">Record withdrawal</h2>
        <input
          className="input-ios"
          inputMode="numeric"
          placeholder="Amount (UGX)"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          required
        />
        <input
          className="input-ios"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Recording..." : "Record withdrawal"}
        </button>
      </form>

      <div>
        <h2 className="section-title mb-3">Recent activity</h2>
        {entries.length === 0 ? (
          <EmptyState title="No transactions" description="Activity will show here." />
        ) : (
          <div className="card divide-y divide-[var(--app-divider)] px-4">
            {entries.map((entry) => (
              <div key={entry.id} className="py-3 text-sm">
                <div className="flex justify-between">
                  <span className="capitalize">{entry.entry_type}</span>
                  <span className="font-medium">
                    {entry.entry_type === "withdrawal" ? "-" : "+"}
                    {formatUgx(entry.amount)}
                  </span>
                </div>
                <p className="text-[var(--app-text-muted)]">
                  {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")} · {entry.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
