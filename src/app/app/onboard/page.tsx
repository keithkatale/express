"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentLinkFlow } from "@/components/onboarding/student-link-flow";

export default function OnboardPage() {
  const router = useRouter();

  return (
    <div className="auth-page !items-start md:!items-center">
      <div className="auth-page-inner w-full max-w-lg">
        <StudentLinkFlow
          onLinked={() => {
            router.push("/app");
            router.refresh();
          }}
          onSkip={() => {
            router.push("/app");
            router.refresh();
          }}
        />
        <p className="mt-6 text-center text-xs text-[var(--app-text-muted)] md:text-sm">
          <Link href="/app" className="font-semibold text-[var(--app-text-primary)]">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
