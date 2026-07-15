"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPage } from "@/components/layout/page-container";
import { LoadingButtonLabel } from "@/components/ui/loading-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

function isStaffRole(role: UserRole) {
  return role === "secretary" || role === "admin";
}

async function resolveRole(): Promise<UserRole> {
  const res = await fetch("/api/auth/profile", { cache: "no-store" });
  if (!res.ok) return "parent";
  const body = (await res.json()) as { role: UserRole };
  return body.role;
}

export default function AccountantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Could not sign in.");
      setLoading(false);
      return;
    }

    const metadataRole = data.user.user_metadata?.role as UserRole | undefined;
    let role = metadataRole ?? "parent";

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.role) {
      role = profile.role as UserRole;
    } else if (profileError) {
      role = await resolveRole();
    }

    if (!isStaffRole(role)) {
      setError("This portal is for school bursars and accountants only. Parents should use the main sign in.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push("/accountant/students");
    router.refresh();
  }

  return (
    <AuthPage>
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
        School bursar
      </p>
      <h1 className="page-title mt-2">Accountant sign in</h1>
      <p className="page-subtitle mt-2">
        For bursars and school staff who receive and record student money.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 md:mt-8">
        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
          <input
            className="input-ios"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
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

      <p className="mt-5 text-center text-sm text-[var(--app-text-muted)]">
        New bursar?{" "}
        <Link href="/accountant/signup" className="font-semibold text-[var(--app-text-primary)]">
          Create staff account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-[var(--app-text-muted)]">
        Parent?{" "}
        <Link href="/login" className="font-semibold text-[var(--app-text-primary)]">
          Sign in here
        </Link>
      </p>
    </AuthPage>
  );
}
