# Contract API — `lending-pool`

Soroban SDK 22. Testnet deployment:
`CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T` (USDV/XLM, 75% LTV, 85%
liquidation threshold, 10% bonus, 10% APR).

## Construction

`__constructor(borrow_token, collateral_token, ltv_bps, liquidation_threshold_bps,
liquidation_bonus_bps, apr_bps)` — set once at deploy time. Requires
`ltv ≤ liquidation_threshold ≤ 100%`, bonus ≤ 50%, APR ≤ 100%.

## Lender functions

| Function | Auth | Effect |
| -------- | ---- | ------ |
| `deposit(lender, amount) -> i128` | `lender` | Transfers `amount` of borrow token in; mints proportional shares. |
| `withdraw(lender, shares) -> i128` | `lender` | Burns shares, returns underlying (bounded by free liquidity). |

## Borrower functions

| Function | Auth | Effect |
| -------- | ---- | ------ |
| `supply_collateral(borrower, amount)` | `borrower` | Posts collateral. |
| `withdraw_collateral(borrower, amount)` | `borrower` | Withdraws collateral if the position stays within LTV. |
| `borrow(borrower, amount)` | `borrower` | Draws the borrow asset up to `collateral × ltv`. |
| `repay(borrower, amount) -> i128` | `borrower` | Repays interest then principal; returns amount paid. |

## Liquidation

| Function | Auth | Effect |
| -------- | ---- | ------ |
| `liquidate(liquidator, borrower, repay_amount)` | `liquidator` | If `debt > collateral × liq_threshold`, repays debt and seizes collateral at the bonus. |

## Views

| Function | Returns |
| -------- | ------- |
| `get_config() -> Config` | Market parameters. |
| `get_pool() -> Pool` | `{ total_deposited, total_borrowed, total_shares }`. |
| `shares_of(lender) -> i128` | LP share balance. |
| `get_position(borrower) -> Position` | `{ collateral, principal, accrued_interest, last_accrual }`. |
| `current_debt(borrower) -> i128` | Principal + interest accrued to now. |

## Interest

Linear: `interest = principal × apr_bps × Δt / (10000 × seconds_per_year)`,
accrued on every state-changing call. Repaid interest is added to
`total_deposited`, so LP shares appreciate.

## Errors

| Code | Name | Meaning |
| ---- | ---- | ------- |
| 1 | AlreadyInitialized | Constructor called twice. |
| 2 | NotInitialized | Pool not configured. |
| 3 | InvalidAmount | Amount must be > 0. |
| 4 | InvalidConfig | Constructor parameter out of range. |
| 5 | InsufficientLiquidity | Not enough free liquidity. |
| 6 | NoPosition | Borrower has no position. |
| 7 | NoShares | Lender has no shares. |
| 8 | Undercollateralized | Would exceed the LTV limit. |
| 9 | NotLiquidatable | Position is healthy. |
| 10 | AmountTooHigh | Exceeds the outstanding balance. |

## Events

| Topic | Data |
| ----- | ---- |
| `deposit`, lender | `(amount, shares)` |
| `withdraw`, lender | `(shares, amount)` |
| `supply`, borrower | `amount` |
| `wcollat`, borrower | `amount` |
| `borrow`, borrower | `amount` |
| `repay`, borrower | `amount` |
| `liquidate`, borrower | `(repaid, seized)` |
