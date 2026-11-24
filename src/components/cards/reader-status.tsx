"use client";

import { Nfc, WifiOff } from "lucide-react";
import type { BridgeStatus } from "@/lib/cards/nfc-bridge";
import { cn } from "@/lib/utils";

const COPY: Record<BridgeStatus, { label: string; tone: string }> = {
  idle: { label: "Reader off", tone: "text-[var(--app-text-muted)]" },
  connecting: { label: "Connecting to reader…", tone: "text-[var(--app-text-muted)]" },
  ready: { label: "Reader ready", tone: "text-[var(--lumina-success)]" },
  "no-reader": { label: "Reader unplugged", tone: "text-amber-500" },
  unavailable: { label: "Card service not running", tone: "text-[var(--app-text-muted)]" },
};

export function ReaderStatus({
  status,
  readerName,
  notDetecting,
  className,
}: {
  status: BridgeStatus;
  readerName?: string | null;
  /** Reader is connected but has never reported a card. */
  notDetecting?: boolean;
  className?: string;
}) {
  if (status === "ready" && notDetecting) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-amber-500", className)}>
        <WifiOff className="h-3.5 w-3.5" />
        <span>Reader connected · not detecting cards</span>
      </span>
    );
  }

  const { label, tone } = COPY[status];
  const Icon = status === "ready" ? Nfc : WifiOff;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", tone, className)}>
      <Icon className={cn("h-3.5 w-3.5", status === "connecting" && "animate-pulse")} />
      <span>{status === "ready" && readerName ? `Reader ready · ${readerName}` : label}</span>
    </span>
  );
}
