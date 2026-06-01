#!/usr/bin/env bash
# Seed Vaultex's contributor backlog as labeled GitHub issues.
# Requires the GitHub CLI authenticated against the repo. Run once on a fresh repo.
set -euo pipefail

REPO="${REPO:-thefifthdev/vaultex}"

ensure_label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" 2>/dev/null || true
}

ensure_label "Stellar Wave"     "7c5cff" "Eligible for Stellar Wave / Drips contributor rewards"
ensure_label "good first issue" "2dd4bf" "Good for newcomers"
ensure_label "area: contract"   "5319e7" "Soroban contract"
ensure_label "area: web"        "1d76db" "Next.js web app"
ensure_label "area: docs"       "d4c5f9" "Documentation"

issue() {
  local title="$1" labels="$2" body="$3"
  echo "Creating: $title"
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body"
}

issue "feat(contract): price oracle for non-stablecoin pairs" \
  "Stellar Wave,area: contract" \
  $'## Problem\nThe MVP assumes a 1:1 stablecoin pair. Real markets need a price feed.\n\n## Acceptance criteria\n- [ ] Pluggable oracle interface\n- [ ] LTV/health computed from collateral value\n- [ ] Tests with a mock oracle'

issue "feat(contract): utilization-curve (jump-rate) interest model" \
  "Stellar Wave,area: contract" \
  $'## Problem\nInterest is a flat APR; rates should respond to utilization.\n\n## Acceptance criteria\n- [ ] Base + slope below kink, steep slope above\n- [ ] Tests across utilization levels'

issue "feat(contract): reserve factor / protocol treasury" \
  "area: contract" \
  $'## Acceptance criteria\n- [ ] A configurable cut of interest routed to a treasury\n- [ ] Tests'

issue "feat(contract): multi-asset / isolated markets" \
  "Stellar Wave,area: contract" \
  $'## Problem\nOnly one borrow/collateral pair is supported.\n\n## Acceptance criteria\n- [ ] Support multiple markets\n- [ ] Tests'

issue "feat(contract): partial-liquidation close factor" \
  "area: contract" \
  $'## Acceptance criteria\n- [ ] Cap a single liquidation to a close factor of debt\n- [ ] Tests'

issue "feat(web): one-click max borrow / safe-withdraw" \
  "good first issue,area: web" \
  $'## Acceptance criteria\n- [ ] Compute and prefill the max safe borrow/withdraw amount'

issue "feat(web): liquidation panel for keepers" \
  "Stellar Wave,area: web" \
  $'## Acceptance criteria\n- [ ] List unhealthy positions\n- [ ] Liquidate from the UI'

issue "feat(web): USDV faucet & trustline helper" \
  "good first issue,area: web" \
  $'## Problem\nNew testnet users lack USDV and a trustline.\n\n## Acceptance criteria\n- [ ] Button to add the USDV trustline and mint test USDV'

issue "feat(web): wallet network-mismatch warning banner" \
  "good first issue,area: web" \
  $'## Acceptance criteria\n- [ ] Detect connected network\n- [ ] Banner prompting to switch to Testnet'

issue "feat(web): historical APY / utilization chart" \
  "area: web" \
  $'## Acceptance criteria\n- [ ] Chart pool utilization and implied APY over time'

issue "test(contract): property/fuzz tests for share & interest math" \
  "Stellar Wave,area: contract" \
  $'## Acceptance criteria\n- [ ] proptest coverage for deposit/withdraw rounding and interest accrual'

issue "docs: add a supply/borrow walkthrough (GIF) to the README" \
  "good first issue,area: docs" \
  $'## Acceptance criteria\n- [ ] Short GIF of supplying and borrowing\n- [ ] Embedded in README'

echo "Done. Seeded contributor issues on $REPO."
