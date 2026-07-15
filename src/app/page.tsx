import Image from "next/image";
import Link from "next/link";
import { AppLogo } from "@/components/branding/app-logo";
import { HeroGradientBackground } from "@/components/landing/hero-gradient-background";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";

export default function LandingPage() {
  return (
    <section className="relative isolate flex min-h-dvh w-full flex-col overflow-hidden text-white">
      <HeroGradientBackground />

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10">
        <nav className="flex w-full items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Benchmark Express home">
            <AppLogo size={40} priority className="rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.15)]" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Benchmark Express
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            Sign in
          </Link>
        </nav>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center py-10 text-center md:py-16">
          <Image
            src="/branding/kisubi.png"
            alt="Kisubi Schools"
            width={112}
            height={112}
            priority
            className="h-24 w-24 rounded-2xl bg-white object-contain shadow-[0_12px_40px_rgba(0,0,0,0.25)] md:h-28 md:w-28"
          />

          <p className="mt-5 w-fit rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-normal leading-snug tracking-normal text-white/90 backdrop-blur-sm sm:px-4 sm:text-[12px] md:mt-6 md:text-[13px]">
            Kisubi High School
          </p>

          <h1 className="mt-5 max-w-[850px] font-[family-name:var(--font-sans)] text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-white md:mt-8">
            Send money to your student at school
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-base md:mt-6 md:text-lg">
            Parents fund student accounts. Balances update when the bursar sees new deposits, and
            withdrawals are recorded in real time.
          </p>

          <div className="mt-8 flex w-full max-w-md flex-col gap-3 md:mt-10 md:flex-row md:justify-center">
            <Link
              href="/login"
              className="flex min-h-[3.75rem] flex-1 items-center justify-center rounded-full bg-white px-6 text-base font-semibold leading-none text-[#201058] transition hover:bg-white/90 active:scale-[0.98] md:min-h-12 md:text-[15px]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex min-h-[3.75rem] flex-1 items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 text-base font-semibold leading-none text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98] md:min-h-12 md:text-[15px]"
            >
              Create parent account
            </Link>
          </div>

          <PwaInstallPrompt variant="hero" className="mt-6 w-full max-w-md text-left" />

          <Link
            href="/accountant"
            className="mt-5 text-xs text-white/60 transition hover:text-white/90 md:text-sm"
          >
            School bursar? Accountant sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
