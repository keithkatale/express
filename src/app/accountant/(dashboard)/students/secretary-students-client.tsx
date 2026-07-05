"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { EmptyState, StudentCard } from "@/components/ui/money-ui";
import { formatUgx } from "@/lib/format-money";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentSummary } from "@/types/database";

export function SecretaryStudentsClient({
  initialStudents,
}: {
  initialStudents: StudentSummary[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");

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

  const filtered = students.filter((s) => s.balance > 0 || !search);

  return (
    <>
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
        <div className="grid gap-2 md:grid-cols-2 md:gap-3">
          {filtered.map((student) => (
            <Link key={student.id} href={`/accountant/student/${student.id}`}>
              <StudentCard
                name={student.full_name}
                className={student.class_name}
                balance={student.balance}
                studentCode={student.student_code}
                slug={student.slug}
                admissionNo={student.admission_no}
                action={
                  student.withdrawn_today > 0 ? (
                    <p className="text-right text-xs text-[var(--app-text-muted)]">
                      Today: {formatUgx(student.withdrawn_today)}
                    </p>
                  ) : null
                }
              />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
