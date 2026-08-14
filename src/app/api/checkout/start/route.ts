import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DGatewayApiError,
  DGatewayConfigError,
  collectPayment,
  dgatewayWebhookCallbackUrl,
  friendlyDGatewayError,
  isDGatewayConfigured,
  isDGatewayTestKey,
  providerForCurrency,
  validateCollectForTestMode,
  type DGatewayCurrency,
} from "@/lib/dgateway-client";
import { insertDGatewayCheckout } from "@/lib/funding/dgateway-checkout-store";
import { isDGatewayDepositsEnabled } from "@/lib/funding/dgateway-deposits-enabled";
import {
  normalizeDGatewayMsisdn,
  validateDGatewayTestPhone,
} from "@/lib/funding/dgateway-test-phones";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  student_id: z.string().uuid(),
  amount: z.number().int().min(500).max(50_000_000),
  currency: z.enum(["UGX", "KES", "TZS", "RWF"]).default("UGX"),
  phone_number: z.string().min(9).max(20),
  note: z.string().max(200).optional(),
  description: z.string().max(200).optional(),
});

export const maxDuration = 90;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDGatewayDepositsEnabled()) {
    return Response.json({ error: "Live mobile-money deposits are not enabled." }, { status: 503 });
  }
  if (!isDGatewayConfigured()) {
    return Response.json({ error: "DGateway is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid deposit details." }, { status: 400 });
  }

  const payload = parsed.data;
  const currency = payload.currency as DGatewayCurrency;
  const phone = normalizeDGatewayMsisdn(payload.phone_number);

  const testBlock = validateCollectForTestMode(currency);
  if (testBlock) {
    return Response.json({ error: testBlock, code: "TEST_MODE" }, { status: 400 });
  }

  const phoneBlock = validateDGatewayTestPhone(phone, isDGatewayTestKey());
  if (phoneBlock) {
    return Response.json({ error: phoneBlock, code: "TEST_PHONE_REQUIRED" }, { status: 400 });
  }

  const { data: link } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", user.id)
    .eq("student_id", payload.student_id)
    .maybeSingle();

  if (!link) {
    return Response.json({ error: "Student is not linked to your account." }, { status: 403 });
  }

  const localDescription =
    payload.description ??
    `Benchmark Express deposit${payload.note?.trim() ? `: ${payload.note.trim()}` : ""}`;

  try {
    const callbackUrl = dgatewayWebhookCallbackUrl();
    const collect = await collectPayment({
      amount: payload.amount,
      currency,
      phone_number: phone,
      provider: providerForCurrency(currency),
      description: localDescription,
      callback_url: callbackUrl,
      metadata: {
        user_id: user.id,
        student_id: payload.student_id,
        mode: "live",
        local_ref: `express-dgw-${user.id.slice(0, 8)}-${randomUUID()}`,
        app: "benchmark-express",
      },
    });

    await insertDGatewayCheckout({
      userId: user.id,
      studentId: payload.student_id,
      mode: "live",
      reference: collect.reference,
      provider: collect.provider,
      providerRef: collect.provider_ref,
      amount: payload.amount,
      currency,
      phoneNumber: phone,
      description: localDescription,
      note: payload.note?.trim() || null,
    });

    return Response.json({
      data: {
        reference: collect.reference,
        status: collect.status,
        provider: collect.provider ?? null,
      },
    });
  } catch (e) {
    if (e instanceof DGatewayConfigError) {
      return Response.json({ error: e.message }, { status: 500 });
    }
    if (e instanceof DGatewayApiError) {
      const friendly = friendlyDGatewayError(e);
      console.error("[checkout/start] DGateway error", {
        status: e.status,
        code: e.code,
        message: e.message,
        friendly: friendly.message,
      });
      return Response.json(
        { error: friendly.message, code: e.code ?? null },
        { status: friendly.httpStatus }
      );
    }
    throw e;
  }
}
