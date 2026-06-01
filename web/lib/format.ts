const UNIT = 10_000_000n; // 7 decimals

/** Format a smallest-unit amount as a human decimal string. */
export function formatAmount(units: bigint): string {
  const whole = units / UNIT;
  const frac = units % UNIT;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(7, '0').replace(/0+$/, '')}`;
}

/** Parse a human decimal string into smallest units (7 decimals). */
export function toUnits(amount: string): bigint {
  const [whole, frac = ''] = amount.trim().split('.');
  const fracPadded = (frac + '0000000').slice(0, 7);
  return BigInt(whole || '0') * UNIT + BigInt(fracPadded || '0');
}

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/** Utilization as a 0–100 percentage string. */
export function utilization(totalBorrowed: bigint, totalDeposited: bigint): string {
  if (totalDeposited === 0n) return '0';
  return ((Number(totalBorrowed) / Number(totalDeposited)) * 100).toFixed(1);
}

/**
 * Health factor = (collateral × liqThreshold) / debt. Above 1 is safe; below 1
 * is liquidatable. Returns null when there is no debt.
 */
export function healthFactor(
  collateral: bigint,
  debt: bigint,
  liqThresholdBps: number,
): number | null {
  if (debt === 0n) return null;
  return (Number(collateral) * (liqThresholdBps / 10_000)) / Number(debt);
}
