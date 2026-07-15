import Link from "next/link";
import { AppLogo } from "@/components/branding/app-logo";
import { HeroGradientBackground } from "@/components/landing/hero-gradient-background";
import { cn } from "@/lib/utils";

export function AuthPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden",
        "px-[var(--app-gutter-x)] py-6 md:px-6",
        "pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <HeroGradientBackground className="-z-10" />

      <div className="relative z-10 flex w-full max-w-[26rem] flex-col gap-5">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2.5 self-center text-[15px] font-semibold tracking-tight text-white no-underline"
          aria-label="Benchmark Express home"
        >
          <AppLogo size={32} priority className="rounded-lg" />
          <span>Benchmark Express</span>
        </Link>

        <div className="auth-page-card w-full">{children}</div>
      </div>
    </div>
  );
}

export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("page-stack", className)}>{children}</div>;
}

export function CompactPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("content-compact", className)}>{children}</div>;
}
