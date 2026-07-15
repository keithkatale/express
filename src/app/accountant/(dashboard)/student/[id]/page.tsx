"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BalanceHero, EmptyState } from "@/components/ui/money-ui";
import { MoneyAmountField } from "@/components/ui/money-numpad";
import { SuccessScreen } from "@/components/ui/success-screen";
import { CompactPanel } from "@/components/layout/page-container";
import { ConnectParentForm } from "@/components/students/connect-parent-form";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { acknowledgePendingDeposits } from "@/lib/ledger/service";
import { formatStudentMeta } from "@/lib/student-meta";
import { formatUgx, parseUgxInput } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntry, LedgerEntryWithStudent, StudentSummary } from "@/types/database";
import { format } from "date-fns";

export default function SecretaryStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [pendingEntries, setPendingEntries] = useState<LedgerEntryWithStudent[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [connectingParent, setConnectingParent] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState<{ amount: number } | null>(null);
  const [seenNotice, setSeenNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const acknowledgingRef = useRef(false);

  function cancelWithdraw() {
    setWithdrawing(false);
    setAmountInput("");
    setNote("");
    setError(null);
  }

  const refresh = useCallback(async () => {
    if (!studentId) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: summary }, { data: ledger }, { data: pending }] = await Promise.all([
      supabase.from("student_summary").select("*").eq("id", studentId).single(),
      supabase
        .from("ledger_entries")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("ledger_entries")
        .select("*, student:students(id, full_name, class_name, admission_no)")
        .eq("student_id", studentId)
        .eq("entry_type", "deposit")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);

    if (summary) setStudent(summary as StudentSummary);
    setEntries((ledger ?? []) as LedgerEntry[]);
    const pendingList = (pending ?? []) as LedgerEntryWithStudent[];
    setPendingEntries(pendingList);

    if (user && pendingList.length > 0 && !acknowledgingRef.current) {
      acknowledgingRef.current = true;
      try {
        const confirmed = await acknowledgePendingDeposits(supabase, user.id, {
          studentId,
          entryIds: pendingList.map((e) => e.id),
        });
        if (confirmed.length > 0) {
          setSeenNotice(
            `${confirmed.length} deposit${confirmed.length === 1 ? "" : "s"} marked as received`
          );
          const [{ data: summaryAfter }, { data: ledgerAfter }] = await Promise.all([
            supabase.from("student_summary").select("*").eq("id", studentId).single(),
            supabase
              .from("ledger_entries")
              .select("*")
              .eq("student_id", studentId)
              .order("created_at", { ascending: false })
              .limit(20),
          ]);
          if (summaryAfter) setStudent(summaryAfter as StudentSummary);
          setEntries((ledgerAfter ?? []) as LedgerEntry[]);
          setPendingEntries([]);
        }
      } finally {
        acknowledgingRef.current = false;
      }
    }
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
      setError("Enter an amount of at least UGX 1.");
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
    setWithdrawing(false);
    setWithdrawSuccess({ amount });
    setLoading(false);
    void refresh();
  }

  if (withdrawSuccess && student) {
    return (
      <CompactPanel>
        <SuccessScreen
          title="Withdrawal recorded"
          subtitle={`${student.full_name}'s balance has been updated.`}
          detail={formatUgx(withdrawSuccess.amount)}
          primaryAction={
            <button type="button" className="btn-primary w-full" onClick={() => setWithdrawSuccess(null)}>
              Done
            </button>
          }
        />
      </CompactPanel>
    );
  }

  if (!student) {
    return <div className="shimmer card h-40 rounded-lg" />;
  }

  return (
    <div className="content-profile space-y-5 md:space-y-6">
      <Link href="/accountant/students" className="text-sm text-[var(--app-text-muted)]">
        ← Students
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
        subtitle={`Withdrawn today: ${formatUgx(student.withdrawn_today)}`}
      />

      {seenNotice ? (
        <div className="card border-[var(--lumina-success)]/25 p-3 text-sm text-[var(--lumina-success)]">
          {seenNotice}
        </div>
      ) : null}

      {pendingEntries.length > 0 ? (
        <div className="card space-y-3 border-amber-400/30 p-4">
          <h2 className="section-title flex items-center gap-2">
            New deposits
            <span className="badge badge-pending">{pendingEntries.length}</span>
          </h2>
          <p className="text-sm text-[var(--app-text-secondary)]">
            These are being marked as received now that you&apos;ve opened this profile.
          </p>
          {pendingEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-[var(--app-divider)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatUgx(entry.amount)}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{entry.note}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!withdrawing && !connectingParent ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              setError(null);
              setWithdrawing(true);
            }}
          >
            Record withdrawal
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              setError(null);
              setConnectingParent(true);
            }}
          >
            Connect parent
          </button>
        </div>
      ) : null}

      {connectingParent ? (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title">Connect parent</h2>
            <button
              type="button"
              className="text-sm text-[var(--app-text-muted)]"
              onClick={() => setConnectingParent(false)}
            >
              Close
            </button>
          </div>
          <ConnectParentForm
            students={[{ id: student.id, full_name: student.full_name }]}
            defaultStudentId={student.id}
          />
        </div>
      ) : null}

      {withdrawing ? (
        <form onSubmit={handleWithdraw} className="card space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title">Record withdrawal</h2>
            <button type="button" className="text-sm text-[var(--app-text-muted)]" onClick={cancelWithdraw}>
              Cancel
            </button>
          </div>
          <MoneyAmountField
            label="Amount (UGX)"
            placeholder="0"
            value={amountInput}
            onChange={setAmountInput}
            required
            numpadOnly
            compactNumpad
          />
          <input
            className="input-ios"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-[var(--app-text-muted)]">Any amount from UGX 1 upward is allowed.</p>
          {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Recording..." : "Confirm withdrawal"}
          </button>
        </form>
      ) : null}

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
                  {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")} ·{" "}
                  {entry.status === "pending"
                    ? "Sent"
                    : entry.status === "confirmed"
                      ? "Received"
                      : "Rejected"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
