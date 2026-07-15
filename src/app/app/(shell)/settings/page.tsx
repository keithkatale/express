"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function ParentSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data as Profile);
    }
    void load();
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="content-profile space-y-6">
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
          <p className="font-medium capitalize">{profile?.role ?? "parent"}</p>
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

      <Link href="/app/onboard" className="btn-primary block w-full text-center">
        Link another child
      </Link>

      <button type="button" className="btn-secondary w-full" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
