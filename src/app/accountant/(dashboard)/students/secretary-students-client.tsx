"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardTapLookup } from "@/components/cards/card-tap-lookup";
import { EmptyState, StudentCard } from "@/components/ui/money-ui";
import { formatUgx } from "@/lib/format-money";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { usePendingDeposits } from "@/hooks/use-pending-deposits";
import { useCardWedge } from "@/hooks/use-card-wedge";
import { looksLikeTypedCardNumber } from "@/lib/cards/nfc-bridge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentByCard, StudentSummary } from "@/types/database";

export function SecretaryStudentsClient({
  initialStudents,
}: {
  initialStudents: StudentSummary[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const pending = usePendingDeposits();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [cardMessage, setCardMessage] = useState<string | null>(null);

  // At a desk with a mouse (where the USB reader lives), keep the search box
  // focused so a tapped card's number lands here. Skipped on touch screens,
  // where focusing would pop the on-screen keyboard on every visit.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("student_summary")
      .select("*")
      .eq("active", true)
      .order("full_name");

    if (search.trim()) {
      query = query.or(
        `full_name.ilike.%${search.trim()}%,admission_no.ilike.%${search.trim()}%,class_name.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%,slug.ilike.%${search.trim()}%`
      );
    }

    const { data } = await query;
    if (data) setStudents(data as StudentSummary[]);
  }, [search]);

  useLedgerRealtime(refresh);

  /** Open the student holding this card, or explain that nobody does. */
  async function openCard(value: string) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("find_student_by_card", { p_card_uid: value });
    if (error) {
      setCardMessage(error.message);
      return;
    }
    const match = (data as StudentByCard[] | null)?.[0];
    if (match) {
      router.push(`/accountant/student/${match.id}`);
      return;
    }
    setSearch("");
    setCardMessage(`Card ${value} is not assigned to anyone yet. Open a student and assign it.`);
  }

  /** Enter in the search box: a tapped card opens its student; text searches. */
  function handleEnter() {
    const value = search.trim();
    if (looksLikeTypedCardNumber(value)) {
      void openCard(value);
      return;
    }
    setCardMessage(null);
    void refresh();
  }

  // A tap while focus is elsewhere on the page (not in the search box).
  useCardWedge((value) => void openCard(value));

  const filtered = students;

  return (
    <>
      {pending.total > 0 ? (
        <Link href="/accountant/pending" className="pending-alert">
          <span>
            <strong>{pending.total}</strong> new deposit{pending.total === 1 ? "" : "s"} to review
          </span>
          <span className="text-sm font-semibold">Open →</span>
        </Link>
      ) : null}

      <CardTapLookup />

      <input
        ref={searchRef}
        className="input-ios"
        placeholder="Search by name, class or ID, or tap a card"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleEnter();
        }}
      />

      {cardMessage ? (
        <p className="text-sm text-amber-500">{cardMessage}</p>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title="No students found" description="Try a different search or add students." />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((student) => {
            const studentPending = pending.byStudentId[student.id] ?? 0;

            return (
              <StudentCard
                key={student.id}
                href={`/accountant/student/${student.id}`}
                name={student.full_name}
                className={student.class_name}
                balance={student.balance}
                studentCode={student.student_code}
                slug={student.slug}
                admissionNo={student.admission_no}
                pendingCount={studentPending}
                action={
                  <div className="flex flex-col items-end gap-1">
                    {studentPending > 0 ? (
                      <span className="badge badge-pending text-[10px]">
                        {studentPending} pending
                      </span>
                    ) : null}
                    {student.withdrawn_today > 0 ? (
                      <p className="text-right text-xs text-[var(--app-text-muted)]">
                        Today: {formatUgx(student.withdrawn_today)}
                      </p>
                    ) : null}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
