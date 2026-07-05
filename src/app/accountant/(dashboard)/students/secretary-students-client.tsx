"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { EmptyState, StudentCard } from "@/components/ui/money-ui";
import { formatUgx } from "@/lib/format-money";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { usePendingDeposits } from "@/hooks/use-pending-deposits";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentSummary } from "@/types/database";

export function SecretaryStudentsClient({
  initialStudents,
}: {
  initialStudents: StudentSummary[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const pending = usePendingDeposits();

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

  const filtered = students;

  return (
    <>
      {pending.total > 0 ? (
        <Link href="/accountant/pending" className="pending-alert">
          <span>
            <strong>{pending.total}</strong> deposit{pending.total === 1 ? "" : "s"} awaiting
            approval
          </span>
          <span className="text-sm font-semibold">Review →</span>
        </Link>
      ) : null}

      <input
        className="input-ios"
        placeholder="Search by name, class, ID, or slug"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void refresh();
        }}
      />

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
