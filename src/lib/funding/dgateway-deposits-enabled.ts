/** When true, send flow can use DGateway for live mobile-money deposits. */
export function isDGatewayDepositsEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_DGATEWAY_DEPOSITS_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
