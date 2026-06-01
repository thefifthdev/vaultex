# Architecture

Vaultex is a single Soroban contract — a non-custodial money market — plus a
Next.js dashboard that reads pool/position state and submits wallet-signed
transactions. There is no off-chain server; the contract is the source of truth.

```
┌──────────────┐   wallet-signed tx     ┌──────────────────────────┐
│   Web (Next) │ ─────────────────────► │   lending-pool (Soroban) │
│  supply /    │ ◄──────  reads  ────────│  • LP shares             │
│  borrow /    │                         │  • borrower positions    │
│  repay UI    │                         │  • linear interest       │
│  Wallets Kit │                         │  • liquidation           │
└──────────────┘                         └──────────────────────────┘
```

## Accounting

- **Lenders** deposit the borrow asset and receive **shares**. Shares are minted
  proportionally: `shares = amount × total_shares / total_deposited` (1:1 on the
  first deposit). As borrowers pay interest, `total_deposited` grows while
  `total_shares` stays fixed, so each share redeems for more — that is the yield.
- **Borrowers** post collateral and draw the borrow asset up to
  `collateral × LTV`. Each position tracks principal, accrued interest, and the
  last accrual timestamp.

## Interest model

Interest is **linear** for MVP simplicity: on every state-changing call the
borrower's position accrues `principal × APR × Δt / year`. Repaid interest is
added back to the pool's `total_deposited`, distributing yield to all lenders pro
rata via share appreciation. A utilization-curve (jump-rate) model is planned (see
the roadmap / issues).

## Pricing

The borrow and collateral assets are assumed to be valued **1:1** (a stablecoin
pair), so no oracle is needed. Health and LTV are computed directly from token
amounts. Non-stablecoin pairs require an oracle — tracked as an issue.

## Liquidation

A position is liquidatable when `debt > collateral × liquidation_threshold`. A
liquidator repays up to the debt and seizes `repaid × (1 + bonus)` of collateral
(capped at the position's collateral).

## Trust model

- No custodial admin: there is no function that lets any account take user funds.
- Every mutating call requires the relevant party's `require_auth()`.
- State and arithmetic are guarded; the release profile enables `overflow-checks`.
- Persistent entries (positions, shares) are TTL-bumped on access.
