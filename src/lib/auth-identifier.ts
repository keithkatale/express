import { maskUgPhone, normalizeUgPhone } from "@/lib/phone-ug";

/** Private Auth email for phone-only accounts (password login). */
export const PHONE_AUTH_DOMAIN = "phone.ug.local";

export type AuthIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; e164: string; authEmail: string; digits: string };

export function phoneToAuthEmail(digitsOrE164: string): string {
  const digits = digitsOrE164.replace(/^\+/, "").replace(/\D/g, "");
  return `${digits}@${PHONE_AUTH_DOMAIN}`;
}

/**
 * Parse a login/signup identifier as email or Uganda phone.
 */
export function parseAuthIdentifier(input: string):
  | { ok: true; value: AuthIdentifier }
  | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter your email or phone number." };

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (email.endsWith(`@${PHONE_AUTH_DOMAIN}`)) {
      return { ok: false, error: "Enter your phone number, not this email." };
    }
    return { ok: true, value: { kind: "email", email } };
  }

  const phone = normalizeUgPhone(trimmed);
  if (!phone.ok) return { ok: false, error: phone.error };

  return {
    ok: true,
    value: {
      kind: "phone",
      e164: phone.e164,
      authEmail: phoneToAuthEmail(phone.digits),
      digits: phone.digits,
    },
  };
}

/** Email used with Supabase signInWithPassword / signUp. */
export function authEmailFromIdentifier(id: AuthIdentifier): string {
  return id.kind === "email" ? id.email : id.authEmail;
}

export function maskContact(email?: string | null, phone?: string | null): string {
  if (email) {
    const [user, domain] = email.split("@");
    if (!domain) return "••••@••••";
    const visible = user.slice(0, Math.min(2, user.length));
    return `${visible}•••@${domain}`;
  }
  if (phone) return maskUgPhone(phone);
  return "••••";
}
