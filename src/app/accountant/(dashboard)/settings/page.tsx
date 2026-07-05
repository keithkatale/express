"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function SecretarySettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [parentEmail, setParentEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data as Profile);

      const { data: studentList } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");

      if (studentList) {
        setStudents(studentList);
        if (studentList.length && !studentId) setStudentId(studentList[0].id);
      }
    }
    void load();
  }, [studentId]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function linkParent(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const res = await fetch("/api/admin/link-parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentEmail, studentId }),
    });

    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Failed to link parent");
      return;
    }

    setMessage(`Linked ${parentEmail} to student`);
    setParentEmail("");
  }

  const isStaff = profile?.role === "secretary" || profile?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
      </div>

      <div className="card space-y-4 p-4">
        <div>
          <p className="text-sm text-[var(--app-text-muted)]">Name</p>
          <p className="font-medium">{profile?.full_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-[var(--app-text-muted)]">Role</p>
          <p className="font-medium capitalize">{profile?.role ?? "—"}</p>
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-3 text-sm font-medium">Theme</p>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn-secondary flex-1 px-3 py-2 text-sm ${theme === t ? "ring-2 ring-[var(--lumina-primary)]" : ""}`}
              onClick={() => setTheme(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isStaff ? (
        <>
          <div className="card space-y-3 p-4">
            <h2 className="section-title">Student profiles</h2>
            <p className="text-sm text-[var(--app-text-secondary)]">
              Create profiles without a parent. Parents link them during signup.
            </p>
            <Link href="/accountant/students/new" className="btn-primary block w-full text-center">
              Add student profile
            </Link>
          </div>

          <form onSubmit={linkParent} className="card space-y-4 p-4">
            <h2 className="section-title">Link parent to student</h2>
            <input
              className="input-ios"
              type="email"
              placeholder="Parent email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              required
            />
            <select
              className="input-ios"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary w-full">
              Link parent
            </button>
          </form>
        </>
      ) : null}

      {message ? <p className="text-sm text-[var(--lumina-success)]">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

      <button type="button" className="btn-secondary w-full" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
