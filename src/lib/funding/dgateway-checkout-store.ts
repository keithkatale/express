import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DGatewayCurrency } from "@/lib/dgateway-client";

export type DGatewayCheckoutRow = {
  id: string;
  user_id: string;
  student_id: string;
  mode: "demo" | "live";
  reference: string;
  provider: string | null;
  provider_ref: string | null;
  amount: number;
  currency: DGatewayCurrency;
  phone_number: string;
  description: string | null;
  note: string | null;
  status: "pending" | "completed" | "failed";
  ledger_entry_id: string | null;
  webhook_processed_at: string | null;
};

export async function insertDGatewayCheckout(args: {
  userId: string;
  studentId: string;
  mode: "demo" | "live";
  reference: string;
  provider?: string;
  providerRef?: string;
  amount: number;
  currency: DGatewayCurrency;
  phoneNumber: string;
  description?: string;
  note?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("dgateway_checkouts").insert({
    user_id: args.userId,
    student_id: args.studentId,
    mode: args.mode,
    reference: args.reference,
    provider: args.provider ?? null,
    provider_ref: args.providerRef ?? null,
    amount: args.amount,
    currency: args.currency,
    phone_number: args.phoneNumber,
    description: args.description ?? null,
    note: args.note ?? null,
    status: "pending",
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getDGatewayCheckoutByReference(
  reference: string
): Promise<DGatewayCheckoutRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("dgateway_checkouts")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DGatewayCheckoutRow | null;
}

export async function getDGatewayCheckoutForUser(
  reference: string,
  userId: string
): Promise<DGatewayCheckoutRow | null> {
  const row = await getDGatewayCheckoutByReference(reference);
  if (!row || row.user_id !== userId) return null;
  return row;
}

export async function updateDGatewayCheckoutStatus(args: {
  reference: string;
  status: "pending" | "completed" | "failed";
  provider?: string;
  providerRef?: string;
  ledgerEntryId?: string;
  markWebhookProcessed?: boolean;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status: args.status,
    updated_at: new Date().toISOString(),
  };
  if (args.provider) patch.provider = args.provider;
  if (args.providerRef) patch.provider_ref = args.providerRef;
  if (args.ledgerEntryId) patch.ledger_entry_id = args.ledgerEntryId;
  if (args.markWebhookProcessed) patch.webhook_processed_at = new Date().toISOString();

  const { error } = await admin
    .from("dgateway_checkouts")
    .update(patch)
    .eq("reference", args.reference);
  if (error) throw new Error(error.message);
}

export async function isDGatewayCheckoutWebhookProcessed(reference: string): Promise<boolean> {
  const row = await getDGatewayCheckoutByReference(reference);
  return Boolean(row?.webhook_processed_at) && row?.status === "completed";
}
