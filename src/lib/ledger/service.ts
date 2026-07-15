import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidClassName } from "@/lib/school-classes";
import type {
  LedgerEntry,
  LedgerEntryWithStudent,
  StudentSummary,
} from "@/types/database";

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getParentStudents(supabase: SupabaseClient, parentId: string) {
  const { data: links, error: linkError } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parentId);

  if (linkError) throw linkError;
  if (!links?.length) return [] as StudentSummary[];

  const studentIds = links.map((l) => l.student_id);
  const { data, error } = await supabase
    .from("student_summary")
    .select("*")
    .in("id", studentIds)
    .eq("active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as StudentSummary[];
}

export async function getAllStudents(supabase: SupabaseClient, search?: string) {
  let query = supabase
    .from("student_summary")
    .select("*")
    .eq("active", true)
    .order("full_name");

  if (search?.trim()) {
    query = query.or(
      `full_name.ilike.%${search.trim()}%,admission_no.ilike.%${search.trim()}%,class_name.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%,slug.ilike.%${search.trim()}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StudentSummary[];
}

export async function getStudentSummary(supabase: SupabaseClient, studentId: string) {
  const { data, error } = await supabase
    .from("student_summary")
    .select("*")
    .eq("id", studentId)
    .single();

  if (error) throw error;
  return data as StudentSummary;
}

export async function getStudentLedger(
  supabase: SupabaseClient,
  studentId: string,
  limit = 50
) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as LedgerEntry[];
}

export async function getParentActivity(supabase: SupabaseClient, parentId: string) {
  const students = await getParentStudents(supabase, parentId);
  if (!students.length) return [] as LedgerEntryWithStudent[];

  const studentIds = students.map((s) => s.id);
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*, student:students(id, full_name, class_name, admission_no)")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as LedgerEntryWithStudent[];
}

export async function getPendingDeposits(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*, student:students(id, full_name, class_name, admission_no)")
    .eq("entry_type", "deposit")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LedgerEntryWithStudent[];
}

export async function getStaffActivity(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*, student:students(id, full_name, class_name, admission_no)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as LedgerEntryWithStudent[];
}

export async function createParentDeposit(
  supabase: SupabaseClient,
  input: { studentId: string; amount: number; note?: string; createdBy: string }
) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      student_id: input.studentId,
      entry_type: "deposit",
      amount: input.amount,
      status: "pending",
      note: input.note ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LedgerEntry;
}

export async function confirmDeposit(
  supabase: SupabaseClient,
  entryId: string,
  confirmedBy: string
) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .update({ status: "confirmed", confirmed_by: confirmedBy })
    .eq("id", entryId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return data as LedgerEntry;
}

/**
 * Marks pending deposits as confirmed once staff has seen them
 * (pending page or student profile). Safe to call repeatedly.
 */
export async function acknowledgePendingDeposits(
  supabase: SupabaseClient,
  confirmedBy: string,
  options?: { entryIds?: string[]; studentId?: string }
) {
  let query = supabase
    .from("ledger_entries")
    .update({ status: "confirmed", confirmed_by: confirmedBy })
    .eq("entry_type", "deposit")
    .eq("status", "pending");

  if (options?.entryIds?.length) {
    query = query.in("id", options.entryIds);
  }
  if (options?.studentId) {
    query = query.eq("student_id", options.studentId);
  }

  const { data, error } = await query.select("id, amount, student_id");
  if (error) throw error;
  return (data ?? []) as Pick<LedgerEntry, "id" | "amount" | "student_id">[];
}

export async function rejectDeposit(
  supabase: SupabaseClient,
  entryId: string,
  confirmedBy: string
) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .update({ status: "rejected", confirmed_by: confirmedBy })
    .eq("id", entryId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return data as LedgerEntry;
}

export async function recordWithdrawal(
  supabase: SupabaseClient,
  input: { studentId: string; amount: number; note?: string; createdBy: string }
) {
  const summary = await getStudentSummary(supabase, input.studentId);
  if (input.amount > summary.balance) {
    throw new Error("Withdrawal amount exceeds available balance.");
  }

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      student_id: input.studentId,
      entry_type: "withdrawal",
      amount: input.amount,
      status: "confirmed",
      note: input.note ?? null,
      created_by: input.createdBy,
      confirmed_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LedgerEntry;
}

export async function createStudent(
  supabase: SupabaseClient,
  input: { fullName: string; className: string; admissionNo?: string }
) {
  if (!isValidClassName(input.className)) {
    throw new Error("Select a valid senior class and stream");
  }

  const [{ data: studentCode, error: codeError }, { data: slug, error: slugError }] =
    await Promise.all([
      supabase.rpc("generate_unique_student_code"),
      supabase.rpc("generate_unique_student_slug", { base_name: input.fullName }),
    ]);

  if (codeError) throw codeError;
  if (slugError) throw slugError;
  if (!studentCode || !slug) throw new Error("Could not generate student identifiers");

  const { data, error } = await supabase
    .from("students")
    .insert({
      full_name: input.fullName,
      class_name: input.className,
      admission_no: input.admissionNo ?? studentCode,
      student_code: studentCode,
      slug,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
