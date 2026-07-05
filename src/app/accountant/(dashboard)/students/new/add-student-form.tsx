"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClassStreamPicker } from "@/components/students/class-stream-picker";
import { PageStack } from "@/components/layout/page-container";
import { formatStudentMeta } from "@/lib/student-meta";
import {
  classNameFromSelection,
  type SeniorLevel,
} from "@/lib/school-classes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AddStudentForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState<SeniorLevel | null>(null);
  const [stream, setStream] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{
    full_name: string;
    class_name: string;
    student_code: string;
    slug: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();

    if (name.length < 2) {
      setError("Enter the student's full name.");
      return;
    }

    const className = classNameFromSelection(level, stream);
    if (!className) {
      setError("Select a senior class and stream.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc("register_student_for_staff", {
      p_full_name: name,
      p_class_name: className,
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const student = data?.[0];
    if (!student) {
      setError("Could not create student profile.");
      setLoading(false);
      return;
    }

    setCreated(student);
    setLoading(false);
  }

  if (created) {
    return (
      <PageStack>
        <div>
          <h1 className="page-title">Student created</h1>
          <p className="page-subtitle mt-1">
            Profile saved without a parent link. A parent can find and link this student during signup.
          </p>
        </div>

        <div className="card space-y-3 p-4 md:p-5">
          <p className="font-display text-2xl font-semibold">{created.full_name}</p>
          <p className="text-sm text-[var(--app-text-muted)]">
            {formatStudentMeta({
              className: created.class_name,
              studentCode: created.student_code,
              slug: created.slug,
            })}
          </p>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Student ID</p>
            <p className="font-display text-3xl font-semibold tracking-widest">{created.student_code}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button type="button" className="btn-primary w-full" onClick={() => router.push("/accountant/students")}>
            Back to students
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              setCreated(null);
              setFullName("");
              setLevel(null);
              setStream(null);
            }}
          >
            Add another student
          </button>
        </div>
      </PageStack>
    );
  }

  return (
    <PageStack>
      <Link href="/accountant/students" className="text-sm text-[var(--app-text-muted)]">
        ← Students
      </Link>

      <div>
        <h1 className="page-title">Add student</h1>
        <p className="page-subtitle mt-1">
          Create a school profile with no parent attached. Parents can link it later when they sign up.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label htmlFor="staff-student-name" className="mb-2 block text-sm font-medium">
            Full name
          </label>
          <input
            id="staff-student-name"
            className="input-ios"
            placeholder="e.g. Joel Nakato"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <ClassStreamPicker
          level={level}
          stream={stream}
          onLevelChange={(next) => {
            setLevel(next);
            setStream(null);
          }}
          onStreamChange={setStream}
        />

        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create student profile"}
        </button>
      </form>
    </PageStack>
  );
}
