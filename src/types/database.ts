export type UserRole = "parent" | "secretary" | "admin";

export type EntryType = "deposit" | "withdrawal" | "adjustment";

export type EntryStatus = "pending" | "confirmed" | "rejected";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  created_at: string;
};

export type Student = {
  id: string;
  full_name: string;
  class_name: string;
  admission_no: string;
  slug: string;
  student_code: string;
  active: boolean;
  created_at: string;
};

export type ParentStudent = {
  parent_id: string;
  student_id: string;
  created_at: string;
};

export type LedgerEntry = {
  id: string;
  student_id: string;
  entry_type: EntryType;
  amount: number;
  status: EntryStatus;
  note: string | null;
  created_by: string;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentBalance = {
  student_id: string;
  balance: number;
};

export type StudentSummary = {
  id: string;
  full_name: string;
  class_name: string;
  admission_no: string;
  slug: string;
  student_code: string;
  active: boolean;
  balance: number;
  withdrawn_today: number;
};

export type LedgerEntryWithStudent = LedgerEntry & {
  student: Pick<Student, "id" | "full_name" | "class_name" | "admission_no">;
  creator?: Pick<Profile, "id" | "full_name"> | null;
};
