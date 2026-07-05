const ugxFormatter = new Intl.NumberFormat("en-UG", {
  style: "decimal",
  maximumFractionDigits: 0,
});

/** Smallest allowed transaction — no 100 UGX floor. */
export const MIN_UGX_AMOUNT = 1;

export function formatUgx(amount: number): string {
  return `UGX ${ugxFormatter.format(amount)}`;
}

export function parseUgxInput(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed >= MIN_UGX_AMOUNT ? parsed : null;
}
