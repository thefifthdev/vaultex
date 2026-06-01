# Contributing to Vaultex

Thanks for helping build non-custodial credit on Stellar! This guide gets you from
a clean checkout to passing checks.

## Prerequisites

| Tool        | Version | Notes                                |
| ----------- | ------- | ------------------------------------ |
| Node.js     | ≥ 20    | Use `nvm use` (see `.nvmrc`).        |
| pnpm        | ≥ 9     | `npm i -g pnpm`                      |
| Rust        | stable  | `rustup` toolchain.                  |
| Stellar CLI | ≥ 22    | `cargo install --locked stellar-cli` |
| wasm target | —       | `rustup target add wasm32v1-none`   |

## First-time setup

```bash
git clone https://github.com/thefifthdev/vaultex.git
cd vaultex
make setup                    # installs deps, builds the typed client
cp web/.env.example web/.env.local
make dev                      # web on :3000
```

Vaultex is **pure on-chain** — there is no off-chain server. The web app reads and
writes contract state directly via the typed client.

## Project layout

| Path                       | What it is                              |
| -------------------------- | --------------------------------------- |
| `contracts/lending-pool/`  | The Soroban lending contract (Rust).    |
| `packages/lending-client/` | Typed TS bindings from the deployment.  |
| `web/`                     | Next.js dashboard wired to testnet.     |
| `docs/`                    | Architecture, deployment, API, security. |

## Running checks

These mirror CI — run them before opening a PR:

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test

pnpm lint
pnpm format:check
pnpm build
```

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`docs:`, `refactor:`, `test:`, `ci:`, `chore:`. Subject < 72 chars, imperative.

## Stellar Wave / Drips

Vaultex participates in the **Stellar Wave Program** via
[Drips](https://www.drips.network/). Issues labeled **`Stellar Wave`** and
**`good first issue`** are open for contributors to pick up and earn rewards.
