extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env,
};

use crate::{Error, LendingPool, LendingPoolClient};

const LTV_BPS: u32 = 7_500; // 75%
const LIQ_THRESHOLD_BPS: u32 = 8_500; // 85%
const LIQ_BONUS_BPS: u32 = 1_000; // 10%
const APR_BPS: u32 = 1_000; // 10%/yr
const YEAR: u64 = 31_536_000;

struct Setup<'a> {
    env: Env,
    lender: Address,
    borrower: Address,
    liquidator: Address,
    borrow: token::Client<'a>,
    borrow_id: Address,
    collateral: token::Client<'a>,
    collateral_id: Address,
    client: LendingPoolClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_000_000);

    let admin = Address::generate(&env);
    let lender = Address::generate(&env);
    let borrower = Address::generate(&env);
    let liquidator = Address::generate(&env);

    let bsac = env.register_stellar_asset_contract_v2(admin.clone());
    let borrow_id = bsac.address();
    let borrow = token::Client::new(&env, &borrow_id);
    let badmin = token::StellarAssetClient::new(&env, &borrow_id);
    badmin.mint(&lender, &1_000_000);
    badmin.mint(&borrower, &1_000_000);
    badmin.mint(&liquidator, &1_000_000);

    let csac = env.register_stellar_asset_contract_v2(admin.clone());
    let collateral_id = csac.address();
    let collateral = token::Client::new(&env, &collateral_id);
    token::StellarAssetClient::new(&env, &collateral_id).mint(&borrower, &1_000_000);

    let contract_id = env.register(
        LendingPool,
        (
            borrow_id.clone(),
            collateral_id.clone(),
            LTV_BPS,
            LIQ_THRESHOLD_BPS,
            LIQ_BONUS_BPS,
            APR_BPS,
        ),
    );
    let client = LendingPoolClient::new(&env, &contract_id);

    Setup {
        env,
        lender,
        borrower,
        liquidator,
        borrow,
        borrow_id,
        collateral,
        collateral_id,
        client,
    }
}

#[test]
fn constructor_sets_config() {
    let s = setup();
    let cfg = s.client.get_config();
    assert_eq!(cfg.ltv_bps, LTV_BPS);
    assert_eq!(cfg.apr_bps, APR_BPS);
    assert_eq!(cfg.borrow_token, s.borrow_id);
    assert_eq!(cfg.collateral_token, s.collateral_id);
}

#[test]
fn deposit_mints_shares_one_to_one_first() {
    let s = setup();
    let shares = s.client.deposit(&s.lender, &10_000);
    assert_eq!(shares, 10_000);
    assert_eq!(s.client.shares_of(&s.lender), 10_000);
    assert_eq!(s.borrow.balance(&s.client.address), 10_000);
    assert_eq!(s.client.get_pool().total_deposited, 10_000);
}

#[test]
fn withdraw_returns_underlying() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    let amount = s.client.withdraw(&s.lender, &4_000);
    assert_eq!(amount, 4_000);
    assert_eq!(s.client.shares_of(&s.lender), 6_000);
}

#[test]
fn withdraw_more_than_shares_errors() {
    let s = setup();
    s.client.deposit(&s.lender, &1_000);
    assert_eq!(
        s.client.try_withdraw(&s.lender, &2_000),
        Err(Ok(Error::AmountTooHigh))
    );
}

#[test]
fn deposit_zero_errors() {
    let s = setup();
    assert_eq!(
        s.client.try_deposit(&s.lender, &0),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn supply_collateral_increases_position() {
    let s = setup();
    s.client.supply_collateral(&s.borrower, &1_000);
    assert_eq!(s.client.get_position(&s.borrower).collateral, 1_000);
    assert_eq!(s.collateral.balance(&s.client.address), 1_000);
}

#[test]
fn borrow_within_ltv_succeeds() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &700); // 70% < 75% LTV
    assert_eq!(s.client.get_position(&s.borrower).principal, 700);
    assert_eq!(s.borrow.balance(&s.borrower), 1_000_000 + 700);
    assert_eq!(s.client.get_pool().total_borrowed, 700);
}

