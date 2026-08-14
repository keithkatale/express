import {
  DGatewayApiError,
  isDGatewayConfigured,
  verifyTransactionStatus,
} from "@/lib/dgateway-client";
import {
  getDGatewayCheckoutForUser,
  updateDGatewayCheckoutStatus,
} from "@/lib/funding/dgateway-checkout-store";
import { creditDGatewayDepositIfNew } from "@/lib/funding/dgateway-deposit-credit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteCtx = { params: Promise<{ ref: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDGatewayConfigured()) {
    return Response.json({ error: "DGateway is not configured" }, { status: 500 });
  }

  const { ref } = await ctx.params;
  const reference = decodeURIComponent(ref).trim();
  if (!reference) return Response.json({ error: "Missing reference" }, { status: 400 });

  const checkout = await getDGatewayCheckoutForUser(reference, user.id);
  if (!checkout) return Response.json({ error: "Checkout not found" }, { status: 404 });

  try {
    const remote = await verifyTransactionStatus(reference);
    const status = remote.status;

    if (status === "failed") {
      await updateDGatewayCheckoutStatus({
        reference,
        status: "failed",
        provider: remote.provider,
        providerRef: remote.provider_ref,
      });
    }

    if (status === "completed" && checkout.status !== "completed") {
      const amount = remote.amount ?? checkout.amount;
      const currency = remote.currency ?? checkout.currency;
      await creditDGatewayDepositIfNew({
        userId: checkout.user_id,
        studentId: checkout.student_id,
        reference,
        providerRef: remote.provider_ref ?? checkout.provider_ref,
        provider: remote.provider ?? checkout.provider,
        amount,
        currency,
        phoneNumber: remote.phone_number ?? checkout.phone_number,
        note: checkout.note,
      });
      await updateDGatewayCheckoutStatus({
        reference,
        status: "completed",
        provider: remote.provider,
        providerRef: remote.provider_ref,
      });
    }

    return Response.json({
      data: {
        reference,
        status,
        provider: remote.provider ?? checkout.provider,
        provider_ref: remote.provider_ref ?? checkout.provider_ref,
        amount: remote.amount ?? checkout.amount,
        currency: remote.currency ?? checkout.currency,
      },
    });
  } catch (e) {
    if (e instanceof DGatewayApiError) {
      return Response.json({ error: e.message }, { status: e.status >= 500 ? 502 : e.status });
    }
    throw e;
  }
}
