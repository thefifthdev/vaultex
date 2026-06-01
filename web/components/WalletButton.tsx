'use client';

import { useWallet } from './providers';
import { shortAddr } from '@/lib/format';

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        title={address}
        className="rounded-lg border border-white/15 bg-panel px-3 py-1.5 text-sm font-medium text-white/90 hover:border-accent/60"
      >
        {shortAddr(address)} · Disconnect
      </button>
    );
  }

  return (
    <button
      onClick={() => connect().catch(() => {})}
      disabled={connecting}
      className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
