"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthPage } from "@/components/layout/page-container";
import { LoadingButtonLabel } from "@/components/ui/loading-button";
import { authEmailFromIdentifier, parseAuthIdentifier } from "@/lib/auth-identifier";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsed = parseAuthIdentifier(identifier);
    if (!parsed.ok) {
      setError(parsed.error);
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmailFromIdentifier(parsed.value),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Could not sign in.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "parent";
    if (role === "parent") {
      const { count } = await supabase
        .from("parent_students")
        .select("*", { count: "exact", head: true })
        .eq("parent_id", user.id);
      router.push(next ?? ((count ?? 0) > 0 ? "/app" : "/app/onboard"));
    } else {
      router.push(next ?? "/accountant/students");
    }
    router.refresh();
  }

  return (
    <AuthPage>
      <h1 className="page-title">Welcome back</h1>
      <p className="page-subtitle mt-2">Sign in with email or Uganda phone</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Email or phone</label>
          <input
            className="input-ios"
            type="text"
            inputMode="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
            placeholder="you@email.com or 07XX XXX XXX"
          />
          <p className="mt-1.5 text-xs text-white/55">Uganda numbers use +256.</p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Password</label>
          <input
            className="input-ios"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
        <button type="submit" className="btn-primary w-full" disabled={loading} aria-busy={loading}>
          <LoadingButtonLabel loading={loading} loadingLabel="Signing in">
            Sign in
          </LoadingButtonLabel>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--app-text-muted)]">
        New parent?{" "}
        <Link href="/signup" className="font-semibold text-[var(--app-text-primary)]">
          Create account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-[var(--app-text-muted)]">
        School bursar?{" "}
        <Link href="/accountant" className="font-semibold text-[var(--app-text-primary)]">
          Accountant sign in
        </Link>
      </p>
    </AuthPage>
  );
}
