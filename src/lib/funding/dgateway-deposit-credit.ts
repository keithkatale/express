import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DGatewayCreditArgs = {
  userId: string;
  studentId: string;
  /** DGateway transaction reference — idempotency key */
  reference: string;
  providerRef?: string | null;
  provider?: string | null;
  amount: number;
  currency: string;
  phoneNumber?: string | null;
  note?: string | null;
};

/**
 * Creates a pending student deposit once DGateway marks the payment completed.
 * Idempotent on (reference_type, reference_id).
 */
export async function creditDGatewayDepositIfNew(
  args: DGatewayCreditArgs
): Promise<"credited" | "deduped"> {
  const admin = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("ledger_entries")
    .select("id")
    .eq("reference_type", "dgateway_deposit")
    .eq("reference_id", args.reference)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return "deduped";

  if (!Number.isFinite(args.amount) || args.amount <= 0) {
    throw new Error(`Invalid deposit amount: ${args.amount}`);
  }

  const noteParts = [
    args.note?.trim() || null,
    `Mobile money (${args.currency.toUpperCase()})`,
    args.phoneNumber ? `from ${args.phoneNumber}` : null,
    `ref ${args.reference}`,
  ].filter(Boolean);

  const { data: inserted, error: insertError } = await admin
    .from("ledger_entries")
    .insert({
      student_id: args.studentId,
      entry_type: "deposit",
      amount: Math.round(args.amount),
      status: "pending",
      note: noteParts.join(" · "),
      created_by: args.userId,
      reference_type: "dgateway_deposit",
      reference_id: args.reference,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.message.includes("duplicate key") || insertError.code === "23505") {
      return "deduped";
    }
    throw new Error(insertError.message);
  }

  if (inserted?.id) {
    await admin
      .from("dgateway_checkouts")
      .update({ ledger_entry_id: inserted.id, updated_at: new Date().toISOString() })
      .eq("reference", args.reference);
  }

  return "credited";
}
