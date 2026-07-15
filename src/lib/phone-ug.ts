/** Uganda phone helpers — E.164 +256 only. No SMS provider. */

const UG_COUNTRY = "256";

export type UgPhoneNormalizeResult =
  | { ok: true; e164: string; national: string; digits: string }
  | { ok: false; error: string };

/**
 * Accepts 07XXXXXXXX, 7XXXXXXXX, +2567XXXXXXXX, 2567XXXXXXXX.
 * Returns E.164 (+2567XXXXXXXX) for storage.
 */
export function normalizeUgPhone(input: string): UgPhoneNormalizeResult {
  const raw = input.trim().replace(/[\s()-]/g, "");
  if (!raw) return { ok: false, error: "Enter a phone number." };

  let digits = raw.replace(/^\+/, "").replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 10) {
    digits = UG_COUNTRY + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith("7")) {
    digits = UG_COUNTRY + digits;
  }

  if (!digits.startsWith(UG_COUNTRY)) {
    return { ok: false, error: "Use a Uganda number (+256)." };
  }

  const national = digits.slice(UG_COUNTRY.length);
  if (!/^7\d{8}$/.test(national)) {
    return {
      ok: false,
      error: "Enter a valid Uganda mobile number (e.g. 07XX XXX XXX).",
    };
  }

  return {
    ok: true,
    e164: `+${digits}`,
    national,
    digits,
  };
}

export function maskUgPhone(e164: string): string {
  const normalized = normalizeUgPhone(e164);
  if (!normalized.ok) return "••••";
  const n = normalized.national;
  return `+256 ${n.slice(0, 3)} ••• ${n.slice(-3)}`;
}

export function ugPhoneToWhatsAppPath(e164: string): string | null {
  const normalized = normalizeUgPhone(e164);
  if (!normalized.ok) return null;
  return normalized.digits;
}
