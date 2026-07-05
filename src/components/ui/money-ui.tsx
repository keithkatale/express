import Link from "next/link";
import { formatUgx } from "@/lib/format-money";
import { formatStudentMeta } from "@/lib/student-meta";
import { NavBadge } from "@/components/ui/nav-badge";
import type { EntryStatus, EntryType } from "@/types/database";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function BalanceHero({
  label,
  amount,
  subtitle,
}: {
  label: string;
  amount: number;
  subtitle?: string;
}) {
  return (
    <div className="card p-4 text-center md:p-6">
      <p className="text-xs text-[var(--app-text-muted)] md:text-sm">{label}</p>
      <p className="font-display mt-1 text-3xl font-semibold tracking-tight md:mt-2 md:text-4xl">
        {formatUgx(amount)}
      </p>
      {subtitle ? (
        <p className="mt-1.5 text-xs text-[var(--app-text-secondary)] md:mt-2 md:text-sm">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span
      className={cn(
        "badge",
        status === "pending" && "badge-pending",
        status === "confirmed" && "badge-confirmed",
        status === "rejected" && "badge-rejected"
      )}
    >
      {status}
    </span>
  );
}

export function TransactionRow({
  title,
  subtitle,
  amount,
  entryType,
  status,
}: {
  title: string;
  subtitle: string;
  amount: number;
  entryType: EntryType;
  status: EntryStatus;
}) {
  const isCredit = entryType === "deposit" || entryType === "adjustment";
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--app-divider)] py-3 last:border-b-0 md:gap-3 md:py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bc-layer2)] md:h-10 md:w-10">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium md:text-base">{title}</p>
        <p className="text-xs text-[var(--app-text-muted)] md:text-sm">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium md:text-base">
          {isCredit ? "+" : "-"}
          {formatUgx(amount)}
        </p>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

export function StudentCard({
  name,
  className,
  balance,
  href,
  action,
  studentCode,
  slug,
  admissionNo,
  pendingCount,
}: {
  name: string;
  className: string;
  balance: number;
  href?: string;
  action?: React.ReactNode;
  studentCode?: string | null;
  slug?: string | null;
  admissionNo?: string | null;
  pendingCount?: number;
}) {
  const details = (
    <>
      <div className="flex items-center gap-2">
        <p className="truncate font-semibold">{name}</p>
        {pendingCount && pendingCount > 0 ? (
          <NavBadge count={pendingCount} pulse />
        ) : null}
      </div>
      <p className="text-xs text-[var(--app-text-muted)] md:text-sm">
        {formatStudentMeta({ className, studentCode, slug, admissionNo })}
      </p>
      <p className="mt-1.5 font-display text-lg md:mt-2 md:text-xl">{formatUgx(balance)}</p>
    </>
  );

  return (
    <div className="card flex items-center justify-between gap-3 p-3 md:gap-4 md:p-4">
      {href ? (
        <Link href={href} className="min-w-0 flex-1 transition-transform active:scale-[0.98]">
          {details}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{details}</div>
      )}
      {action}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card px-4 py-8 text-center md:px-6 md:py-12">
      <p className="font-display text-lg font-semibold md:text-xl">{title}</p>
      <p className="mt-2 text-xs text-[var(--app-text-muted)] md:text-sm">{description}</p>
    </div>
  );
}

export function LoadingCard() {
  return <div className="card shimmer h-24 rounded-lg md:h-28" />;
}

export function ListCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card list-bleed-mobile px-3 md:px-4", className)}>
      {children}
    </div>
  );
}
