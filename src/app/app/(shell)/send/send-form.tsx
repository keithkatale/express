"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BalanceHero, EmptyState } from "@/components/ui/money-ui";
import { PageStack } from "@/components/layout/page-container";
import { formatUgx, parseUgxInput } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentSummary } from "@/types/database";

export default function SendMoneyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("student");

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentId, setStudentId] = useState(preselected ?? "");
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadStudents = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: links } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", user.id);

    if (!links?.length) return;

    const { data } = await supabase
      .from("student_summary")
      .select("*")
      .in(
        "id",
        links.map((l) => l.student_id)
      )
      .order("full_name");

    if (data) {
      setStudents(data as StudentSummary[]);
      if (!studentId && data.length === 1) setStudentId(data[0].id);
    }
  }, [studentId]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (preselected) setStudentId(preselected);
  }, [preselected]);

  const selected = students.find((s) => s.id === studentId);
  const amount = parseUgxInput(amountInput);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !amount) {
      setError("Select a student and enter a valid amount.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("ledger_entries").insert({
      student_id: studentId,
      entry_type: "deposit",
      amount,
      status: "pending",
      note: note || null,
      created_by: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success && selected && amount) {
    return (
      <PageStack>
        <BalanceHero
          label="Deposit sent"
          amount={amount}
          subtitle={`For ${selected.full_name} — awaiting bursar confirmation`}
        />
        <p className="text-center text-sm text-[var(--app-text-secondary)]">
          The school secretary will confirm your deposit. Your balance updates once confirmed.
        </p>
        <button type="button" className="btn-primary w-full" onClick={() => router.push("/app")}>
          Back to home
        </button>
      </PageStack>
    );
  }

  if (!students.length) {
    return (
      <EmptyState
        title="No students linked"
        description="Ask the school to link your children before sending money."
      />
    );
  }

  return (
    <PageStack>
      <div>
        <h1 className="page-title">Send money</h1>
        <p className="page-subtitle mt-1">Funds go to the bursar for confirmation</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Student</label>
          <select
            className="input-ios"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} — {s.class_name} ({formatUgx(s.balance)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Amount (UGX)</label>
          <input
            className="input-ios"
            inputMode="numeric"
            placeholder="e.g. 50000"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Note (optional)</label>
          <input
            className="input-ios"
            placeholder="e.g. Weekly allowance"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Sending..." : "Send to bursar"}
        </button>
      </form>
    </PageStack>
  );
}
