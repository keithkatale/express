"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthPage } from "@/components/layout/page-container";
import { LoadingButtonLabel } from "@/components/ui/loading-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InviteInfo = {
  parentName: string | null;
  contactMasked: string;
  contactKind: "email" | "phone";
  studentName: string;
  studentClass: string | null;
};

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/invite/${token}`);
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error ?? "Invite unavailable.");
        return;
      }
      setInfo(body as InviteInfo);
      if (body.parentName) setFullName(body.parentName);
    }
    void load();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, password }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Could not create account.");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password,
    });

    if (signInError) {
      setError("Account created. Sign in with your email or phone.");
      setLoading(false);
      router.push("/login");
      return;
    }

    router.push("/app");
    router.refresh();
  }

  if (loadError) {
    return (
      <AuthPage>
        <h1 className="page-title">Invite unavailable</h1>
        <p className="page-subtitle mt-2">{loadError}</p>
        <a href="/login" className="btn-primary mt-8 block w-full text-center">
          Go to sign in
        </a>
      </AuthPage>
    );
  }

  if (!info) {
    return (
      <AuthPage>
        <div className="shimmer h-40 rounded-xl" />
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Parent invite</p>
      <h1 className="page-title mt-2">Set your password</h1>
      <p className="page-subtitle mt-2">
        Connect to <span className="text-white">{info.studentName}</span>
        {info.studentClass ? ` (${info.studentClass})` : ""}. You&apos;ll sign in with{" "}
        {info.contactMasked}.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Full name</label>
          <input
            className="input-ios"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Password</label>
          <input
            className="input-ios"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Confirm password</label>
          <input
            className="input-ios"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
        <button type="submit" className="btn-primary w-full" disabled={loading} aria-busy={loading}>
          <LoadingButtonLabel loading={loading} loadingLabel="Creating account">
            Create account
          </LoadingButtonLabel>
        </button>
      </form>
    </AuthPage>
  );
}
