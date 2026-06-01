import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from '@/components/providers';
import { WalletButton } from '@/components/WalletButton';
import { EXPLORER_CONTRACT } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Vaultex — non-custodial lending on Stellar',
  description:
    'Deposit assets to earn yield. Supply collateral, borrow against it. Fully on-chain, non-custodial credit on Soroban.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="border-b border-white/10">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold">
                <span className="text-accent">🔗</span> Vaultex
              </Link>
              <WalletButton />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
          <footer className="mx-auto max-w-5xl px-6 py-10 text-sm text-white/40">
            Running on Stellar testnet · USDV/XLM market ·{' '}
            <a href={EXPLORER_CONTRACT} className="underline hover:text-white/70" target="_blank">
              View contract
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
