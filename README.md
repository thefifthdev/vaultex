# Vaultex 🔗

> Non-custodial lending and credit protocol built natively on Soroban smart contracts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Built%20on-Stellar-black)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-purple)](https://soroban.stellar.org)
[![Status](https://img.shields.io/badge/Status-MVP%20on%20Testnet-2dd4bf)]()

Vaultex is an on-chain, non-custodial money market on Stellar. Deposit assets to
earn yield. Supply collateral, borrow against it, repay with interest — governed
by transparent Soroban smart contracts, with no custodians and no intermediaries.

**Live on testnet:** contract
[`CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T`](https://stellar.expert/explorer/testnet/contract/CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T)
(USDV / XLM market).

---

## The problem

Stellar users with idle USDC or XLM can only hold or trade. There is no native,
trustless way to put assets to work or access short-term credit without handing
custody to a centralized exchange. Vaultex fills that gap with a DeFi credit
primitive built for Stellar's deep stablecoin liquidity.

## How it works

```
SUPPLY     Lenders deposit the borrow asset → receive pool shares that
           appreciate as borrowers pay interest
COLLATERAL Borrowers post collateral
BORROW     Borrowers draw the asset up to their LTV limit
REPAY      Borrowers repay principal + interest (interest accrues to lenders)
LIQUIDATE  Positions below the liquidation threshold can be liquidated for a bonus
```

For MVP simplicity the borrow and collateral assets are valued 1:1 (a stablecoin
pair), so **no price oracle is required**. The contract is the source of truth;
no admin can move user funds.

## Architecture

```
Web (Next.js) ──wallet-signed tx──► lending-pool (Soroban)  ◄── reads
   supply / borrow / repay UI          shares · positions · linear interest · liquidation
```

See [`docs/architecture.md`](docs/architecture.md) for the full design and trust model.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Contract | Rust · Soroban SDK 22 · `wasm32v1-none` · constructor-set market |
| Client   | Typed TS bindings (`@vaultex/lending-client`)                   |
| Web      | Next.js (App Router) · Tailwind · TanStack Query · Wallets Kit   |
| Tooling  | pnpm workspace · GitHub Actions · Conventional Commits           |

## Getting started

```bash
# Prerequisites: Node 20+, pnpm 9+, Rust, Stellar CLI, wasm32v1-none target
git clone https://github.com/thefifthdev/vaultex.git
cd vaultex
make setup
cp web/.env.example web/.env.local
make dev     # web on :3000
```

Connect Freighter (Testnet), supply liquidity or post collateral and borrow. Full
steps: [`docs/local-runbook.md`](docs/local-runbook.md).

## Project structure

| Path                       | Description                                  |
| -------------------------- | -------------------------------------------- |
| `contracts/lending-pool/`  | Soroban lending contract + 19 unit tests.    |
| `packages/lending-client/` | Generated typed contract bindings.           |
| `web/`                     | Next.js dashboard wired to testnet.          |
| `docs/`                    | Architecture, deployment, contract API, security. |

## Documentation

- [Architecture](docs/architecture.md)
- [Contract API](docs/contract-api.md)
- [Deployment guide](docs/deployment-guide.md)
- [Local runbook](docs/local-runbook.md)
- [Security](docs/security.md)

## Roadmap

- [x] Lending pool: deposit/withdraw shares, collateralized borrow/repay
- [x] Linear interest accrual to lenders
- [x] Liquidation of unhealthy positions with a bonus
- [x] Testnet deployment + typed client + web dashboard
- [ ] Price oracle for non-stablecoin pairs — _good first issues open_
- [ ] Utilization-curve interest rate model (jump rate)
- [ ] Multi-asset markets & isolated pools
- [ ] Audit + mainnet launch

## Contributing & Stellar Wave

Vaultex participates in the **Stellar Wave Program** via
[Drips](https://www.drips.network/). Pick up an issue labeled **`Stellar Wave`**
or **`good first issue`** to earn contributor rewards. Start with
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
