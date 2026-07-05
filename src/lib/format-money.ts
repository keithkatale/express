const ugxFormatter = new Intl.NumberFormat("en-UG", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export function formatUgx(amount: number): string {
  return `UGX ${ugxFormatter.format(amount)}`;
}

export function parseUgxInput(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
