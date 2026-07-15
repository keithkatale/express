"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BalanceHero, EmptyState } from "@/components/ui/money-ui";
import { MoneyAmountField } from "@/components/ui/money-numpad";
import { SuccessScreen } from "@/components/ui/success-screen";
import { LoadingButtonLabel } from "@/components/ui/loading-button";
import { PageStack } from "@/components/layout/page-container";
import { formatUgx, parseUgxInput } from "@/lib/format-money";
import { formatStudentMeta } from "@/lib/student-meta";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentSummary } from "@/types/database";

type Step = "student" | "amount" | "note" | "review" | "confirm";
type StepDirection = "forward" | "back";

const STEP_ORDER: Step[] = ["student", "amount", "note", "review", "confirm"];

const STEP_META: Record<Step, { title: string; subtitle?: string }> = {
  student: {
    title: "Who are you sending to?",
    subtitle: "Choose the student receiving this deposit",
  },
  amount: {
    title: "How much?",
  },
  note: {
    title: "Add a note",
    subtitle: "Optional — e.g. weekly allowance or term fees",
  },
  review: {
    title: "Review",
    subtitle: "Check where your money is going",
  },
  confirm: {
    title: "Confirm & send",
    subtitle: "Last step — notify the school of this deposit",
  },
};

function StepProgress({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step);

  return (
    <div className="send-step-progress" aria-label={`Step ${index + 1} of ${STEP_ORDER.length}`}>
      {STEP_ORDER.map((s, i) => (
        <span
          key={s}
          className={
            i < index ? "send-step-dot send-step-dot--done" : i === index ? "send-step-dot send-step-dot--active" : "send-step-dot"
          }
        />
      ))}
      <span className="send-step-label">
        Step {index + 1} of {STEP_ORDER.length}
      </span>
    </div>
  );
}

function StepShell({
  step,
  direction,
  title,
  subtitle,
  onBack,
  children,
}: {
  step: Step;
  direction: StepDirection;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <PageStack className="send-flow content-compact">
      <StepProgress step={step} />
      {onBack ? (
        <button type="button" className="text-sm text-[var(--app-text-muted)]" onClick={onBack}>
          ← Back
        </button>
      ) : null}
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle mt-1">{subtitle}</p> : null}
      </div>
      <div
        key={step}
        className={cn(
          "send-step-animate space-y-6",
          direction === "back" && "send-step-animate--back"
        )}
      >
        {children}
      </div>
    </PageStack>
  );
}

