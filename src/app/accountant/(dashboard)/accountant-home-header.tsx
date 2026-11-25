"use client";

import { AppLogo } from "@/components/branding/app-logo";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";

export function AccountantHomeHeader() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* Mobile already shows the logo + name in the top bar. */}
        <AppLogo size={40} className="hidden md:block" />
        <div>
          <p className="hidden text-xs text-[var(--app-text-muted)] md:block md:text-sm">
            Benchmark Express
          </p>
          <p className="text-xs text-[var(--app-text-muted)]">Bursar desk</p>
        </div>
      </div>
      <PwaInstallPrompt />
    </div>
  );
}