#[test]
fn borrow_over_ltv_errors() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    assert_eq!(
        s.client.try_borrow(&s.borrower, &800),
        Err(Ok(Error::Undercollateralized))
    );
}

#[test]
fn borrow_without_liquidity_errors() {
    let s = setup();
    s.client.supply_collateral(&s.borrower, &1_000);
    assert_eq!(
        s.client.try_borrow(&s.borrower, &100),
        Err(Ok(Error::InsufficientLiquidity))
    );
}

#[test]
fn borrow_without_position_errors() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    assert_eq!(
        s.client.try_borrow(&s.borrower, &100),
        Err(Ok(Error::NoPosition))
    );
}

#[test]
fn repay_reduces_debt() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &500);
    let paid = s.client.repay(&s.borrower, &200);
    assert_eq!(paid, 200);
    assert_eq!(s.client.get_position(&s.borrower).principal, 300);
}

#[test]
fn repay_caps_at_debt() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &500);
    let paid = s.client.repay(&s.borrower, &900); // overpay
    assert_eq!(paid, 500);
    assert_eq!(s.client.current_debt(&s.borrower), 0);
}

#[test]
fn interest_accrues_over_time() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &700);
    // Advance one year → 10% of 700 = 70 interest.
    s.env.ledger().with_mut(|l| l.timestamp += YEAR);
    assert_eq!(s.client.current_debt(&s.borrower), 770);
}

#[test]
fn interest_repayment_grows_pool() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &700);
    s.env.ledger().with_mut(|l| l.timestamp += YEAR);
    // Repay everything (principal 700 + interest 70).
    let paid = s.client.repay(&s.borrower, &1_000);
    assert_eq!(paid, 770);
    // The 70 interest accrued to the pool, so LP value grew.
    assert_eq!(s.client.get_pool().total_deposited, 10_070);
    assert_eq!(s.client.get_pool().total_borrowed, 0);
}

#[test]
fn withdraw_collateral_within_limit() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &300);
    // Debt 300; need collateral ≥ 300/0.75 = 400. Withdraw 500, leaving 500. OK.
    s.client.withdraw_collateral(&s.borrower, &500);
    assert_eq!(s.client.get_position(&s.borrower).collateral, 500);
}

#[test]
fn withdraw_collateral_breaching_ltv_errors() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &700);
    // Need collateral ≥ 700/0.75 ≈ 934. Withdrawing 200 leaves 800 < 934.
    assert_eq!(
        s.client.try_withdraw_collateral(&s.borrower, &200),
        Err(Ok(Error::Undercollateralized))
    );
}

#[test]
fn liquidate_unhealthy_position() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &700);
    // Accrue ~3 years so debt (700 + ~210 = 910) exceeds the 850 threshold.
    s.env.ledger().with_mut(|l| l.timestamp += 3 * YEAR);
    assert!(s.client.current_debt(&s.borrower) > 850);

    let col_before = s.collateral.balance(&s.liquidator);
    s.client.liquidate(&s.liquidator, &s.borrower, &400);
    // Seized 400 * 1.10 = 440 collateral.
    assert_eq!(s.collateral.balance(&s.liquidator) - col_before, 440);
    assert_eq!(s.client.get_position(&s.borrower).collateral, 560);
}

#[test]
fn liquidate_healthy_errors() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000);
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &500);
    assert_eq!(
        s.client.try_liquidate(&s.liquidator, &s.borrower, &100),
        Err(Ok(Error::NotLiquidatable))
    );
}

#[test]
fn shares_appreciate_after_interest() {
    let s = setup();
    s.client.deposit(&s.lender, &10_000); // 10000 shares
    s.client.supply_collateral(&s.borrower, &1_000);
    s.client.borrow(&s.borrower, &700);
    s.env.ledger().with_mut(|l| l.timestamp += YEAR);
    s.client.repay(&s.borrower, &1_000); // pool now 10070 backing 10000 shares

    // Withdrawing all shares returns more than deposited.
    let out = s.client.withdraw(&s.lender, &10_000);
    assert_eq!(out, 10_070);
}