export default function SendMoneyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("student");

  const [step, setStep] = useState<Step>("student");
  const [direction, setDirection] = useState<StepDirection>("forward");
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

  function goBack() {
    setError(null);
    setDirection("back");
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) setStep(STEP_ORDER[index - 1]);
  }

  function goNext() {
    setError(null);
    setDirection("forward");
    const index = STEP_ORDER.indexOf(step);
    if (index < STEP_ORDER.length - 1) setStep(STEP_ORDER[index + 1]);
  }

  async function handleSend() {
    if (!studentId || !amount || !selected) {
      setError("Missing student or amount.");
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
      note: note.trim() || null,
      created_by: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setDirection("forward");
    setSuccess(true);
    setLoading(false);
  }

  if (success && selected && amount) {
    return (
      <PageStack className="content-compact send-flow">
        <SuccessScreen
          title="Deposit sent!"
          subtitle={`${selected.full_name} — the school has been notified`}
          detail={formatUgx(amount)}
          primaryAction={
            <button type="button" className="btn-primary w-full" onClick={() => router.push("/app")}>
              Back to home
            </button>
          }
          secondaryAction={
            <button type="button" className="btn-secondary w-full" onClick={() => router.push("/app/activity")}>
              View activity
            </button>
          }
        />
      </PageStack>
    );
  }

  if (!students.length) {
    return (
      <div className="content-compact">
        <EmptyState
          title="No students linked"
          description="Ask the school to link your children before sending money."
        />
      </div>
    );
  }

  const meta = STEP_META[step];
  const subtitle =
    step === "amount" && selected ? `Sending to ${selected.full_name}` : meta.subtitle;

  function renderStep() {
    switch (step) {
      case "student":
        return (
          <>
            <div className="space-y-2">
              {students.map((student) => {
                const active = student.id === studentId;
                return (
                  <button
                    key={student.id}
                    type="button"
                    className={`card w-full p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                      active ? "ring-2 ring-[var(--lumina-primary)]" : ""
                    }`}
                    onClick={() => setStudentId(student.id)}
                  >
                    <p className="font-semibold">{student.full_name}</p>
                    <p className="text-sm text-[var(--app-text-muted)]">
                      {formatStudentMeta({
                        className: student.class_name,
                        studentCode: student.student_code,
                        slug: student.slug,
                        admissionNo: student.admission_no,
                      })}
                    </p>
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                      Balance: {formatUgx(student.balance)}
                    </p>
                  </button>
                );
              })}
            </div>
            {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!studentId}
              onClick={() => {
                if (!studentId) {
                  setError("Select a student to continue.");
                  return;
                }
                goNext();
              }}
            >
              Continue
            </button>
          </>
        );

      case "amount":
        return (
          <>
            <MoneyAmountField
              label="Amount (UGX)"
              placeholder="Tap amount below"
              value={amountInput}
              onChange={setAmountInput}
            />
            {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                if (!amount) {
                  setError("Enter a valid amount to continue.");
                  return;
                }
                goNext();
              }}
            >
              Continue
            </button>
          </>
        );

      case "note":
        return (
          <>
            <div>
              <label htmlFor="send-note" className="mb-2 block text-sm font-medium">
                Note (optional)
              </label>
              <input
                id="send-note"
                className="input-ios"
                placeholder="e.g. Weekly allowance"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-3">
              <button type="button" className="btn-primary w-full" onClick={goNext}>
                Continue
              </button>
              <button type="button" className="btn-secondary w-full" onClick={goNext}>
                Skip
              </button>
            </div>
          </>
        );

      case "review":
        if (!selected || !amount) return null;
        return (
          <>
            <div className="card space-y-4 p-4 md:p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Recipient</p>
                <p className="font-display text-xl font-semibold">{selected.full_name}</p>
                <p className="text-sm text-[var(--app-text-muted)]">
                  {formatStudentMeta({
                    className: selected.class_name,
                    studentCode: selected.student_code,
                    slug: selected.slug,
                    admissionNo: selected.admission_no,
                  })}
                </p>
              </div>
              <div className="border-t border-[var(--app-divider)] pt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Amount</p>
                <p className="font-display text-2xl font-semibold">{formatUgx(amount)}</p>
              </div>
              {note.trim() ? (
                <div className="border-t border-[var(--app-divider)] pt-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Note</p>
                  <p className="text-sm">{note.trim()}</p>
                </div>
              ) : null}
              <div className="border-t border-[var(--app-divider)] pt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Destination</p>
                <p className="text-sm text-[var(--app-text-secondary)]">
                  Funds go to the school. Once the bursar sees this deposit,{" "}
                  {selected.full_name}&apos;s balance will update.
                </p>
              </div>
            </div>
            <button type="button" className="btn-primary w-full" onClick={goNext}>
              Continue to confirm
            </button>
          </>
        );

      case "confirm":
        if (!selected || !amount) return null;
        return (
          <>
            <BalanceHero
              label="You are sending"
              amount={amount}
              name={selected.full_name}
              meta={selected.class_name}
            />
            <div className="card space-y-2 p-4 text-sm text-[var(--app-text-secondary)]">
              <div className="flex justify-between gap-3">
                <span>Student</span>
                <span className="text-right font-medium text-[var(--app-text-primary)]">
                  {selected.full_name}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Class</span>
                <span className="text-right font-medium text-[var(--app-text-primary)]">
                  {selected.class_name}
                </span>
              </div>
              {note.trim() ? (
                <div className="flex justify-between gap-3">
                  <span>Note</span>
                  <span className="text-right font-medium text-[var(--app-text-primary)]">
                    {note.trim()}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <span>Status after send</span>
                <span className="text-right font-medium text-[var(--app-text-primary)]">
                  School notified
                </span>
              </div>
            </div>
            {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
            <button
              type="button"
              className="btn-primary w-full"
              disabled={loading}
              aria-busy={loading}
              onClick={() => void handleSend()}
            >
              <LoadingButtonLabel loading={loading} loadingLabel="Sending">
                Confirm & send
              </LoadingButtonLabel>
            </button>
          </>
        );
    }
  }

  return (
    <StepShell
      step={step}
      direction={direction}
      title={meta.title}
      subtitle={subtitle}
      onBack={step === "student" ? undefined : goBack}
    >
      {renderStep()}
    </StepShell>
  );
}
