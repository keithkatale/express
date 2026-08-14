/**
 * Server-only DGateway HTTP client.
 * @see https://dgateway.com/docs
 * @see https://dgateway.desispay.com/llms.txt
 */

export type DGatewayCurrency = "UGX" | "KES" | "TZS" | "RWF";
export type DGatewayProvider = "iotec" | "relworx";

export type DGatewayCollectBody = {
  amount: number;
  currency: DGatewayCurrency;
  phone_number: string;
  provider: DGatewayProvider;
  description?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
};

export type DGatewayCollectResult = {
  reference: string;
  status: "pending" | "completed" | "failed";
  provider?: string;
  provider_ref?: string;
  failure_reason?: string;
};

export type DGatewayTransactionStatus = {
  reference: string;
  status: "pending" | "completed" | "failed";
  provider?: string;
  provider_ref?: string;
  amount?: number;
  currency?: string;
  phone_number?: string;
  direction?: string;
  failure_reason?: string;
};

export class DGatewayConfigError extends Error {
  constructor(message = "DGateway is not configured (set DGATEWAY_API_KEY)") {
    super(message);
    this.name = "DGatewayConfigError";
  }
}

export class DGatewayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly code?: string
  ) {
    super(message);
    this.name = "DGatewayApiError";
  }
}

const DEFAULT_BASE_URL = "https://dgatewayapi.desispay.com";
/** Collect can wait on Iotec/Relworx STK dispatch; keep under route maxDuration. */
const TIMEOUT_MS = 55_000;

export function isDGatewayConfigured(): boolean {
  return Boolean(process.env.DGATEWAY_API_KEY?.trim());
}

export function isDGatewayTestKey(): boolean {
  return process.env.DGATEWAY_API_KEY?.trim().startsWith("dgw_test_") ?? false;
}

/** UGX → Iotec; KES/TZS/RWF → Relworx (per DGateway provider matrix). */
export function providerForCurrency(currency: DGatewayCurrency): DGatewayProvider {
  return currency === "UGX" ? "iotec" : "relworx";
}

export function dgatewayPublicOrigin(): string {
  const url =
    process.env.APP_URL?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return url.replace(/\/$/, "");
}

/** Public HTTPS callback for DGateway outbound webhooks. Omitted on localhost (use polling). */
export function dgatewayWebhookCallbackUrl(): string | undefined {
  const origin = dgatewayPublicOrigin();
  if (!origin) return undefined;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin)) return undefined;
  if (!origin.startsWith("https://")) return undefined;
  return `${origin}/api/webhooks/dgateway`;
}

