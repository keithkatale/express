"use client";

export type CheckoutPollStatus = "pending" | "completed" | "failed";

export type CheckoutStatusResponse = {
  data?: {
    reference: string;
    status: CheckoutPollStatus;
    provider?: string | null;
    provider_ref?: string | null;
  };
  error?: string;
};

/** DGateway STK prompt window — poll until completed/failed or this ceiling. */
export const DGATEWAY_PROMPT_POLL_MS = 4_000;
export const DGATEWAY_PROMPT_MAX_MS = 90_000;

const START_TIMEOUT_MS = 25_000;

export async function startDGatewayCheckout(body: {
  student_id: string;
  amount: number;
  currency?: string;
  phone_number: string;
  note?: string;
  description?: string;
}): Promise<{ reference: string; status: CheckoutPollStatus; provider: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), START_TIMEOUT_MS);

  try {
    const res = await fetch("/api/checkout/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json()) as CheckoutStatusResponse & {
      data?: { reference: string; status: CheckoutPollStatus; provider: string | null };
      code?: string | null;
    };
    if (!res.ok) {
      const detail = json.code ? `${json.error} (${json.code})` : json.error;
      throw new Error(detail ?? "Could not start checkout");
    }
    if (!json.data?.reference) throw new Error("No payment reference returned");
    return {
      reference: json.data.reference,
      status: json.data.status,
      provider: json.data.provider ?? null,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Still connecting to the payment network. If a prompt appears on your phone, approve it — the school will be notified automatically."
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCheckoutStatus(reference: string): Promise<CheckoutPollStatus> {
  const res = await fetch(`/api/checkout/status/${encodeURIComponent(reference)}`);
  const json = (await res.json()) as CheckoutStatusResponse;
  if (!res.ok) throw new Error(json.error ?? "Status check failed");
  return json.data?.status ?? "pending";
}

/** Poll after collect; first check runs immediately (no initial delay). */
export function pollDGatewayUntilTerminal(
  reference: string,
  onTick?: (status: CheckoutPollStatus) => void
): { promise: Promise<CheckoutPollStatus>; cancel: () => void } {
  let cancelled = false;
  const started = Date.now();

  const promise = (async (): Promise<CheckoutPollStatus> => {
    let status: CheckoutPollStatus = "pending";
    let first = true;
    while (!cancelled && Date.now() - started < DGATEWAY_PROMPT_MAX_MS) {
      status = await fetchCheckoutStatus(reference);
      onTick?.(status);
      if (status === "completed" || status === "failed") return status;
      if (!first) {
        await new Promise((r) => setTimeout(r, DGATEWAY_PROMPT_POLL_MS));
      }
      first = false;
    }
    return cancelled ? "pending" : status;
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}
