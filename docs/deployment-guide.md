# Deployment guide

## Prerequisites

```bash
cargo install --locked stellar-cli
rustup target add wasm32v1-none
stellar keys generate vaultex-deployer --network testnet --fund
```

## 1. Build

```bash
stellar contract build      # → target/wasm32v1-none/release/lending_pool.wasm
```

Always build with `stellar contract build` (target `wasm32v1-none`); the plain
`cargo build --target wasm32-unknown-unknown` output is rejected by the network.

## 2. Prepare the market tokens

The pool needs a borrow token and a collateral token (SEP-41). On testnet the
reference market uses a test stablecoin `USDV` and native `XLM`:

```bash
DEPLOYER=$(stellar keys address vaultex-deployer)
stellar contract asset deploy --asset USDV:$DEPLOYER --source vaultex-deployer --network testnet
USDV=$(stellar contract id asset --asset USDV:$DEPLOYER --network testnet)
XLM=$(stellar contract id asset --asset native --network testnet)
```

## 3. Deploy with constructor args

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/lending_pool.wasm \
  --source vaultex-deployer --network testnet --alias lending_pool \
  -- --borrow_token $USDV --collateral_token $XLM \
     --ltv_bps 7500 --liquidation_threshold_bps 8500 \
     --liquidation_bonus_bps 1000 --apr_bps 1000
```

The current testnet deployment is
`CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T`.

## 4. Regenerate the typed client

```bash
make bindings CONTRACT_ID=<new-id> NETWORK=testnet
pnpm build:client
```

## 5. Wire the web app

```
# web/.env.local
NEXT_PUBLIC_CONTRACT_ID=<new-id>
NEXT_PUBLIC_BORROW_TOKEN=<usdv-sac>
NEXT_PUBLIC_COLLATERAL_TOKEN=<xlm-sac>
```

## 6. Verify

```bash
stellar contract invoke --id <new-id> --source vaultex-deployer \
  --network testnet -- get_pool      # all zeros on a fresh deploy
```

## Mainnet

Audit the contract, choose real market parameters, and use vetted SEP-41 tokens
(and an oracle for non-stablecoin pairs) before deploying with `--network mainnet`.
