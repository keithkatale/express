import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-[1.15em] w-[1.15em] shrink-0 animate-spin", className)}
      aria-hidden
    />
  );
}

export function LoadingButtonLabel({
  loading,
  loadingLabel = "Please wait",
  children,
}: {
  loading: boolean;
  /** Screen-reader label while loading; spinner is shown visually. */
  loadingLabel?: string;
  children: React.ReactNode;
}) {
  if (!loading) return <>{children}</>;

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <ButtonSpinner />
      <span className="sr-only">{loadingLabel}</span>
    </span>
  );
}
