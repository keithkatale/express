"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPage } from "@/components/layout/page-container";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AccountantSignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: "secretary" },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Could not create account.");
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/accountant/students");
      router.refresh();
      return;
    }

    setError("Check your email to confirm your account, then sign in.");
    setLoading(false);
  }

  return (
    <AuthPage>
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
        School bursar
      </p>
      <h1 className="page-title mt-2">Create staff account</h1>
      <p className="page-subtitle mt-2">
        For bursars and school accountants who manage student money.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 md:mt-8">
        <div>
          <label className="mb-2 block text-sm font-medium">Full name</label>
          <input
            className="input-ios"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Work email</label>
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
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="text-sm text-[var(--lumina-error)]">{error}</p> : null}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--app-text-muted)]">
        Already have an account?{" "}
        <Link href="/accountant" className="font-semibold text-[var(--app-text-primary)]">
          Sign in
        </Link>
      </p>
    </AuthPage>
  );
}
