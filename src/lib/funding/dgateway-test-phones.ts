/** Iotec sandbox MSISDNs accepted when `DGATEWAY_API_KEY` is `dgw_test_*`. */
export const DGATEWAY_IOTEC_TEST_MSISDNS = ["256111777111"] as const;

/** Normalize to international digits (no +). */
export function normalizeDGatewayMsisdn(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("0")) {
    return trimmed.replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (
    digits.startsWith("256") ||
    digits.startsWith("254") ||
    digits.startsWith("255") ||
    digits.startsWith("250")
  ) {
    return digits;
  }
  return digits;
}

/** Returns user-facing error when test key + non-sandbox phone. */
export function validateDGatewayTestPhone(phone: string, isTestKey: boolean): string | null {
  if (!isTestKey) return null;

  const raw = phone.trim().replace(/\D/g, "");
  const candidates = new Set<string>();
  if (raw) candidates.add(raw);
  if (raw.startsWith("0")) candidates.add(`256${raw.slice(1)}`);
  if (!raw.startsWith("256") && raw.length >= 9) candidates.add(`256${raw}`);

  for (const allowed of DGATEWAY_IOTEC_TEST_MSISDNS) {
    if (candidates.has(allowed)) return null;
  }

  return (
    "Sandbox mode only accepts the Iotec test number 256111777111 (enter 111777111 with +256). " +
    "Real phone numbers are rejected on a test wallet."
  );
}
