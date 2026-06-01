.PHONY: install setup dev build test contract-build contract-test contract-fmt contract-clippy bindings deploy clean

# Vaultex local development entrypoints.
# Prerequisites: Node.js 20+, pnpm, Rust + the Stellar CLI.
# Vaultex is pure on-chain — there is no off-chain server.

install:
	pnpm install

setup: install
	pnpm build:client
	@echo ""
	@echo "Setup complete. Copy web/.env.example -> web/.env.local, then run 'make dev'."

dev:
	pnpm dev:web

build:
	pnpm build

test:
	pnpm test

# ---- Soroban contract ----

contract-build:
	stellar contract build

contract-test:
	cargo test

contract-fmt:
	cargo fmt --check

contract-clippy:
	cargo clippy --all-targets -- -D warnings

bindings:
	stellar contract bindings typescript \
		--network $(or $(NETWORK),testnet) \
		--contract-id $(CONTRACT_ID) \
		--output-dir packages/lending-client --overwrite

deploy: contract-build
	stellar contract deploy \
		--wasm target/wasm32v1-none/release/lending_pool.wasm \
		--source $(or $(SOURCE),vaultex-deployer) \
		--network $(or $(NETWORK),testnet)

clean:
	cargo clean
	rm -rf node_modules web/node_modules packages/*/node_modules
