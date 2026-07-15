import { Suspense } from "react";
import { HeroGradientBackground } from "@/components/landing/hero-gradient-background";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="relative isolate flex min-h-dvh items-center justify-center px-4">
          <HeroGradientBackground />
          <div className="relative z-10 h-40 w-full max-w-md animate-pulse rounded-[1.25rem] bg-white/90" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
