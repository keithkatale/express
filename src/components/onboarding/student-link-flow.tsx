"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatStudentMeta } from "@/lib/student-meta";
import { rankStudentMatches, type StudentSearchResult } from "@/lib/search-students";

type Step = "has-student" | "search" | "confirm" | "add" | "created";

export function StudentLinkFlow({
  onLinked,
  onSkip,
}: {
  onLinked: () => void;
  onSkip?: () => void;
}) {
  const [step, setStep] = useState<Step>("has-student");
  const [registeredAtSchool, setRegisteredAtSchool] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [addName, setAddName] = useState("");
  const [addClass, setAddClass] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [selected, setSelected] = useState<StudentSearchResult | null>(null);
  const [created, setCreated] = useState<StudentSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<StudentSearchResult[]>([]);

  const loadStudents = useCallback(async (search: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc("search_students_for_parent", {
      search_query: search || "  ",
    });

    if (rpcError) {
      setError(rpcError.message);
      return [];
    }

    return (data ?? []) as StudentSearchResult[];
  }, []);

  useEffect(() => {
    if (step !== "search") return;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const fetched = await loadStudents(query);
      setAllStudents(fetched);
      setResults(rankStudentMatches(query, fetched));
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, step, loadStudents]);

  function startSearch(registered: boolean) {
    setRegisteredAtSchool(registered);
    setStep("search");
    setQuery("");
    setAddName("");
    setAddClass("");
    setSelected(null);
    setCreated(null);
    setResults([]);
  }

  function pickStudent(student: StudentSearchResult) {
    setSelected(student);
    setStep("confirm");
  }

  function startAdd(name?: string) {
    setAddName(name ?? query.trim());
    setAddClass("");
    setError(null);
    setStep("add");
  }

  function handleNotThisOne() {
    setSelected(null);
    setStep("search");
  }

  async function confirmLink() {
    if (!selected) return;
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

    const { error: linkError } = await supabase.from("parent_students").insert({
      parent_id: user.id,
      student_id: selected.id,
    });

    if (linkError) {
      setError(linkError.message.includes("duplicate") ? "This student is already linked to your account." : linkError.message);
      setLoading(false);
      return;
    }

    onLinked();
  }

  async function registerStudent() {
    const name = addName.trim();
    if (name.length < 2) {
      setError("Enter your child's full name.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc("register_student_for_parent", {
      p_full_name: name,
      p_class_name: addClass.trim() || "Unassigned",
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const student = data?.[0] as StudentSearchResult | undefined;
    if (!student) {
      setError("Could not add student. Please try again.");
      setLoading(false);
      return;
    }

    setCreated(student);
    setStep("created");
    setLoading(false);
  }

  if (step === "has-student") {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="page-title">Link your child</h1>
          <p className="page-subtitle mt-2">
            Is your child already registered with the school bursar?
          </p>
        </div>

        <div className="space-y-3">
          <button type="button" className="btn-primary w-full" onClick={() => startSearch(true)}>
            Yes, they are registered
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => startSearch(false)}>
            No, or I&apos;m not sure
          </button>
        </div>

        {onSkip ? (
          <button type="button" className="w-full text-sm text-[var(--app-text-muted)]" onClick={onSkip}>
            Skip for now
          </button>
        ) : null}
      </div>
    );
  }

  if (step === "created" && created) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="page-title">Student added</h1>
          <p className="page-subtitle mt-2">
            {created.full_name} is on your account. Save their ID for future reference.
          </p>
        </div>

        <div className="card space-y-3 p-4 md:p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Student ID</p>
            <p className="font-display text-3xl font-semibold tracking-widest">{created.student_code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">Slug</p>
            <p className="font-mono text-sm">{created.slug}</p>
          </div>
          <p className="text-sm text-[var(--app-text-secondary)]">
            {formatStudentMeta({
              className: created.class_name,
              studentCode: created.student_code,
              slug: created.slug,
            })}
          </p>
        </div>

        <button type="button" className="btn-primary w-full" onClick={onLinked}>
          Continue
        </button>
      </div>
    );
  }

  if (step === "add") {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <button
            type="button"
            className="text-xs text-[var(--app-text-muted)] md:text-sm"
            onClick={() => setStep("search")}
          >
            ← Back to search
          </button>
          <h1 className="page-title mt-3">Add to list</h1>
          <p className="page-subtitle mt-2">
            We&apos;ll create a student profile and give them a six-digit ID.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--app-text-muted)]">Full name</label>
            <input
              className="input-ios"
              placeholder="e.g. Joel Nakato"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--app-text-muted)]">Class (optional)</label>
            <input
              className="input-ios"
              placeholder="e.g. S.3 Blue"
              value={addClass}
              onChange={(e) => setAddClass(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

        <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => void registerStudent()}>
          {loading ? "Adding..." : "Add and link to my account"}
        </button>
      </div>
    );
  }

  if (step === "confirm" && selected) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="page-title">Confirm student</h1>
          <p className="page-subtitle mt-2">
            The person you are trying to add — is this the one?
          </p>
        </div>

        <div className="card p-4 md:p-5">
          <p className="font-display text-2xl font-semibold">{selected.full_name}</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {formatStudentMeta({
              className: selected.class_name,
              studentCode: selected.student_code,
              slug: selected.slug,
              admissionNo: selected.admission_no,
            })}
          </p>
        </div>

        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

        <div className="space-y-3">
          <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => void confirmLink()}>
            {loading ? "Linking..." : "Yes, this is my child"}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={handleNotThisOne}>
            No, not this one
          </button>
        </div>
      </div>
    );
  }

  const canAdd = query.trim().length >= 2;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <button
          type="button"
          className="text-xs text-[var(--app-text-muted)] md:text-sm"
          onClick={() => setStep("has-student")}
        >
          ← Back
        </button>
        <h1 className="page-title mt-3">
          {registeredAtSchool ? "Find your child" : "Search by name"}
        </h1>
        <p className="page-subtitle mt-2">
          {registeredAtSchool
            ? "Search the school list and pick the correct student."
            : "Type your child's name — we'll show similar matches from the school."}
        </p>
      </div>

      <input
        className="input-ios"
        placeholder="Student name, ID, or slug"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {loading ? <div className="shimmer card h-16 rounded-lg" /> : null}

      {!loading && query.trim().length < 2 ? (
        <p className="text-sm text-[var(--app-text-muted)]">Type at least 2 characters to search.</p>
      ) : null}

      {!loading && canAdd && results.length === 0 ? (
        <div className="card p-4 text-sm text-[var(--app-text-secondary)]">
          No similar names found. You can add your child to the list instead.
        </div>
      ) : null}

      <div className="space-y-2">
        {results.map((student) => (
          <button
            key={student.id}
            type="button"
            className="card w-full p-3 text-left transition-transform active:scale-[0.98] md:p-4"
            onClick={() => pickStudent(student)}
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
          </button>
        ))}
      </div>

      {!loading && canAdd ? (
        <button type="button" className="btn-secondary w-full" onClick={() => startAdd()}>
          Add &ldquo;{query.trim()}&rdquo; to list
        </button>
      ) : null}

      {!loading && canAdd && allStudents.length > 0 && results.length > 0 ? (
        <p className="text-xs text-[var(--app-text-muted)]">
          Showing names similar to &ldquo;{query}&rdquo;. Tap one to confirm, or add them if they&apos;re not listed.
        </p>
      ) : null}

      {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
    </div>
  );
}
