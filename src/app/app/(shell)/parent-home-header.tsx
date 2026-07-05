"use client";

import { AppLogo } from "@/components/branding/app-logo";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";

export function ParentHomeHeader() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AppLogo size={40} />
        <div>
          <p className="text-xs text-[var(--app-text-muted)] md:text-sm">Benchmark Express</p>
          <p className="text-xs text-[var(--app-text-muted)]">Parent home</p>
        </div>
      </div>
      <PwaInstallPrompt />
    </div>
  );
}
