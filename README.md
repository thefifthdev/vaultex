# Vaultex 🔗

> Non-custodial lending and credit protocol built natively on Soroban smart contracts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Built%20on-Stellar-black)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-purple)](https://soroban.stellar.org)
[![Audit](https://img.shields.io/badge/Audit-Pending-yellow)]()
[![Status](https://img.shields.io/badge/Status-Testnet-blue)]()

---

## Overview

Vaultex is Stellar's first fully on-chain, non-custodial lending protocol. Deposit assets, earn yield. Supply collateral, borrow against it. Everything governed by transparent, immutable Soroban smart contracts — no custodians, no intermediaries, no surprises.

Stellar has world-class payment infrastructure and deep USDC liquidity. What it lacked was a battle-tested DeFi credit primitive. Vaultex fills that gap.

---

## The Problem

Stellar users with idle USDC or XLM have two options today: hold or trade. There is no native, trustless way to put assets to work or access short-term credit without handing custody to a centralized exchange. This leaves billions in on-chain value underutilized and locks out the DeFi use cases that make blockchains economically powerful.

---

## Protocol Architecture

Vaultex is composed of four modular Soroban contracts that operate independently and compose cleanly:

### 1. Vault Contract
The core liquidity pool. Lenders deposit assets (USDC, XLM, or whitelisted tokens) and receive vTokens representing their share of the pool plus accrued interest.

```
Lender deposits 1000 USDC
→ Receives 1000 vUSDC (appreciates over time as interest accrues)
→ Redeems vUSDC later for 1000 USDC + earned yield
```

### 2. Credit Contract
Manages borrowing positions. Borrowers supply collateral to open a credit line, draw funds up to their borrow limit, and repay with interest. Positions are fully on-chain and auditable.

```
Borrower deposits 1500 USDC collateral (150% ratio)
→ Receives credit line of 1000 USDC
→ Borrows 800 USDC at current utilization rate
→ Repays principal + interest to close position
```

### 3. Interest Rate Contract
Implements a utilization-curve interest model. Rates adjust algorithmically based on pool utilization — low demand means cheap borrowing, high demand means higher rates to incentivize new lenders. No oracle dependency for stablecoin pairs.

```
Rate Model:
  Utilization < 80%:  Base Rate + (Utilization × Multiplier)
  Utilization >= 80%: Jump Rate kicks in (steep increase)
```

### 4. Liquidation Contract
Automatically protects the protocol when collateral ratios fall below the liquidation threshold. Liquidators can repay undercollateralized positions in exchange for a liquidation bonus.

```
Position becomes undercollateralized (ratio < 120%)
→ Liquidator repays borrower's debt
→ Liquidator receives collateral + 5% bonus
→ Protocol remains solvent
```

---

## Key Parameters

| Parameter | Value |
|---|---|
| Minimum Collateral Ratio | 150% |
| Liquidation Threshold | 120% |
| Liquidation Bonus | 5% |
| Protocol Reserve Factor | 10% of interest |
| Supported Assets (v1) | USDC, XLM |
| Base Borrow Rate | 2% APR |
| Optimal Utilization | 80% |

---

## Interest Rate Model

```
                         Jump Rate Zone
Rate (%)                 ┌─────────────
                         │
     ────────────────────┘
     Linear Zone

     0%          80%         100%
                 Utilization
```

The model is designed to keep utilization in the optimal range (60–80%) where lenders earn meaningful yield and borrowers pay fair rates. Above 80%, rates spike to attract liquidity and protect depositors.

---

## Smart Contract Interfaces

### Vault Contract

```rust
// Deposit assets into the lending pool
fn deposit(env: Env, depositor: Address, asset: Address, amount: i128) -> i128;

// Withdraw assets plus earned interest
fn withdraw(env: Env, depositor: Address, asset: Address, v_token_amount: i128) -> i128;

// Get current exchange rate (vToken → underlying)
fn exchange_rate(env: Env, asset: Address) -> i128;

// Get total deposits and utilization
fn pool_info(env: Env, asset: Address) -> PoolInfo;
```

### Credit Contract

```rust
// Open a borrowing position with collateral
fn open_position(env: Env, borrower: Address, collateral: Address, collateral_amount: i128) -> PositionId;

// Draw funds against an open position
fn borrow(env: Env, borrower: Address, position_id: u64, amount: i128);

// Repay borrowed amount (partial or full)
fn repay(env: Env, borrower: Address, position_id: u64, amount: i128);

// Get position health and accrued interest
fn position_info(env: Env, position_id: u64) -> PositionInfo;
```

### Liquidation Contract

```rust
// Check if a position is eligible for liquidation
fn is_liquidatable(env: Env, position_id: u64) -> bool;

// Liquidate an undercollateralized position
fn liquidate(env: Env, liquidator: Address, position_id: u64, repay_amount: i128);
```

---

## Security Model

Vaultex is designed with security-first principles:

**No Admin Keys on Core Logic** — once deployed, core contract parameters cannot be changed by any single party. Protocol upgrades require governance.

**Reentrancy Protection** — all state changes complete before any external calls. Soroban's execution model makes reentrancy attacks structurally difficult.

**Overflow-Safe Math** — all arithmetic uses checked operations. Integer overflow reverts the transaction.

**Collateral-Isolating Design** — each position is independent. A bad debt event in one position cannot cascade to drain the entire pool.

**Emergency Pause** — a 3-of-5 multisig guardian can pause deposits and borrows (not withdrawals) in the event of a critical vulnerability. Cannot steal funds.

---

## Audit Status

| Component | Auditor | Status |
|---|---|---|
| Vault Contract | Pending | 🟡 Pre-audit |
| Credit Contract | Pending | 🟡 Pre-audit |
| Interest Rate Model | Pending | 🟡 Pre-audit |
| Liquidation Contract | Pending | 🟡 Pre-audit |

Audit will be conducted prior to mainnet launch. All findings will be published publicly.

---

## Getting Started

### For Lenders

1. Connect your Stellar wallet (Freighter, LOBSTR, or Albedo)
2. Navigate to the **Supply** tab
3. Deposit USDC or XLM to start earning yield
4. Monitor your vToken balance as it appreciates

### For Borrowers

1. Connect wallet and navigate to **Borrow**
2. Deposit collateral (minimum 150% of desired loan)
3. Draw your credit line — funds arrive in your wallet instantly
4. Monitor your health factor and repay before liquidation threshold

### For Liquidators

Liquidators are a critical part of protocol health. Monitor undercollateralized positions and earn 5% bonus by repaying them. A bot template is available in `/scripts/liquidator-bot`.

---

## Running Locally

```bash
git clone https://github.com/your-org/vaultex
cd vaultex

# Install Soroban CLI
cargo install --locked soroban-cli

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Run full test suite
cargo test

# Deploy to local network
soroban network add local --rpc-url http://localhost:8000/soroban/rpc --network-passphrase "Standalone Network ; February 2017"
./scripts/deploy-local.sh

# Deploy to testnet
./scripts/deploy-testnet.sh
```

---

## Roadmap

**v1.0 — Testnet (Current)**
- USDC and XLM lending pools
- Fixed collateral ratio borrowing
- Algorithmic interest rates
- Manual liquidation

**v1.1 — Mainnet**
- Security audit complete
- Frontend dApp launch
- Liquidation bot (open source)
- Analytics dashboard

**v2.0**
- Governance token and DAO
- Additional collateral assets
- Variable vs. fixed rate markets
- Cross-collateral positions
- Isolated lending markets

---

## Contributing

We welcome contributions from Rust developers, DeFi researchers, and security reviewers.

Core areas needing help: contract logic, test coverage, liquidation bot, and frontend integration. See [CONTRIBUTING.md](CONTRIBUTING.md) and browse open issues tagged `good-first-issue`, `protocol`, and `security`.

---

## License

MIT © Vaultex Contributors

---

*Vaultex is experimental software. Use at your own risk. Do not deposit funds you cannot afford to lose until the protocol has been fully audited.*
