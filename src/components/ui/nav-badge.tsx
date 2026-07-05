import { cn } from "@/lib/utils";

export function NavBadge({
  count,
  className,
  pulse,
}: {
  count: number;
  className?: string;
  pulse?: boolean;
}) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn("nav-badge", pulse && "nav-badge--pulse", className)}
      aria-label={`${count} pending`}
    >
      {label}
    </span>
  );
}

export function PendingDot({ className }: { className?: string }) {
  return <span className={cn("pending-dot", className)} aria-hidden />;
}
