# Security

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Email
`security@vaultex.dev` (or open a private GitHub security advisory) with steps to
reproduce. We aim to acknowledge within 72 hours.

## Contract security posture

- **No custodial admin.** There is no function that lets any account drain pool
  funds. Tokens move only on user-initiated deposit/withdraw, borrow/repay, or a
  liquidation of a genuinely unhealthy position.
- **Authorization.** Every mutating call requires the caller's `require_auth()` —
  lender for deposit/withdraw, borrower for collateral/borrow/repay, liquidator
  for liquidate.
- **Solvency guards.** Borrows and collateral withdrawals are checked against the
  LTV limit; withdrawals are bounded by free liquidity; liquidation requires the
  position to be past the liquidation threshold.
- **Interest integrity.** Interest accrues linearly per position and is added to
  the pool on repayment, so lender share value reflects real repaid interest.
- **Integer safety.** The release profile enables `overflow-checks`.
- **Storage rent.** Positions and share balances are TTL-bumped on access.

## Known limitations (tracked as issues)

- Assumes a 1:1-valued stablecoin pair; non-stablecoin markets need a price oracle.
- Flat APR rather than a utilization-curve (jump-rate) model.
- Liquidation has no close factor (a liquidator may repay the full debt at once).
- Single market only; no reserve factor / protocol treasury yet.

## Testing

19 unit tests cover deposits/withdrawals and share math, collateralized
borrow/repay, LTV enforcement, linear interest accrual over time, interest
flowing to lenders, and liquidation of unhealthy positions. CI runs `cargo test`,
`clippy -D warnings`, and `cargo fmt --check` on every PR.
