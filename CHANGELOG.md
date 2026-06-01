# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ⛓ `lending-pool` Soroban contract: deposit/withdraw LP shares, collateralized
  borrow/repay, linear interest accrual to lenders, and liquidation of unhealthy
  positions with a bonus. Constructor-configurable market (tokens, LTV, threshold,
  bonus, APR). 19 unit tests.
- 📦 `@vaultex/lending-client` — typed TypeScript bindings.
- 🌐 Next.js dashboard wired to Stellar testnet: supply, borrow, repay, and live
  pool/position stats with a health factor, via Stellar Wallets Kit.
- 📖 Architecture, deployment, contract-API, local-runbook, and security docs.
- 🔧 CI (fmt/clippy/test + lint/build + WASM size budget) and full contribution
  infrastructure.

### Deployed

- Testnet: `lending-pool` at
  `CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T` (USDV/XLM market).
