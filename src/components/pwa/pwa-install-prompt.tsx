"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "hero";
}) {
  const [ready, setReady] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const isHero = variant === "hero";

  useEffect(() => {
    setIos(isIosDevice());
    if (isStandalone()) {
      setInstalled(true);
      setReady(true);
      return;
    }

    function onInstallable(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onInstallable);
    setReady(true);
    return () => window.removeEventListener("beforeinstallprompt", onInstallable);
  }, []);

  async function handleInstall() {
    if (ios) {
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

  // Avoid SSR/client mismatch — only render after mount when UA is known.
  if (!ready || installed) return null;

  const canInstall = Boolean(deferred) || ios;
  if (!canInstall) return null;

  return (
    <div className={className}>
      <button
        type="button"
        className={isHero ? "pwa-install-card pwa-install-card--hero" : "pwa-install-card"}
        onClick={() => void handleInstall()}
      >
        <span className="pwa-install-icon" aria-hidden>
          {ios ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold">Install Benchmark Express</span>
          <span
            className={
              isHero ? "pwa-install-subtitle block text-xs" : "block text-xs text-[var(--app-text-muted)]"
            }
          >
            {ios ? "Add to your home screen for quick access" : "Download the app to this device"}
          </span>
        </span>
      </button>

      {showIosHint && ios ? (
        <p
          className={
            isHero ? "pwa-install-hint--hero mt-2 text-xs" : "mt-2 text-xs text-[var(--app-text-secondary)]"
          }
        >
          Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.
        </p>
      ) : null}
    </div>
  );
}
