"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

type InviteResult = {
  status: "linked" | "invited";
  studentName: string;
  url: string;
  message: string;
  whatsappUrl: string | null;
};

export function ConnectParentForm({
  students,
  defaultStudentId,
}: {
  students: { id: string; full_name: string }[];
  defaultStudentId?: string;
}) {
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? "");
  const [parentName, setParentName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);

    const res = await fetch("/api/admin/parent-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        contact,
        parentName: parentName.trim() || undefined,
      }),
    });

    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not connect parent.");
      return;
    }

    setResult(body as InviteResult);
    setContact("");
    setParentName("");
  }

  async function copyLink() {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!students.length) {
    return (
      <p className="text-sm text-[var(--app-text-secondary)]">
        Add a student profile before connecting a parent.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!defaultStudentId ? (
          <div>
            <label className="mb-2 block text-sm font-medium">Student</label>
            <select
              className="input-ios"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-medium">Parent name (optional)</label>
          <input
            className="input-ios"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="e.g. Jane Okello"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Email or phone</label>
          <input
            className="input-ios"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="parent@email.com or 07XX XXX XXX"
            required
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs text-[var(--app-text-muted)]">
            Uganda numbers use +256 (e.g. 0700 123 456).
          </p>
        </div>

        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}

        <button type="submit" className="btn-primary w-full" disabled={loading || !studentId}>
          {loading ? "Working..." : "Connect parent"}
        </button>
      </form>

      {result ? (
        <div className="rounded-xl border border-[var(--app-divider)] bg-[var(--bc-layer2)] p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--lumina-success)]">
            {result.status === "linked"
              ? `${result.studentName} is linked to this parent.`
              : `Invite ready for ${result.studentName}.`}
          </p>
          <p className="break-all text-xs text-[var(--app-text-secondary)]">{result.url}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-secondary flex-1 gap-2" onClick={() => void copyLink()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            {result.whatsappUrl ? (
              <a
                href={result.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex flex-1 items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : (
              <button
                type="button"
                className="btn-secondary flex-1 gap-2"
                onClick={() => void navigator.clipboard.writeText(result.message)}
              >
                <Copy className="h-4 w-4" />
                Copy message
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
