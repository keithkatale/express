"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BalanceHero,
  EmptyState,
  ListCard,
  LoadingCard,
  TransactionRow,
} from "@/components/ui/money-ui";
import { PageStack } from "@/components/layout/page-container";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import {
  getPlatformMoneyOverview,
  getStaffActivity,
  type PlatformMoneyOverview,
} from "@/lib/ledger/service";
import { formatUgx } from "@/lib/format-money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LedgerEntryWithStudent } from "@/types/database";
import { format } from "date-fns";

const EMPTY_OVERVIEW: PlatformMoneyOverview = {
  totalAvailable: 0,
  totalIn: 0,
  totalOut: 0,
  pendingAmount: 0,
  studentsWithBalance: 0,
};

export default function SecretaryActivityPage() {
  const [entries, setEntries] = useState<LedgerEntryWithStudent[]>([]);
  const [overview, setOverview] = useState<PlatformMoneyOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [activity, money] = await Promise.all([
      getStaffActivity(supabase),
      getPlatformMoneyOverview(supabase),
    ]);

    setEntries(activity);
    setOverview(money);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLedgerRealtime(refresh);

  return (
    <PageStack>
      <div>
        <h1 className="page-title">Activity</h1>
        <p className="page-subtitle mt-1">
          Platform money on hand and every school transaction
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="shimmer min-h-[9.5rem] w-full rounded-[1.15rem]" />
          <LoadingCard />
        </div>
      ) : (
        <>
          <BalanceHero
            compact
            label="Total available"
            amount={overview.totalAvailable}
            subtitle={
              overview.studentsWithBalance > 0
                ? `Across ${overview.studentsWithBalance} student${overview.studentsWithBalance === 1 ? "" : "s"} with a balance`
                : "No student balances yet"
            }
            stats={[
              { label: "Received in", value: formatUgx(overview.totalIn) },
              { label: "Paid out", value: formatUgx(overview.totalOut) },
              { label: "Still pending", value: formatUgx(overview.pendingAmount) },
            ]}
          />

          <div>
            <h2 className="section-title mb-3">Recent transactions</h2>
            {entries.length === 0 ? (
              <EmptyState
                title="No activity"
                description="Deposits and withdrawals will appear here."
              />
            ) : (
              <ListCard>
                {entries.map((entry) => (
                  <TransactionRow
                    key={entry.id}
                    title={entry.student.full_name}
                    subtitle={`${entry.entry_type} · ${format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}`}
                    amount={entry.amount}
                    entryType={entry.entry_type}
                    status={entry.status}
                  />
                ))}
              </ListCard>
            )}
          </div>
        </>
      )}
    </PageStack>
  );
}
