import { creditDGatewayDepositIfNew } from "@/lib/funding/dgateway-deposit-credit";
import {
  getDGatewayCheckoutByReference,
  isDGatewayCheckoutWebhookProcessed,
  updateDGatewayCheckoutStatus,
} from "@/lib/funding/dgateway-checkout-store";
import {
  parseDGatewayWebhookPayload,
  verifyDGatewayWebhookSignature,
} from "@/lib/funding/dgateway-webhook-verify";

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[dgateway/webhook] read body failed", e);
    return Response.json({ error: "read_failed" }, { status: 400 });
  }

  const signature = request.headers.get("x-dgateway-signature");
  const secret = process.env.DGATEWAY_WEBHOOK_SECRET;
  if (!verifyDGatewayWebhookSignature(rawBody, signature, secret)) {
    console.warn("[dgateway/webhook] invalid signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch (e) {
    console.error("[dgateway/webhook] invalid json", e);
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = parseDGatewayWebhookPayload(parsed);
  if (!event) {
    return Response.json({ received: true, ignored: "unrecognized_payload" });
  }

  const reference = event.reference;

  if (await isDGatewayCheckoutWebhookProcessed(reference)) {
    return Response.json({ received: true, deduped: true });
  }

  const checkout = await getDGatewayCheckoutByReference(reference);
  if (!checkout) {
    console.warn("[dgateway/webhook] unknown reference", reference);
    return Response.json({ received: true, ignored: "unknown_reference" });
  }

  const status = event.status ?? "pending";

  if (status === "failed") {
    await updateDGatewayCheckoutStatus({
      reference,
      status: "failed",
      provider: event.provider,
      providerRef: event.provider_ref,
      markWebhookProcessed: true,
    });
    return Response.json({ received: true, status: "failed" });
  }

  if (status !== "completed") {
    return Response.json({
      received: true,
      status,
      failure_reason: event.failure_reason ?? null,
    });
  }

  const amount = event.amount ?? checkout.amount;
  const currency = event.currency ?? checkout.currency;
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ received: true, ignored: "invalid_amount" });
  }

  void (async () => {
    try {
      await creditDGatewayDepositIfNew({
        userId: checkout.user_id,
        studentId: checkout.student_id,
        reference,
        providerRef: event.provider_ref ?? checkout.provider_ref,
        provider: event.provider ?? checkout.provider,
        amount,
        currency,
        phoneNumber: event.phone_number ?? checkout.phone_number,
        note: checkout.note,
      });
      await updateDGatewayCheckoutStatus({
        reference,
        status: "completed",
        provider: event.provider,
        providerRef: event.provider_ref,
        markWebhookProcessed: true,
      });
      console.log("[dgateway/webhook] processed", { reference });
    } catch (e) {
      console.error("[dgateway/webhook] async credit failed", reference, e);
    }
  })();

  return Response.json({ received: true, status: "completed", processing: true });
}