function resolveBaseUrl(): string {
  const raw = (process.env.DGATEWAY_API_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  if (/dgateway\.desispay\.com/i.test(raw) && !/dgatewayapi/i.test(raw)) {
    console.warn(
      "[dgateway] DGATEWAY_API_URL looks like the marketing host; use https://dgatewayapi.desispay.com"
    );
    return DEFAULT_BASE_URL;
  }
  return raw;
}

type DGatewayErrorBody = {
  error?: string | { code?: string; message?: string };
  message?: string;
};

function parseApiError(json: unknown, httpStatus: number): DGatewayApiError {
  const o = (json ?? {}) as DGatewayErrorBody;
  let code: string | undefined;
  let message: string | undefined;

  if (o.error && typeof o.error === "object") {
    code = o.error.code;
    message = o.error.message;
  } else if (typeof o.error === "string") {
    message = o.error;
  }
  if (!message && typeof o.message === "string") message = o.message;

  const text = message ?? `DGateway API error (${httpStatus})`;
  return new DGatewayApiError(text, httpStatus, json, code);
}

async function dgatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.DGATEWAY_API_KEY?.trim();
  if (!apiKey) throw new DGatewayConfigError();

  const base = resolveBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        ...(init?.headers ?? {}),
      },
    });

    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { raw: text };
      }
    }

    const errBody = json as DGatewayErrorBody | null;
    const hasNestedError =
      errBody?.error != null &&
      (typeof errBody.error === "string" ||
        (typeof errBody.error === "object" && errBody.error.message));

    if (!res.ok || hasNestedError) {
      throw parseApiError(json, res.ok ? 400 : res.status);
    }

    return json as T;
  } catch (e) {
    if (e instanceof DGatewayApiError || e instanceof DGatewayConfigError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new DGatewayApiError("DGateway request timed out after 30s", 504, null);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function validateCollectForTestMode(currency: DGatewayCurrency): string | null {
  if (!isDGatewayTestKey()) return null;
  if (currency !== "UGX") {
    return "Test API keys only support UGX collections via Iotec. Use currency UGX and test phone 256111777111, or switch to a live key for KES/TZS/RWF.";
  }
  return null;
}

/** Map provider errors to a friendly 4xx message when possible. */
export function friendlyDGatewayError(e: DGatewayApiError): { message: string; httpStatus: number } {
  const lower = e.message.toLowerCase();
  if (
    e.code === "PROVIDER_ERROR" ||
    e.code === "INVALID_PHONE" ||
    e.code === "TEST_MODE" ||
    lower.includes("test wallet") ||
    lower.includes("real number")
  ) {
    if (lower.includes("real number") || lower.includes("test wallet")) {
      return {
        message:
          "Sandbox mode: use test phone 256111777111 (enter 111777111 with +256). Real numbers cannot be charged on a test wallet.",
        httpStatus: 400,
      };
    }
    return { message: e.message, httpStatus: 400 };
  }
  if (e.code === "PROVIDER_LINE_DOWN" || e.status === 503) {
    return { message: "Mobile money network is temporarily unavailable. Try again or use a different line.", httpStatus: 503 };
  }
  return { message: e.message, httpStatus: e.status >= 500 ? 502 : e.status };
}

export async function collectPayment(body: DGatewayCollectBody): Promise<DGatewayCollectResult> {
  const testErr = validateCollectForTestMode(body.currency);
  if (testErr) throw new DGatewayApiError(testErr, 400, null, "TEST_MODE");

  const payload: Record<string, unknown> = {
    amount: body.amount,
    currency: body.currency,
    phone_number: body.phone_number,
    provider: body.provider,
    description: body.description,
    metadata: body.metadata,
  };
  if (body.callback_url) payload.callback_url = body.callback_url;

  const raw = await dgatewayFetch<unknown>("/v1/payments/collect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = unwrapData<Record<string, unknown>>(raw);
  const reference = String(data.reference ?? "");
  if (!reference) {
    throw new DGatewayApiError("DGateway collect response missing reference", 502, raw);
  }
  return {
    reference,
    status: (data.status as DGatewayCollectResult["status"]) ?? "pending",
    provider: data.provider != null ? String(data.provider) : undefined,
    provider_ref: data.provider_ref != null ? String(data.provider_ref) : undefined,
    failure_reason:
      data.failure_reason != null ? String(data.failure_reason) : undefined,
  };
}

/** Poll status via POST /v1/webhooks/verify (documented). */
export async function verifyTransactionStatus(
  reference: string
): Promise<DGatewayTransactionStatus> {
  const raw = await dgatewayFetch<unknown>("/v1/webhooks/verify", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
  const data = unwrapData<Record<string, unknown>>(raw);
  const status = String(data.status ?? "pending") as DGatewayTransactionStatus["status"];
  return {
    reference: String(data.reference ?? reference),
    status:
      status === "completed" || status === "failed" || status === "pending"
        ? status
        : "pending",
    provider: data.provider != null ? String(data.provider) : undefined,
    provider_ref: data.provider_ref != null ? String(data.provider_ref) : undefined,
    amount: data.amount != null ? Number(data.amount) : undefined,
    currency: data.currency != null ? String(data.currency) : undefined,
    phone_number: data.phone_number != null ? String(data.phone_number) : undefined,
    failure_reason:
      data.failure_reason != null ? String(data.failure_reason) : undefined,
  };
}

/** @deprecated Use verifyTransactionStatus — kept as alias for status route. */
export async function getTransactionStatus(reference: string): Promise<DGatewayTransactionStatus> {
  try {
    return await verifyTransactionStatus(reference);
  } catch (e) {
    if (e instanceof DGatewayApiError && e.status === 404) {
      const raw = await dgatewayFetch<unknown>(
        `/v1/payments/transactions/${encodeURIComponent(reference)}`,
        { method: "GET" }
      );
      const data = unwrapData<Record<string, unknown>>(raw);
      const status = String(data.status ?? "pending") as DGatewayTransactionStatus["status"];
      return {
        reference: String(data.reference ?? reference),
        status:
          status === "completed" || status === "failed" || status === "pending"
            ? status
            : "pending",
        provider: data.provider != null ? String(data.provider) : undefined,
        provider_ref: data.provider_ref != null ? String(data.provider_ref) : undefined,
        amount: data.amount != null ? Number(data.amount) : undefined,
        currency: data.currency != null ? String(data.currency) : undefined,
        failure_reason:
          data.failure_reason != null ? String(data.failure_reason) : undefined,
      };
    }
    throw e;
  }
}
