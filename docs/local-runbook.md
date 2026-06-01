# Local runbook

From a clean checkout to a working local app. Vaultex is pure on-chain — there is
no server to run.

```bash
nvm use                 # Node 20 (see .nvmrc)
make setup              # install deps, build the typed client
cp web/.env.example web/.env.local
make dev                # web → http://localhost:3000
```

## Try it (testnet)

1. Connect Freighter set to **Testnet** in the web app.
2. To borrow you need the test stablecoin `USDV` and a trustline. Add the
   trustline and mint some test USDV (you must be the issuer or use a faucet):

   ```bash
   stellar tx new change-trust --line USDV:<issuer> --source-account me --network testnet
   ```

3. Supply liquidity (`USDV`), post collateral (`XLM`), borrow, and repay from the
   dashboard.

## Smoke test the contract

```bash
CID=CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T
stellar contract invoke --id $CID --source vaultex-deployer --network testnet -- get_pool
stellar contract invoke --id $CID --source vaultex-deployer --network testnet -- get_config
```

## Run the tests

```bash
cargo test            # contract (19 tests)
```

## Troubleshooting

- **`reference-types not enabled` on deploy** — build with `stellar contract
  build`, not `cargo build --target wasm32-unknown-unknown`.
- **Borrow fails with a token error** — the borrower account needs a trustline to
  the borrow token before it can receive borrowed funds.
- **`Undercollateralized`** — your requested borrow/withdraw would exceed the LTV
  limit; supply more collateral or borrow less.
