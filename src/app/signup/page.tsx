"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPage } from "@/components/layout/page-container";
import { LoadingButtonLabel } from "@/components/ui/loading-button";
import { authEmailFromIdentifier, parseAuthIdentifier } from "@/lib/auth-identifier";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: authEmailFromIdentifier(parsed.value),
      password,
      options: {
        data: {
          full_name: fullName,
          role: "parent",
          phone: parsed.value.kind === "phone" ? parsed.value.e164 : undefined,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user && parsed.value.kind === "phone") {
      await supabase
        .from("profiles")
        .update({ phone: parsed.value.e164, full_name: fullName })
        .eq("id", data.user.id);
    }

    router.push("/app/onboard");
    router.refresh();
  }

  return (
    <AuthPage>
      <h1 className="page-title">Create account</h1>
      <p className="page-subtitle mt-2">Parents can send money to linked students</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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

      <p className="mt-6 text-center text-sm text-[var(--app-text-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--app-text-primary)]">
          Sign in
        </Link>
      </p>
    </AuthPage>
  );
}
