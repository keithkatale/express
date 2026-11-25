import Image from "next/image";
import Link from "next/link";
import { formatUgx } from "@/lib/format-money";
import { formatStudentMeta } from "@/lib/student-meta";
import { NavBadge } from "@/components/ui/nav-badge";
import type { EntryStatus, EntryType } from "@/types/database";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

const BALANCE_CARD_GRADIENT =
  "linear-gradient(120.58deg, rgb(32, 16, 88) 12.286%, rgb(59, 31, 160) 87.693%)";

export type BalanceHeroTone = "default" | "success" | "danger";

const BALANCE_CARD_TONES: Record<BalanceHeroTone, { gradient: string; shadow: string }> = {
  default: {
    gradient: BALANCE_CARD_GRADIENT,
    shadow: "shadow-[0_18px_48px_rgba(32,16,88,0.28)]",
  },
  success: {
    gradient: "linear-gradient(120.58deg, rgb(6, 78, 59) 12.286%, rgb(5, 150, 105) 87.693%)",
    shadow: "shadow-[0_18px_48px_rgba(5,90,60,0.32)]",
  },
  danger: {
    gradient: "linear-gradient(120.58deg, rgb(127, 29, 29) 12.286%, rgb(220, 38, 38) 87.693%)",
    shadow: "shadow-[0_18px_48px_rgba(127,29,29,0.32)]",
  },
};

export type BalanceHeroStat = {
  label: string;
  value: string;
};

export function BalanceHero({
  label,
  amount,
  name,
  meta,
  subtitle,
  stats,
  compact,
  tone = "default",
  className,
}: {
  label: string;
  amount: number;
  name?: string;
  meta?: string;
  subtitle?: string;
  /** Optional breakdown row rendered inside the gradient card. */
  stats?: BalanceHeroStat[];
  /** Shorter card for overview totals (e.g. platform balance). */
  compact?: boolean;
  /** Colour of the card: purple by default, green for success, red for a decline. */
  tone?: BalanceHeroTone;
  className?: string;
}) {
  const toneStyle = BALANCE_CARD_TONES[tone];
  const hasStats = Boolean(stats?.length);

  return (
    <div
      className={cn(
        "relative isolate w-full overflow-hidden rounded-[1.15rem] text-white md:rounded-2xl",
        toneStyle.shadow,
        compact
          ? hasStats
            ? "py-4 md:py-5"
            : "min-h-[7.5rem] py-4 md:min-h-[8.25rem] md:py-5"
          : "aspect-[1.68/1]",
        className
      )}
      style={{ backgroundImage: toneStyle.gradient }}
    >
      <div className="pointer-events-none absolute inset-[-18%_-8%_-22%_-8%]" aria-hidden>
        <Image
          src="/branding/gradient-circles.svg"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-90"
          sizes="320px"
        />
      </div>

      <div className="pointer-events-none absolute -right-[18%] -bottom-[42%] h-[95%] w-[72%]" aria-hidden>
        <Image
          src="/branding/gradient-circles.svg"
          alt=""
          fill
          className="object-cover object-[75%_30%] opacity-75"
          sizes="220px"
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,transparent_42%),radial-gradient(90%_70%_at_12%_8%,rgba(255,255,255,0.16),transparent_55%)]"
        aria-hidden
      />

      <div
        className={cn(
          "relative z-10 flex h-full flex-col px-5 md:px-5",
          compact ? "justify-center gap-1.5 py-0" : "py-4 md:py-4"
        )}
      >
        <p className="text-center text-[11px] font-medium tracking-[0.06em] text-white/70 uppercase md:text-xs">
          {label}
        </p>

        <div
          className={cn(
            "flex flex-col items-center justify-center text-center",
            !compact && "flex-1"
          )}
        >
          <p
            className={cn(
              "font-display font-semibold leading-none tracking-[-0.02em] text-white [text-shadow:0_1px_18px_rgba(16,8,48,0.25)]",
              compact
                ? "text-[clamp(1.45rem,5vw,1.85rem)]"
                : "text-[clamp(1.9rem,6.5vw,2.45rem)]"
            )}
          >
            {formatUgx(amount)}
          </p>
          {subtitle ? (
            <p className={cn("text-xs text-white/65", compact ? "mt-1.5" : "mt-2")}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {hasStats ? (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 md:mt-4 md:gap-3 md:pt-3.5">
            {stats!.map((stat) => (
              <div key={stat.label} className="min-w-0 text-center">
                <p className="truncate text-[10px] font-medium tracking-[0.05em] text-white/55 uppercase md:text-[11px]">
                  {stat.label}
                </p>
                <p className="mt-1 truncate font-display text-xs font-semibold text-white md:text-sm">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {name ? (
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold tracking-tight text-white md:text-[15px]">
              {name}
            </p>
            {meta ? <p className="mt-0.5 truncate text-[11px] text-white/65 md:text-xs">{meta}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: EntryStatus }) {
  const label =
    status === "pending" ? "Sent" : status === "confirmed" ? "Received" : "Rejected";

  return (
    <span
      className={cn(
        "badge",
        status === "pending" && "badge-pending",
        status === "confirmed" && "badge-confirmed",
        status === "rejected" && "badge-rejected"
      )}
    >
      {label}
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
