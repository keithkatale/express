"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectParentForm } from "@/components/students/connect-parent-form";
import { useTheme } from "@/components/theme/theme-provider";
import {
  isDepositSoundMuted,
  playDepositChaChing,
  setDepositSoundMuted,
  unlockDepositSound,
} from "@/lib/deposit-sound";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function SecretarySettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    setSoundMuted(isDepositSoundMuted());

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

      if (studentList) setStudents(studentList);
    }
    void load();
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isStaff = profile?.role === "secretary" || profile?.role === "admin";

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
        <div className="card space-y-3 p-4">
          <div>
            <p className="text-sm font-medium">Deposit alert sound</p>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
              Plays a cha-ching when a parent sends money while this dashboard is open.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn-secondary flex-1 px-3 py-2 text-sm ${!soundMuted ? "ring-2 ring-[var(--lumina-primary)]" : ""}`}
              onClick={() => {
                setDepositSoundMuted(false);
                setSoundMuted(false);
                unlockDepositSound();
              }}
            >
              On
            </button>
            <button
              type="button"
              className={`btn-secondary flex-1 px-3 py-2 text-sm ${soundMuted ? "ring-2 ring-[var(--lumina-primary)]" : ""}`}
              onClick={() => {
                setDepositSoundMuted(true);
                setSoundMuted(true);
              }}
            >
              Muted
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-sm"
              onClick={() => {
                unlockDepositSound();
                playDepositChaChing({ force: true });
              }}
            >
              Test
            </button>
          </div>
        </div>
      ) : null}

      {isStaff ? (
        <>
          <div className="card space-y-3 p-4">
            <h2 className="section-title">Student profiles</h2>
            <p className="text-sm text-[var(--app-text-secondary)]">
              Create profiles without a parent. Connect parents with email or phone, then share the
              invite link.
            </p>
            <Link href="/accountant/students/new" className="btn-primary block w-full text-center">
              Add student profile
            </Link>
          </div>

          <div className="card space-y-3 p-4">
            <h2 className="section-title">Connect parent</h2>
            <p className="text-sm text-[var(--app-text-secondary)]">
              Link an existing parent, or create a shareable invite (WhatsApp / copy) so they can set
              a password.
            </p>
            <ConnectParentForm students={students} />
          </div>
        </>
      ) : null}

      <button type="button" className="btn-secondary w-full" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
