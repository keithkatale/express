"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export function SuccessScreen({
  title,
  subtitle,
  detail,
  variant = "success",
  children,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  variant?: "success" | "rejected";
  children?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  const isSuccess = variant === "success";

  return (
    <div className={cn("success-screen send-step-animate send-step-animate--success", className)}>
      <div
        className={cn(
          "success-screen-badge",
          isSuccess ? "success-screen-badge--success" : "success-screen-badge--rejected"
        )}
        aria-hidden
      >
        {isSuccess ? <Check className="h-8 w-8" strokeWidth={2.5} /> : <X className="h-8 w-8" strokeWidth={2.5} />}
      </div>

      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-[var(--app-text-secondary)]">{subtitle}</p> : null}
        {detail ? (
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{detail}</p>
        ) : null}
      </div>

      {children}

      <div className="w-full space-y-3">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );
}
