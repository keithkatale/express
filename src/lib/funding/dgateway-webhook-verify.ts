import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies `X-DGateway-Signature` (HMAC-SHA256 hex of raw body).
 */
export function verifyDGatewayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  const secretTrim = secret?.trim();
  if (!secretTrim || !signatureHeader?.trim()) return false;

  const received = signatureHeader.trim().replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;

  const expected = createHmac("sha256", secretTrim).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

export type DGatewayWebhookPayload = {
  event: string;
  reference: string;
  provider?: string;
  provider_ref?: string;
  direction?: string;
  amount?: number;
  currency?: string;
  status?: "pending" | "completed" | "failed";
  phone_number?: string;
  failure_reason?: string;
};

function statusFromEvent(event: string): "pending" | "completed" | "failed" | undefined {
  if (event.includes("completed")) return "completed";
  if (event.includes("failed")) return "failed";
  if (event.includes("pending")) return "pending";
  return undefined;
}

export function parseDGatewayWebhookPayload(raw: unknown): DGatewayWebhookPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;

  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const reference =
    data.reference != null
      ? String(data.reference).trim()
      : root.reference != null
        ? String(root.reference).trim()
        : "";
  if (!reference) return null;

  const event = root.event != null ? String(root.event) : "transaction.updated";
  const statusRaw =
    data.status != null
      ? String(data.status)
      : root.status != null
        ? String(root.status)
        : statusFromEvent(event) ?? "pending";

  const status =
    statusRaw === "completed" || statusRaw === "failed" || statusRaw === "pending"
      ? statusRaw
      : "pending";

  return {
    event,
    reference,
    provider:
      data.provider != null
        ? String(data.provider)
        : root.provider != null
          ? String(root.provider)
          : undefined,
    provider_ref: data.provider_ref != null ? String(data.provider_ref) : undefined,
    direction:
      data.direction != null
        ? String(data.direction)
        : root.direction != null
          ? String(root.direction)
          : undefined,
    amount:
      data.amount != null ? Number(data.amount) : root.amount != null ? Number(root.amount) : undefined,
    currency:
      data.currency != null
        ? String(data.currency)
        : root.currency != null
          ? String(root.currency)
          : undefined,
    status,
    phone_number:
      data.phone_number != null
        ? String(data.phone_number)
        : root.phone_number != null
          ? String(root.phone_number)
          : undefined,
    failure_reason: data.failure_reason != null ? String(data.failure_reason) : undefined,
  };
}
