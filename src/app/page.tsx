import Link from "next/link";
import { AppLogo } from "@/components/branding/app-logo";
import { AuthPage } from "@/components/layout/page-container";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";

export default function LandingPage() {
  return (
    <AuthPage className="text-center">
      <div className="flex justify-center">
        <AppLogo size={72} priority />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">
        Benchmark Express
      </p>
      <h1 className="page-title mt-3">Send money to your student at school</h1>
      <p className="page-subtitle mx-auto mt-3 max-w-md">
        Parents fund student accounts. The bursar confirms deposits and records withdrawals in real time.
      </p>

      <PwaInstallPrompt className="mt-6 w-full text-left" />

      <div className="mt-6 flex w-full flex-col gap-2.5 md:mt-8 md:gap-3">
        <Link href="/login" className="btn-primary w-full">
          Sign in
        </Link>
        <Link href="/signup" className="btn-secondary w-full">
          Create parent account
        </Link>
        <Link href="/accountant" className="py-1 text-xs text-[var(--app-text-muted)] md:text-sm">
          School bursar? Accountant sign in
        </Link>
      </div>
    </AuthPage>
  );
}
