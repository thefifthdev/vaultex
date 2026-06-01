'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/components/providers';
import {
  getPool,
  getConfig,
  sharesOf,
  getPosition,
  currentDebt,
  deposit,
  withdraw,
  supplyCollateral,
  borrow,
  repay,
} from '@/lib/contract';
import { formatAmount, toUnits, utilization, healthFactor } from '@/lib/format';
import { BORROW_SYMBOL, COLLATERAL_SYMBOL } from '@/lib/config';

export default function Dashboard() {
  const { address, connect } = useWallet();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pool = useQuery({ queryKey: ['pool'], queryFn: getPool });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const shares = useQuery({
    queryKey: ['shares', address],
    queryFn: () => sharesOf(address!),
    enabled: !!address,
  });
  const position = useQuery({
    queryKey: ['position', address],
    queryFn: () => getPosition(address!),
    enabled: !!address,
  });
  const debt = useQuery({
    queryKey: ['debt', address],
    queryFn: () => currentDebt(address!),
    enabled: !!address,
  });

  async function run(action: string, fn: (addr: string) => Promise<void>) {
    setError(null);
    if (!address) {
      await connect().catch(() => {});
      return;
    }
    setBusy(action);
    try {
      await fn(address);
      await qc.invalidateQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const liqBps = config.data ? Number(config.data.liquidation_threshold_bps) : 8500;
  const hf =
    position.data && debt.data !== undefined
      ? healthFactor(position.data.collateral, debt.data, liqBps)
      : null;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Non-custodial lending on Stellar</h1>
        <p className="mt-2 max-w-2xl text-white/60">
          Deposit {BORROW_SYMBOL} to earn yield from borrowers. Supply {COLLATERAL_SYMBOL}{' '}
          collateral to borrow against it. Everything settles on-chain via Soroban — no custodian.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label={`Total supplied (${BORROW_SYMBOL})`}
          value={pool.data ? formatAmount(pool.data.total_deposited) : '…'}
        />
        <Stat
          label={`Total borrowed (${BORROW_SYMBOL})`}
          value={pool.data ? formatAmount(pool.data.total_borrowed) : '…'}
        />
        <Stat
          label="Utilization"
          value={
            pool.data ? `${utilization(pool.data.total_borrowed, pool.data.total_deposited)}%` : '…'
          }
        />
        <Stat
          label="Borrow APR"
          value={config.data ? `${Number(config.data.apr_bps) / 100}%` : '…'}
        />
      </section>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Earn — supply liquidity">
          <p className="mb-4 text-sm text-white/50">
            Your shares: {shares.data !== undefined ? formatAmount(shares.data) : '—'}
          </p>
          <ActionForm
            label={`Deposit ${BORROW_SYMBOL}`}
            busy={busy === 'deposit'}
            onSubmit={(amt) => run('deposit', (a) => deposit(a, toUnits(amt)))}
          />
          <ActionForm
            label="Withdraw shares"
            variant="ghost"
            busy={busy === 'withdraw'}
            onSubmit={(amt) => run('withdraw', (a) => withdraw(a, toUnits(amt)))}
          />
        </Panel>

        <Panel title="Borrow — against collateral">
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <Mini
              label={`Collateral (${COLLATERAL_SYMBOL})`}
              value={position.data ? formatAmount(position.data.collateral) : '—'}
            />
            <Mini
              label={`Debt (${BORROW_SYMBOL})`}
              value={debt.data !== undefined ? formatAmount(debt.data) : '—'}
            />
            <Mini
              label="Health factor"
              value={hf === null ? 'no debt' : hf.toFixed(2)}
              danger={hf !== null && hf < 1.1}
            />
          </div>
          <ActionForm
            label={`Supply ${COLLATERAL_SYMBOL}`}
            busy={busy === 'supply'}
            onSubmit={(amt) => run('supply', (a) => supplyCollateral(a, toUnits(amt)))}
          />
          <ActionForm
            label={`Borrow ${BORROW_SYMBOL}`}
            busy={busy === 'borrow'}
            onSubmit={(amt) => run('borrow', (a) => borrow(a, toUnits(amt)))}
          />
          <ActionForm
            label={`Repay ${BORROW_SYMBOL}`}
            variant="ghost"
            busy={busy === 'repay'}
            onSubmit={(amt) => run('repay', (a) => repay(a, toUnits(amt)))}
          />
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white/95">{value}</div>
    </div>
  );
}

function Mini({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-0.5 font-medium ${danger ? 'text-rose-300' : 'text-white/90'}`}>
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-panel/60 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white/85">{title}</h2>
      {children}
    </div>
  );
}

function ActionForm({
  label,
  onSubmit,
  busy,
  variant = 'primary',
}: {
  label: string;
  onSubmit: (amount: string) => void;
  busy?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const [amount, setAmount] = useState('');
  const btn =
    variant === 'ghost'
      ? 'border border-white/15 text-white/80 hover:border-accent/60'
      : 'bg-accent text-white hover:opacity-90';
  return (
    <form
      className="mb-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount) onSubmit(amount);
      }}
    >
      <input
        className="w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder="0.0"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy}
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${btn}`}
      >
        {busy ? '…' : label}
      </button>
    </form>
  );
}
