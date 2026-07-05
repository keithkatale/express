"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    function onInstallable(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onInstallable);
    return () => window.removeEventListener("beforeinstallprompt", onInstallable);
  }, []);

  async function handleInstall() {
    if (isIos()) {
      setShowIosHint((v) => !v);
      return;
    }

    if (!deferred) return;

    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferred(null);
  }

  if (installed) return null;

  const canInstall = Boolean(deferred) || isIos();

  if (!canInstall) return null;

  return (
    <div className={className}>
      <button type="button" className="pwa-install-card" onClick={() => void handleInstall()}>
        <span className="pwa-install-icon" aria-hidden>
          {isIos() ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold">Install Benchmark Express</span>
          <span className="block text-xs text-[var(--app-text-muted)]">
            {isIos() ? "Add to your home screen for quick access" : "Download the app to this device"}
          </span>
        </span>
      </button>

      {showIosHint && isIos() ? (
        <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
          Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.
        </p>
      ) : null}
    </div>
  );
}
